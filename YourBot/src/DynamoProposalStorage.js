const AWS = require('aws-sdk');

// DynamoDB-backed storage for proposal and voting data
// Provides structured storage with efficient querying capabilities
// Replaces S3-based storage for dynamic data while keeping config in S3
class DynamoProposalStorage {
    constructor() {
        this.dynamodb = new AWS.DynamoDB.DocumentClient();
        this.tableName = null;
        this.guildId = null;
    }

    async initialize(tableName, guildId) {
        // Initialize DynamoDB storage with table name from Terraform output
        // Each guild's data is partitioned by guild_id for isolation
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
            await this.dynamodb.describeTable({ TableName: this.tableName }).promise();
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

            await this.dynamodb.put({
                TableName: this.tableName,
                Item: item,
                // Prevent overwriting existing proposals
                ConditionExpression: 'attribute_not_exists(message_id)'
            }).promise();

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
            const result = await this.dynamodb.get({
                TableName: this.tableName,
                Key: {
                    guild_id: this.guildId,
                    message_id: messageId
                }
            }).promise();

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
            const result = await this.dynamodb.query({
                TableName: this.tableName,
                KeyConditionExpression: 'guild_id = :guildId',
                ExpressionAttributeValues: {
                    ':guildId': this.guildId
                }
            }).promise();

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
            const result = await this.dynamodb.query({
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
            }).promise();

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
            const result = await this.dynamodb.query({
                TableName: this.tableName,
                IndexName: 'type-index',
                KeyConditionExpression: 'guild_id = :guildId AND proposal_type = :type',
                ExpressionAttributeValues: {
                    ':guildId': this.guildId,
                    ':type': type
                }
            }).promise();

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

            await this.dynamodb.update({
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
            }).promise();

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
            const result = await this.dynamodb.query({
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
            }).promise();

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
            
            await this.dynamodb.delete({
                TableName: this.tableName,
                Key: {
                    guild_id: this.guildId,
                    message_id: messageId
                },
                ConditionExpression: 'attribute_exists(message_id)'
            }).promise();

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