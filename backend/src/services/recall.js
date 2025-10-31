const axios = require('axios');

class RecallService {
    constructor() {
        this.apiKey = process.env.RECALL_API_KEY;
        this.baseUrl = 'https://us-west-2.recall.ai/api/v1';
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': `Token ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
    }

    async createBot(meetingUrl) {
        try {
            const response = await this.client.post('/bot', {
                url: meetingUrl
            });
            return response.data;
        } catch (error) {
            console.error('Error creating Recall.ai bot:', error);
            throw error;
        }
    }

    async getTranscript(botId) {
        try {
            const response = await this.client.get(`/transcript/${botId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching transcript:', error);
            throw error;
        }
    }

    async getMeetingMetadata(botId) {
        try {
            const response = await this.client.get(`/bot/${botId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching meeting metadata:', error);
            throw error;
        }
    }
}

module.exports = new RecallService(); 