const AWS = require('aws-sdk');

class ProposalStorage {
    constructor() {
        this.s3 = new AWS.S3();
        this.proposals = new Map();
        this.bucketName = null;
        this.proposalsKey = null;
    }

    async initialize(bucketName, guildId) {
        this.bucketName = bucketName || process.env.S3_BUCKET || 'your-default-bucket';
        this.proposalsKey = `bot/proposals-${guildId}.json`;
        console.log(`Proposals S3 Key: ${this.proposalsKey}`);
        await this.loadProposals();
    }

    async loadProposals() {
        try {
            console.log('Loading proposals from S3...');
            const response = await this.s3.getObject({
                Bucket: this.bucketName,
                Key: this.proposalsKey
            }).promise();
            
            const proposalsData = JSON.parse(response.Body.toString());
            this.proposals = new Map(Object.entries(proposalsData));
            console.log(`✅ Loaded ${this.proposals.size} proposals from S3`);
        } catch (error) {
            if (error.code === 'NoSuchKey') {
                console.log('No existing proposals found in S3');
                this.proposals = new Map();
            } else {
                console.error('Error loading proposals from S3:', error);
                this.proposals = new Map();
            }
        }
    }

    async saveProposals() {
        try {
            console.log('Saving proposals to S3...');
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