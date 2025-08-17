const AWS = require('aws-sdk');
const ProposalStorage = require('./ProposalStorage');
const DynamoProposalStorage = require('./DynamoProposalStorage');

// Migration script to transfer proposal data from S3 to DynamoDB
// This enables the hybrid storage approach while preserving existing data
// Run this script once after deploying the DynamoDB infrastructure
class ProposalMigration {
    constructor() {
        this.s3Storage = new ProposalStorage();
        this.dynamoStorage = new DynamoProposalStorage();
        this.migrationResults = {
            total: 0,
            migrated: 0,
            skipped: 0,
            errors: []
        };
    }

    async migrateProposals(s3Bucket, dynamoTable, guildId) {
        console.log('🔄 Starting proposal migration from S3 to DynamoDB...');
        console.log(`S3 Bucket: ${s3Bucket}`);
        console.log(`DynamoDB Table: ${dynamoTable}`);
        console.log(`Guild ID: ${guildId}`);
        
        try {
            // Initialize both storage systems
            await this.s3Storage.initialize(s3Bucket, guildId);
            await this.dynamoStorage.initialize(dynamoTable, guildId);
            
            // Load all proposals from S3
            console.log('📥 Loading proposals from S3...');
            const s3Proposals = this.s3Storage.getAllProposals();
            this.migrationResults.total = s3Proposals.length;
            
            if (s3Proposals.length === 0) {
                console.log('✅ No proposals found in S3. Migration complete.');
                return this.migrationResults;
            }
            
            console.log(`Found ${s3Proposals.length} proposals in S3`);
            
            // Migrate each proposal
            for (const proposal of s3Proposals) {
                await this.migrateProposal(proposal);
            }
            
            console.log('📊 Migration Summary:');
            console.log(`  Total proposals: ${this.migrationResults.total}`);
            console.log(`  Successfully migrated: ${this.migrationResults.migrated}`);
            console.log(`  Skipped (already exist): ${this.migrationResults.skipped}`);
            console.log(`  Errors: ${this.migrationResults.errors.length}`);
            
            if (this.migrationResults.errors.length > 0) {
                console.log('❌ Errors encountered:');
                this.migrationResults.errors.forEach((error, index) => {
                    console.log(`  ${index + 1}. ${error.messageId}: ${error.error}`);
                });
            }
            
            return this.migrationResults;
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        }
    }

    async migrateProposal(s3Proposal) {
        try {
            // Extract message ID from S3 proposal data structure
            const messageId = s3Proposal.voteMessageId || s3Proposal.originalMessageId;
            
            if (!messageId) {
                console.warn(`⚠️ Skipping proposal without message ID:`, s3Proposal);
                this.migrationResults.errors.push({
                    messageId: 'unknown',
                    error: 'No message ID found'
                });
                return;
            }
            
            // Check if proposal already exists in DynamoDB
            const existingProposal = await this.dynamoStorage.getProposal(messageId);
            if (existingProposal) {
                console.log(`⏭️ Skipping ${messageId} - already exists in DynamoDB`);
                this.migrationResults.skipped++;
                return;
            }
            
            // Transform S3 proposal format to DynamoDB format
            const dynamoProposal = this.transformProposal(s3Proposal);
            
            // Add proposal to DynamoDB
            await this.dynamoStorage.addProposal(messageId, dynamoProposal);
            
            console.log(`✅ Migrated proposal: ${messageId}`);
            this.migrationResults.migrated++;
            
        } catch (error) {
            console.error(`❌ Failed to migrate proposal:`, error);
            this.migrationResults.errors.push({
                messageId: s3Proposal.voteMessageId || s3Proposal.originalMessageId || 'unknown',
                error: error.message
            });
        }
    }

    // Transform S3 proposal format to DynamoDB format
    // Maps old camelCase fields to new snake_case schema
    transformProposal(s3Proposal) {
        const baseProposal = {
            // Map old fields to new DynamoDB schema
            original_message_id: s3Proposal.originalMessageId,
            original_channel_id: s3Proposal.originalChannelId,
            vote_message_id: s3Proposal.voteMessageId,
            vote_channel_id: s3Proposal.voteChannelId,
            author_id: s3Proposal.authorId,
            content: s3Proposal.content,
            proposal_type: s3Proposal.proposalType,
            is_withdrawal: s3Proposal.isWithdrawal || false,
            target_resolution: s3Proposal.targetResolution || null,
            status: s3Proposal.status,
            start_time: s3Proposal.startTime,
            end_time: s3Proposal.endTime,
            yes_votes: s3Proposal.yesVotes || 0,
            no_votes: s3Proposal.noVotes || 0,
            
            // Preserve completed proposal data
            final_yes: s3Proposal.finalYes,
            final_no: s3Proposal.finalNo,
            completed_at: s3Proposal.completedAt,
            
            // Migration metadata
            migrated_from_s3: true,
            migration_date: new Date().toISOString()
        };

        // Clean up undefined values
        Object.keys(baseProposal).forEach(key => {
            if (baseProposal[key] === undefined) {
                delete baseProposal[key];
            }
        });

        return baseProposal;
    }

    // Verify migration by comparing counts
    async verifyMigration(s3Bucket, dynamoTable, guildId) {
        console.log('🔍 Verifying migration...');
        
        try {
            // Initialize both storage systems
            await this.s3Storage.initialize(s3Bucket, guildId);
            await this.dynamoStorage.initialize(dynamoTable, guildId);
            
            // Count proposals in both systems
            const s3Count = this.s3Storage.getAllProposals().length;
            const dynamoProposals = await this.dynamoStorage.getAllProposals();
            const dynamoCount = dynamoProposals.length;
            const migratedCount = dynamoProposals.filter(p => p.migrated_from_s3).length;
            
            console.log('📊 Verification Results:');
            console.log(`  S3 proposals: ${s3Count}`);
            console.log(`  DynamoDB proposals: ${dynamoCount}`);
            console.log(`  Migrated from S3: ${migratedCount}`);
            
            const verification = {
                s3Count,
                dynamoCount,
                migratedCount,
                allMigrated: s3Count === migratedCount,
                hasNewProposals: dynamoCount > migratedCount
            };
            
            if (verification.allMigrated) {
                console.log('✅ All S3 proposals successfully migrated to DynamoDB');
            } else {
                console.log(`⚠️ Migration incomplete: ${s3Count - migratedCount} proposals missing`);
            }
            
            if (verification.hasNewProposals) {
                console.log(`ℹ️ DynamoDB contains ${dynamoCount - migratedCount} new proposals created after migration`);
            }
            
            return verification;
            
        } catch (error) {
            console.error('❌ Verification failed:', error);
            throw error;
        }
    }

    // Backup S3 proposals before migration
    async backupS3Proposals(s3Bucket, guildId, backupPath = './s3-proposals-backup.json') {
        console.log('💾 Creating backup of S3 proposals...');
        
        try {
            await this.s3Storage.initialize(s3Bucket, guildId);
            const proposals = this.s3Storage.getAllProposals();
            
            const backup = {
                guildId,
                backupDate: new Date().toISOString(),
                proposalCount: proposals.length,
                proposals
            };
            
            const fs = require('fs').promises;
            await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));
            
            console.log(`✅ Backup created: ${backupPath} (${proposals.length} proposals)`);
            return backupPath;
            
        } catch (error) {
            console.error('❌ Backup failed:', error);
            throw error;
        }
    }
}

// CLI usage for manual migration
if (require.main === module) {
    const migration = new ProposalMigration();
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
        console.log('Usage: node MigrationScript.js <s3-bucket> <dynamo-table> <guild-id> [command]');
        console.log('Commands:');
        console.log('  migrate (default) - Migrate proposals from S3 to DynamoDB');
        console.log('  verify - Verify migration results');
        console.log('  backup - Create backup of S3 proposals');
        process.exit(1);
    }
    
    const [s3Bucket, dynamoTable, guildId, command = 'migrate'] = args;
    
    (async () => {
        try {
            switch (command) {
                case 'migrate':
                    await migration.migrateProposals(s3Bucket, dynamoTable, guildId);
                    break;
                case 'verify':
                    await migration.verifyMigration(s3Bucket, dynamoTable, guildId);
                    break;
                case 'backup':
                    await migration.backupS3Proposals(s3Bucket, guildId);
                    break;
                default:
                    console.error(`Unknown command: ${command}`);
                    process.exit(1);
            }
        } catch (error) {
            console.error('Migration script failed:', error);
            process.exit(1);
        }
    })();
}

module.exports = ProposalMigration;