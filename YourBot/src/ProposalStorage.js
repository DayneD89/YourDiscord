const AWS = require('aws-sdk');

// S3-backed storage for proposal and voting data
// Maintains proposal state across bot restarts and deployments
// Uses Map for efficient in-memory access with S3 for persistence
class ProposalStorage {
    constructor() {
        this.s3 = new AWS.S3();
        this.proposals = new Map();  // In-memory cache for fast access
        this.bucketName = null;      // S3 bucket for persistence
        this.proposalsKey = null;    // S3 object key for this guild's proposals
    }

    async initialize(bucketName, guildId) {
        this.bucketName = bucketName || process.env.S3_BUCKET || 'your-default-bucket';
        this.proposalsKey = `bot/proposals-${guildId}.json`;
        console.log(`Proposals S3 Key: ${this.proposalsKey}`);
        await this.loadProposals();
    }

    // Load all proposals from S3 into memory for fast access
    // Handles first-time setup gracefully when no proposals exist yet
    async loadProposals() {
        try {
            console.log('Loading proposals from S3...');
            const response = await this.s3.getObject({
                Bucket: this.bucketName,
                Key: this.proposalsKey
            }).promise();
            
            // Convert S3 object back to Map for efficient lookups
            const proposalsData = JSON.parse(response.Body.toString());
            this.proposals = new Map(Object.entries(proposalsData));
            console.log(`✅ Loaded ${this.proposals.size} proposals from S3`);
        } catch (error) {
            if (error.code === 'NoSuchKey') {
                // First-time setup - no proposals exist yet
                console.log('No existing proposals found in S3');
                this.proposals = new Map();
            } else {
                // S3 error - start with empty state to prevent bot failure
                console.error('Error loading proposals from S3:', error);
                this.proposals = new Map();
            }
        }
    }

    // Persist all proposals to S3 for durability across bot restarts
    // Converts Map to plain object for JSON serialization
    async saveProposals() {
        try {
            console.log('Saving proposals to S3...');
            // Convert Map to object for JSON storage
            const proposalsData = Object.fromEntries(this.proposals);
            
            await this.s3.putObject({
                Bucket: this.bucketName,
                Key: this.proposalsKey,
                Body: JSON.stringify(proposalsData, null, 2),
                ContentType: 'application/json',
                Metadata: {
                    'last-updated': new Date().toISOString()
                }
            }).promise();
            
            console.log(`Proposals saved to S3: ${this.proposals.size} items`);
        } catch (error) {
            console.error('Error saving proposals to S3:', error);
            throw error;
        }
    }

    addProposal(messageId, proposalData) {
        this.proposals.set(messageId, proposalData);
        return this.saveProposals();
    }

    getProposal(messageId) {
        return this.proposals.get(messageId);
    }

    getAllProposals() {
        return Array.from(this.proposals.values());
    }

    getActiveVotes() {
        return Array.from(this.proposals.values()).filter(p => p.status === 'voting');
    }

    getProposalsByType(type) {
        return Array.from(this.proposals.values()).filter(p => p.proposalType === type);
    }

    updateProposal(messageId, updates) {
        const proposal = this.proposals.get(messageId);
        if (proposal) {
            Object.assign(proposal, updates);
            return this.saveProposals();
        }
        return Promise.resolve();
    }
}

module.exports = ProposalStorage;