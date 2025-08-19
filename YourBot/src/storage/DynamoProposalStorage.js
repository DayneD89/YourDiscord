const { DynamoDBClient, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

/**
 * DynamoProposalStorage - Persistent storage for proposal and voting data
 * 
 * Provides structured, queryable storage for the democratic governance system.
 * Uses AWS DynamoDB for scalability, consistency, and advanced querying capabilities.
 * 
 * Storage architecture rationale:
 * - DynamoDB chosen over S3 for dynamic data due to ACID transactions and query flexibility
 * - Guild-based partitioning ensures data isolation between Discord servers
 * - Index-based querying enables efficient lookups by status, type, and expiration
 * - AWS SDK v3 provides modern async/await patterns and improved performance
 * 
 * Data model:
 * - Primary key: guild_id (partition) + message_id (sort)
 * - Indexes: status-index, type-index, end-time-index for efficient queries
 * - Support for proposal lifecycle: pending → voting → passed/failed
 */
class DynamoProposalStorage {
    constructor() {
        // Initialize AWS SDK v3 clients
        const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-west-2';
        
        this.dynamodbClient = new DynamoDBClient({ region });
        this.dynamodb = DynamoDBDocumentClient.from(this.dynamodbClient);
        this.tableName = null;
        this.guildId = null;
    }

    /**
     * Initialize DynamoDB storage with deployment-specific configuration
     * 
     * Sets up the connection to DynamoDB and verifies table accessibility.
     * Table name comes from Terraform outputs to ensure environment isolation.
     * 
     * @param {string} tableName - DynamoDB table name from deployment
     * @param {string} guildId - Discord guild ID for data partitioning
     */
    async initialize(tableName, guildId) {
        // Use table name from deployment configuration, with fallbacks for development
        // Production deployments provide this via Terraform outputs
        this.tableName = tableName || process.env.DYNAMODB_PROPOSALS_TABLE || 'discord-proposals-main';
        this.guildId = guildId;
        
        console.log(`DynamoDB Table: ${this.tableName}`);
        console.log(`Guild ID: ${this.guildId}`);
        
        // Verify table exists and is accessible
        await this.verifyTableAccess();
    }

    // Verify DynamoDB table exists and bot has access
    // Provides early error detection during initialization
    async verifyTableAccess() {
        try {
            console.log('Verifying DynamoDB table access...');
            await this.dynamodbClient.send(new DescribeTableCommand({ TableName: this.tableName }));
            console.log('✅ DynamoDB table access verified');
        } catch (error) {
            console.error('❌ DynamoDB table access failed:', error);
            throw new Error(`Cannot access DynamoDB table ${this.tableName}: ${error.message}`);
        }
    }

    // Add new proposal to DynamoDB with TTL for automatic cleanup
    // Creates structured record with all voting metadata
    async addProposal(messageId, proposalData) {
        try {
            console.log(`Adding proposal ${messageId} to DynamoDB...`);
            
            // Calculate TTL (90 days from now) for automatic cleanup
            const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);
            
            const item = {
                guild_id: this.guildId,
                message_id: messageId,
                ttl: ttl,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...proposalData
            };

            await this.dynamodb.send(new PutCommand({
                TableName: this.tableName,
                Item: item,
                // Prevent overwriting existing proposals
                ConditionExpression: 'attribute_not_exists(message_id)'
            }));

            console.log(`✅ Proposal ${messageId} added to DynamoDB`);
        } catch (error) {
            if (error.code === 'ConditionalCheckFailedException') {
                console.error(`Proposal ${messageId} already exists in DynamoDB`);
                throw new Error(`Proposal ${messageId} already exists`);
            }
            console.error('Error adding proposal to DynamoDB:', error);
            throw error;
        }
    }

    // Retrieve specific proposal by message ID
    // Uses partition key + sort key for efficient single-item lookup
    async getProposal(messageId) {
        try {
            const result = await this.dynamodb.send(new GetCommand({
                TableName: this.tableName,
                Key: {
                    guild_id: this.guildId,
                    message_id: messageId
                }
            }));

            return result.Item || null;
        } catch (error) {
            console.error(`Error getting proposal ${messageId} from DynamoDB:`, error);
            return null;
        }
    }

    // Get all proposals for this guild
    // Uses guild_id partition key to retrieve all proposals efficiently
    async getAllProposals() {
        try {
            console.log('Loading all proposals from DynamoDB...');
            const result = await this.dynamodb.send(new QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: 'guild_id = :guildId',
                ExpressionAttributeValues: {
                    ':guildId': this.guildId
                }
            }));

            console.log(`✅ Loaded ${result.Items.length} proposals from DynamoDB`);
            return result.Items || [];
        } catch (error) {
            console.error('Error loading proposals from DynamoDB:', error);
            return [];
        }
    }

    // Get all active votes using the status index
    // Efficiently queries only proposals with 'voting' status
    async getActiveVotes() {
        try {
            const result = await this.dynamodb.send(new QueryCommand({
                TableName: this.tableName,
                IndexName: 'status-index',
                KeyConditionExpression: 'guild_id = :guildId AND #status = :status',
                ExpressionAttributeNames: {
                    '#status': 'status'  // 'status' is a reserved word in DynamoDB
                },
                ExpressionAttributeValues: {
                    ':guildId': this.guildId,
                    ':status': 'voting'
                }
            }));

            return result.Items || [];
        } catch (error) {
            console.error('Error getting active votes from DynamoDB:', error);
            return [];
        }
    }

    // Get proposals by type using the type index
    // Enables filtering by proposal type (policy, governance, etc.)
    async getProposalsByType(type) {
        try {
            const result = await this.dynamodb.send(new QueryCommand({
                TableName: this.tableName,
                IndexName: 'type-index',
                KeyConditionExpression: 'guild_id = :guildId AND proposal_type = :type',
                ExpressionAttributeValues: {
                    ':guildId': this.guildId,
                    ':type': type
                }
            }));

            return result.Items || [];
        } catch (error) {
            console.error(`Error getting proposals by type ${type} from DynamoDB:`, error);
            return [];
        }
    }

    // Update proposal with atomic operations
    // Safely updates vote counts and status without race conditions
    async updateProposal(messageId, updates) {
        try {
            console.log(`Updating proposal ${messageId} in DynamoDB...`);
            
            // Build update expression dynamically
            const updateExpressions = [];
            const expressionAttributeNames = {};
            const expressionAttributeValues = {};
            
            // Always update the timestamp
            updateExpressions.push('#updated_at = :updated_at');
            expressionAttributeNames['#updated_at'] = 'updated_at';
            expressionAttributeValues[':updated_at'] = new Date().toISOString();

            // Add each update field to the expression
            Object.keys(updates).forEach((key, index) => {
                const attributeName = `#attr${index}`;
                const valueName = `:val${index}`;
                
                updateExpressions.push(`${attributeName} = ${valueName}`);
                expressionAttributeNames[attributeName] = key;
                expressionAttributeValues[valueName] = updates[key];
            });

            await this.dynamodb.send(new UpdateCommand({
                TableName: this.tableName,
                Key: {
                    guild_id: this.guildId,
                    message_id: messageId
                },
                UpdateExpression: `SET ${updateExpressions.join(', ')}`,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                // Ensure proposal exists before updating
                ConditionExpression: 'attribute_exists(message_id)'
            }));

            console.log(`✅ Proposal ${messageId} updated in DynamoDB`);
        } catch (error) {
            if (error.code === 'ConditionalCheckFailedException') {
                console.error(`Proposal ${messageId} does not exist in DynamoDB`);
                throw new Error(`Proposal ${messageId} not found`);
            }
            console.error(`Error updating proposal ${messageId} in DynamoDB:`, error);
            throw error;
        }
    }

    // Get proposals nearing expiration for monitoring
    // Uses end-time index to efficiently find votes that need processing
    async getExpiringVotes(beforeTime) {
        try {
            const result = await this.dynamodb.send(new QueryCommand({
                TableName: this.tableName,
                IndexName: 'end-time-index',
                KeyConditionExpression: 'guild_id = :guildId AND end_time <= :endTime',
                FilterExpression: '#status = :status',
                ExpressionAttributeNames: {
                    '#status': 'status'
                },
                ExpressionAttributeValues: {
                    ':guildId': this.guildId,
                    ':endTime': beforeTime,
                    ':status': 'voting'
                }
            }));

            return result.Items || [];
        } catch (error) {
            console.error('Error getting expiring votes from DynamoDB:', error);
            return [];
        }
    }

    // Delete proposal (for testing or cleanup)
    // Provides safe deletion with existence check
    async deleteProposal(messageId) {
        try {
            console.log(`Deleting proposal ${messageId} from DynamoDB...`);
            
            await this.dynamodb.send(new DeleteCommand({
                TableName: this.tableName,
                Key: {
                    guild_id: this.guildId,
                    message_id: messageId
                },
                ConditionExpression: 'attribute_exists(message_id)'
            }));

            console.log(`✅ Proposal ${messageId} deleted from DynamoDB`);
        } catch (error) {
            if (error.code === 'ConditionalCheckFailedException') {
                console.error(`Proposal ${messageId} does not exist in DynamoDB`);
                throw new Error(`Proposal ${messageId} not found`);
            }
            console.error(`Error deleting proposal ${messageId} from DynamoDB:`, error);
            throw error;
        }
    }

    // Get statistics about proposals for monitoring
    // Provides insights into voting activity and proposal patterns
    async getProposalStats() {
        try {
            const allProposals = await this.getAllProposals();
            
            const stats = {
                total: allProposals.length,
                active: allProposals.filter(p => p.status === 'voting').length,
                passed: allProposals.filter(p => p.status === 'passed').length,
                failed: allProposals.filter(p => p.status === 'failed').length,
                byType: {}
            };

            // Count by proposal type
            allProposals.forEach(proposal => {
                const type = proposal.proposal_type || 'unknown';
                stats.byType[type] = (stats.byType[type] || 0) + 1;
            });

            return stats;
        } catch (error) {
            console.error('Error getting proposal stats from DynamoDB:', error);
            return {
                total: 0,
                active: 0,
                passed: 0,
                failed: 0,
                byType: {}
            };
        }
    }
}

module.exports = DynamoProposalStorage;