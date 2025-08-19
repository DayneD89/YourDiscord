const EventStorage = require('../../src/storage/EventStorage');

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: jest.fn()
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: jest.fn()
    },
    PutCommand: jest.fn(),
    GetCommand: jest.fn(),
    QueryCommand: jest.fn(),
    UpdateCommand: jest.fn(),
    DeleteCommand: jest.fn()
}));

jest.mock('uuid', () => ({
    v4: jest.fn(() => 'mock-uuid-123')
}));

// Import mocked commands for testing
const { QueryCommand } = require('@aws-sdk/lib-dynamodb');

describe('EventStorage', () => {
    let eventStorage;
    let mockDocClient;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock DynamoDB document client
        mockDocClient = {
            send: jest.fn()
        };

        const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
        DynamoDBDocumentClient.from.mockReturnValue(mockDocClient);

        eventStorage = new EventStorage('test-events-table', 'us-west-2');
    });

    describe('constructor', () => {
        test('should initialize with correct table name', () => {
            expect(eventStorage.tableName).toBe('test-events-table');
        });

        test('should use default table name from environment', () => {
            process.env.DYNAMODB_EVENTS_TABLE = 'env-table';
            const storage = new EventStorage();
            expect(storage.tableName).toBe('env-table');
            delete process.env.DYNAMODB_EVENTS_TABLE;
        });

        test('should use fallback table name', () => {
            const storage = new EventStorage();
            expect(storage.tableName).toBe('discord-events-main');
        });
    });

    describe('createEvent', () => {
        const eventData = {
            name: 'Community Meeting',
            region: 'London',
            location: 'Central London',
            eventDate: '2024-12-25 18:00',
            description: 'Test meeting',
            createdBy: 'user123'
        };

        test('should create event successfully', async () => {
            mockDocClient.send.mockResolvedValue({});

            const result = await eventStorage.createEvent('guild123', eventData);

            expect(mockDocClient.send).toHaveBeenCalled();
            expect(result.event_id).toBe('mock-uuid-123');
            expect(result.guild_id).toBe('guild123');
            expect(result.name).toBe('Community Meeting');
            expect(result.reminder_status).toBe('pending');
        });

        test('should handle DynamoDB errors', async () => {
            mockDocClient.send.mockRejectedValue(new Error('DynamoDB error'));

            await expect(eventStorage.createEvent('guild123', eventData))
                .rejects.toThrow('Failed to create event');
        });
    });

    describe('getEvent', () => {
        test('should retrieve event successfully', async () => {
            const expectedEvent = { guild_id: 'guild123', event_id: 'event123', name: 'Test Event' };
            mockDocClient.send.mockResolvedValue({ Item: expectedEvent });

            const result = await eventStorage.getEvent('guild123', 'event123');

            expect(mockDocClient.send).toHaveBeenCalled();
            expect(result).toBe(expectedEvent);
        });

        test('should return null when event not found', async () => {
            mockDocClient.send.mockResolvedValue({});

            const result = await eventStorage.getEvent('guild123', 'event123');
            expect(result).toBeNull();
        });

        test('should handle errors', async () => {
            mockDocClient.send.mockRejectedValue(new Error('DynamoDB error'));

            await expect(eventStorage.getEvent('guild123', 'event123'))
                .rejects.toThrow('DynamoDB error');
        });
    });

    describe('getEventsByRegion', () => {
        test('should query events by region successfully', async () => {
            const expectedEvents = [{ guild_id: 'guild123', event_id: 'event1', region: 'London' }];
            mockDocClient.send.mockResolvedValue({ Items: expectedEvents });

            const result = await eventStorage.getEventsByRegion('guild123', 'London');

            expect(mockDocClient.send).toHaveBeenCalled();
            expect(result).toBe(expectedEvents);
        });

        test('should return empty array on error', async () => {
            mockDocClient.send.mockRejectedValue(new Error('Query error'));

            const result = await eventStorage.getEventsByRegion('guild123', 'London');
            expect(result).toEqual([]);
        });
    });

    describe('getUpcomingEvents', () => {
        test('should query upcoming events successfully', async () => {
            const expectedEvents = [{ guild_id: 'guild123', event_id: 'event1' }];
            mockDocClient.send.mockResolvedValue({ Items: expectedEvents });

            const result = await eventStorage.getUpcomingEvents('guild123');

            expect(mockDocClient.send).toHaveBeenCalled();
            expect(result).toBe(expectedEvents);
        });

        test('should return empty array on error', async () => {
            mockDocClient.send.mockRejectedValue(new Error('Query error'));

            const result = await eventStorage.getUpcomingEvents('guild123');
            expect(result).toEqual([]);
        });
    });

    describe('updateReminderStatus', () => {
        test('should update reminder status successfully', async () => {
            mockDocClient.send.mockResolvedValue({});

            await eventStorage.updateReminderStatus('guild123', 'event123', 'week_sent');

            expect(mockDocClient.send).toHaveBeenCalled();
        });

        test('should handle errors', async () => {
            mockDocClient.send.mockRejectedValue(new Error('Update error'));

            await expect(eventStorage.updateReminderStatus('guild123', 'event123', 'week_sent'))
                .rejects.toThrow('Update error');
        });
    });

    describe('deleteEvent', () => {
        test('should delete event successfully', async () => {
            mockDocClient.send.mockResolvedValue({});

            await eventStorage.deleteEvent('guild123', 'event123');

            expect(mockDocClient.send).toHaveBeenCalled();
        });

        test('should handle errors', async () => {
            mockDocClient.send.mockRejectedValue(new Error('Delete error'));

            await expect(eventStorage.deleteEvent('guild123', 'event123'))
                .rejects.toThrow('Delete error');
        });
    });

    describe('getAllEvents', () => {
        test('should get all events successfully', async () => {
            const expectedEvents = [{ guild_id: 'guild123', event_id: 'event1' }];
            const lastKey = { guild_id: 'guild123', event_id: 'event1' };
            mockDocClient.send.mockResolvedValue({ Items: expectedEvents, LastEvaluatedKey: lastKey });

            const result = await eventStorage.getAllEvents('guild123');

            expect(mockDocClient.send).toHaveBeenCalled();
            expect(result.events).toBe(expectedEvents);
            expect(result.lastEvaluatedKey).toBe(lastKey);
        });

        test('should handle pagination with lastEvaluatedKey', async () => {
            const expectedEvents = [{ guild_id: 'guild123', event_id: 'event2' }];
            const lastKey = { guild_id: 'guild123', event_id: 'event2' };
            const startKey = { guild_id: 'guild123', event_id: 'event1' };
            mockDocClient.send.mockResolvedValue({ Items: expectedEvents, LastEvaluatedKey: lastKey });

            const result = await eventStorage.getAllEvents('guild123', 50, startKey);

            expect(mockDocClient.send).toHaveBeenCalled();
            expect(result.events).toBe(expectedEvents);
            expect(result.lastEvaluatedKey).toBe(lastKey);
        });

        test('should return empty result on error', async () => {
            mockDocClient.send.mockRejectedValue(new Error('Query error'));

            const result = await eventStorage.getAllEvents('guild123');
            expect(result).toEqual({ events: [], lastEvaluatedKey: null });
        });
    });

    describe('getUpcomingEventsByRegion', () => {
        test('should get upcoming events for region successfully', async () => {
            const mockEvents = [
                { 
                    guild_id: 'guild123', 
                    event_id: 'event1', 
                    region: 'London', 
                    event_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                },
                { 
                    guild_id: 'guild123', 
                    event_id: 'event2', 
                    region: 'London', 
                    event_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
                }
            ];

            mockDocClient.send.mockResolvedValue({ Items: mockEvents });

            const result = await eventStorage.getUpcomingEventsByRegion('guild123', 'London');

            expect(result).toEqual(mockEvents);
            expect(QueryCommand).toHaveBeenCalledWith({
                TableName: 'test-events-table',
                IndexName: 'date-index',
                KeyConditionExpression: 'guild_id = :guildId AND event_date >= :cutoffTime',
                FilterExpression: '#region = :region',
                ExpressionAttributeNames: {
                    '#region': 'region'
                },
                ExpressionAttributeValues: {
                    ':guildId': 'guild123',
                    ':region': 'London',
                    ':cutoffTime': expect.any(String)
                },
                ScanIndexForward: true
            });
        });

        test('should use custom limit when provided', async () => {
            const mockEvents = [];
            mockDocClient.send.mockResolvedValue({ Items: mockEvents });

            await eventStorage.getUpcomingEventsByRegion('guild123', 'London', 5);

            expect(QueryCommand).toHaveBeenCalledWith(expect.objectContaining({
                IndexName: 'date-index',
                KeyConditionExpression: 'guild_id = :guildId AND event_date >= :cutoffTime'
            }));
        });

        test('should return empty array on error', async () => {
            mockDocClient.send.mockRejectedValue(new Error('Query error'));

            const result = await eventStorage.getUpcomingEventsByRegion('guild123', 'London');
            
            expect(result).toEqual([]);
        });
    });

    describe('getUpcomingEventsByLocation', () => {
        test('should get upcoming events for location successfully', async () => {
            const mockEvents = [
                { 
                    guild_id: 'guild123', 
                    event_id: 'event1', 
                    location: 'Manchester', 
                    event_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
                },
                { 
                    guild_id: 'guild123', 
                    event_id: 'event2', 
                    location: 'Manchester', 
                    event_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                }
            ];

            mockDocClient.send.mockResolvedValue({ Items: mockEvents });

            const result = await eventStorage.getUpcomingEventsByLocation('guild123', 'Manchester');

            // Should be sorted by event date (earlier first)
            expect(result[0].event_id).toBe('event2'); // 24h from now, earlier
            expect(result[1].event_id).toBe('event1'); // 48h from now, later
            
            expect(QueryCommand).toHaveBeenCalledWith({
                TableName: 'test-events-table',
                IndexName: 'date-index',
                KeyConditionExpression: 'guild_id = :guildId AND event_date >= :cutoffTime',
                FilterExpression: '#location = :location',
                ExpressionAttributeNames: {
                    '#location': 'location'
                },
                ExpressionAttributeValues: {
                    ':guildId': 'guild123',
                    ':location': 'Manchester',
                    ':cutoffTime': expect.any(String)
                },
                ScanIndexForward: true
            });
        });

        test('should limit results when more than limit returned', async () => {
            // Create more events than the default limit of 3
            const mockEvents = Array.from({ length: 5 }, (_, i) => ({
                guild_id: 'guild123',
                event_id: `event${i}`,
                location: 'Manchester',
                event_date: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString()
            }));

            mockDocClient.send.mockResolvedValue({ Items: mockEvents });

            const result = await eventStorage.getUpcomingEventsByLocation('guild123', 'Manchester');

            // Should only return 3 events (the default limit)
            expect(result).toHaveLength(3);
            expect(result[0].event_id).toBe('event0'); // Earliest event first
        });

        test('should use custom limit when provided', async () => {
            const mockEvents = [];
            mockDocClient.send.mockResolvedValue({ Items: mockEvents });

            await eventStorage.getUpcomingEventsByLocation('guild123', 'Manchester', 5);

            expect(QueryCommand).toHaveBeenCalledWith(expect.objectContaining({
                IndexName: 'date-index',
                KeyConditionExpression: 'guild_id = :guildId AND event_date >= :cutoffTime'
            }));
        });

        test('should return empty array on error', async () => {
            mockDocClient.send.mockRejectedValue(new Error('Query error'));

            const result = await eventStorage.getUpcomingEventsByLocation('guild123', 'Manchester');
            
            expect(result).toEqual([]);
        });

        test('should handle empty items array from DynamoDB', async () => {
            mockDocClient.send.mockResolvedValue({ Items: null });

            const result = await eventStorage.getUpcomingEventsByLocation('guild123', 'Manchester');
            
            expect(result).toEqual([]);
        });
    });
});