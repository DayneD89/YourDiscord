const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

/**
 * EventStorage - Manages event data in DynamoDB
 * Handles event creation, retrieval, and reminder tracking
 */
class EventStorage {
    constructor(tableName, region = 'us-west-2') {
        // Create DynamoDB v3 client
        const client = new DynamoDBClient({ 
            region,
            maxAttempts: 3,
            requestTimeout: 30000
        });
        
        this.docClient = DynamoDBDocumentClient.from(client);
        this.tableName = tableName || process.env.DYNAMODB_EVENTS_TABLE || 'discord-events-main';
        
        console.log(`EventStorage initialized with table: ${this.tableName}`);
    }

    /**
     * Create a new event
     */
    async createEvent(guildId, eventData) {
        const eventId = uuidv4();
        const now = new Date().toISOString();
        
        // Calculate TTL (30 days after event date)
        const eventDate = new Date(eventData.eventDate);
        const ttlDate = new Date(eventDate.getTime() + (30 * 24 * 60 * 60 * 1000));
        const ttl = Math.floor(ttlDate.getTime() / 1000);

        const event = {
            guild_id: guildId,
            event_id: eventId,
            name: eventData.name,
            description: eventData.description || '',
            region: eventData.region,
            location: eventData.location || '',
            event_date: eventData.eventDate, // Should already be ISO string from EventManager validation
            link: eventData.link || '',
            created_by: eventData.createdBy,
            created_at: now,
            reminder_status: 'pending', // pending, week_sent, day_sent, completed
            ttl: ttl
        };

        try {
            console.log('Creating event in DynamoDB:', { eventId, name: event.name });
            
            const command = new PutCommand({
                TableName: this.tableName,
                Item: event,
                ConditionExpression: 'attribute_not_exists(event_id)' // Prevent overwrites
            });

            await this.docClient.send(command);
            console.log('✅ Event created successfully in DynamoDB');
            return event;
            
        } catch (error) {
            console.error('Error creating event in DynamoDB:', error);
            throw new Error('Failed to create event');
        }
    }

    /**
     * Get event by ID
     */
    async getEvent(guildId, eventId) {
        try {
            const command = new GetCommand({
                TableName: this.tableName,
                Key: {
                    guild_id: guildId,
                    event_id: eventId
                }
            });

            const result = await this.docClient.send(command);
            return result.Item || null;
            
        } catch (error) {
            console.error(`Error getting event ${eventId}:`, error);
            throw error;
        }
    }

    /**
     * Get events by region
     */
    async getEventsByRegion(guildId, region) {
        try {
            const command = new QueryCommand({
                TableName: this.tableName,
                IndexName: 'region-index',
                KeyConditionExpression: 'guild_id = :guildId AND #region = :region',
                ExpressionAttributeNames: {
                    '#region': 'region'
                },
                ExpressionAttributeValues: {
                    ':guildId': guildId,
                    ':region': region
                },
                ScanIndexForward: true // Sort by range key ascending
            });

            const result = await this.docClient.send(command);
            return result.Items || [];
            
        } catch (error) {
            console.error(`Error getting events for region ${region}:`, error);
            return [];
        }
    }

    /**
     * Get upcoming events for reminders
     */
    async getUpcomingEvents(guildId) {
        try {
            const now = new Date().toISOString();
            const weekFromNow = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString();
            
            const command = new QueryCommand({
                TableName: this.tableName,
                IndexName: 'date-index',
                KeyConditionExpression: 'guild_id = :guildId AND event_date BETWEEN :now AND :weekFromNow',
                ExpressionAttributeValues: {
                    ':guildId': guildId,
                    ':now': now,
                    ':weekFromNow': weekFromNow
                }
            });

            const result = await this.docClient.send(command);
            return result.Items || [];
            
        } catch (error) {
            console.error('Error getting upcoming events:', error);
            return [];
        }
    }

    /**
     * Update event reminder status
     */
    async updateReminderStatus(guildId, eventId, status) {
        try {
            const command = new UpdateCommand({
                TableName: this.tableName,
                Key: {
                    guild_id: guildId,
                    event_id: eventId
                },
                UpdateExpression: 'SET reminder_status = :status, updated_at = :now',
                ExpressionAttributeValues: {
                    ':status': status,
                    ':now': new Date().toISOString()
                }
            });

            await this.docClient.send(command);
            console.log(`Updated reminder status for event ${eventId}: ${status}`);
            
        } catch (error) {
            console.error(`Error updating reminder status for event ${eventId}:`, error);
            throw error;
        }
    }

    /**
     * Delete event
     */
    async deleteEvent(guildId, eventId) {
        try {
            const command = new DeleteCommand({
                TableName: this.tableName,
                Key: {
                    guild_id: guildId,
                    event_id: eventId
                }
            });

            await this.docClient.send(command);
            console.log(`Deleted event ${eventId}`);
            
        } catch (error) {
            console.error(`Error deleting event ${eventId}:`, error);
            throw error;
        }
    }

    /**
     * Get all events for guild (with pagination)
     */
    async getAllEvents(guildId, limit = 50, lastEvaluatedKey = null) {
        try {
            const queryParams = {
                TableName: this.tableName,
                KeyConditionExpression: 'guild_id = :guildId',
                ExpressionAttributeValues: {
                    ':guildId': guildId
                },
                Limit: limit,
                ScanIndexForward: false // Most recent first
            };
            
            // Only add ExclusiveStartKey if it's not null
            if (lastEvaluatedKey) {
                queryParams.ExclusiveStartKey = lastEvaluatedKey;
            }
            
            const command = new QueryCommand(queryParams);

            const result = await this.docClient.send(command);
            
            return {
                events: result.Items || [],
                lastEvaluatedKey: result.LastEvaluatedKey
            };
            
        } catch (error) {
            console.error('Error getting all events:', error);
            return { events: [], lastEvaluatedKey: null };
        }
    }

    /**
     * Get upcoming events for a specific region (next 3, includes events up to 1h after start)
     */
    async getUpcomingEventsByRegion(guildId, region, limit = 3) {
        try {
            // Show events up to 1 hour after they started
            const cutoffTime = new Date(Date.now() - (1 * 60 * 60 * 1000)).toISOString();
            
            // Use date-index to efficiently query by date range, then filter by region
            const command = new QueryCommand({
                TableName: this.tableName,
                IndexName: 'date-index',
                KeyConditionExpression: 'guild_id = :guildId AND event_date >= :cutoffTime',
                FilterExpression: '#region = :region',
                ExpressionAttributeNames: {
                    '#region': 'region'
                },
                ExpressionAttributeValues: {
                    ':guildId': guildId,
                    ':region': region,
                    ':cutoffTime': cutoffTime
                },
                ScanIndexForward: true // Earliest first
            });

            const result = await this.docClient.send(command);
            const items = result.Items || [];
            
            // Sort by event_date and limit to requested number
            return items
                .sort((a, b) => a.event_date.localeCompare(b.event_date))
                .slice(0, limit);
            
        } catch (error) {
            console.error(`Error getting upcoming events for region ${region}:`, error);
            return [];
        }
    }

    /**
     * Get upcoming events for a specific location (next 3, includes events up to 1h after start)
     */
    async getUpcomingEventsByLocation(guildId, location, limit = 3) {
        try {
            // Show events up to 1 hour after they started
            const cutoffTime = new Date(Date.now() - (1 * 60 * 60 * 1000)).toISOString();
            
            // Use date-index to efficiently query by date range, then filter by location
            const command = new QueryCommand({
                TableName: this.tableName,
                IndexName: 'date-index',
                KeyConditionExpression: 'guild_id = :guildId AND event_date >= :cutoffTime',
                FilterExpression: '#location = :location',
                ExpressionAttributeNames: {
                    '#location': 'location'
                },
                ExpressionAttributeValues: {
                    ':guildId': guildId,
                    ':location': location,
                    ':cutoffTime': cutoffTime
                },
                ScanIndexForward: true
            });

            const result = await this.docClient.send(command);
            
            // Sort by event date since we can't use an index for location + date
            const sortedEvents = (result.Items || []).sort((a, b) => 
                new Date(a.event_date) - new Date(b.event_date)
            );
            
            return sortedEvents.slice(0, limit);
            
        } catch (error) {
            console.error(`Error getting upcoming events for location ${location}:`, error);
            return [];
        }
    }
}

module.exports = EventStorage;