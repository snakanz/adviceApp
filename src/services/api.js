import { supabase } from '../lib/supabase';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';

class ApiService {
    constructor() {
        this.baseUrl = API_BASE_URL;
    }

    async getToken() {
        // Get token from Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token || null;
    }

    // Legacy method for backward compatibility
    setToken(token) {
        console.warn('setToken() is deprecated. Tokens are now managed by Supabase Auth.');
        // No-op - tokens are managed by Supabase
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}/api${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Get token from Supabase session
        const token = await this.getToken();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 401) {
                    console.warn('⚠️ 401 Unauthorized response from:', endpoint);

                    // Check if we have a valid session before signing out
                    const { data: { session } } = await supabase.auth.getSession();

                    if (!session) {
                        // No session - redirect to login
                        console.log('❌ No session found, redirecting to login');
                        window.location.href = '/login';
                    } else {
                        // We have a session but got 401 - this might be a backend issue
                        // Don't sign out automatically, just log the error
                        console.error('❌ 401 error despite having valid session. Backend may not recognize token yet.');
                    }

                    throw new Error('Unauthorized');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Auth endpoints
    async getGoogleAuthUrl() {
        return this.request('/calendar/auth/google');
    }

    async verifyToken() {
        return this.request('/auth/verify');
    }

    // Meetings endpoints
    async getMeetings() {
        return this.request('/calendar/meetings');
    }

    async getMeetingDetails(eventId) {
        return this.request(`/calendar/meetings/${eventId}`);
    }

    async addMeetingNotes(eventId, notes) {
        return this.request(`/calendar/meetings/${eventId}/notes`, {
            method: 'POST',
            body: JSON.stringify({ notes })
        });
    }

    async uploadMeetingAttachment(eventId, imageText) {
        return this.request(`/calendar/meetings/${eventId}/attachments`, {
            method: 'POST',
            body: JSON.stringify({ imageText })
        });
    }

    async uploadMeetingTranscript(eventId, transcript) {
        return this.request(`/calendar/meetings/${eventId}/transcript`, {
            method: 'POST',
            body: JSON.stringify({ transcript })
        });
    }

    async uploadMeetingAudio(eventId, audioFile) {
        const formData = new FormData();
        formData.append('audio', audioFile);
        const url = `${this.baseUrl}/calendar/meetings/${eventId}/transcript`;
        const headers = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: formData
        });
        if (!response.ok) throw new Error('Failed to upload audio');
        return response.json();
    }

    async getMeetingTranscript(eventId) {
        return this.request(`/calendar/meetings/${eventId}/transcript`);
    }

    async autoGenerateSummaries(eventId, forceRegenerate = false) {
        return this.request(`/calendar/meetings/${eventId}/auto-generate-summaries`, {
            method: 'POST',
            body: JSON.stringify({ forceRegenerate })
        });
    }

    // Ask Advicly endpoints
    async getThreads() {
        return this.request('/ask-advicly/threads');
    }

    async getThreadMessages(threadId) {
        return this.request(`/ask-advicly/threads/${threadId}/messages`);
    }

    async createThread(clientId = null, title = 'New Conversation') {
        return this.request('/ask-advicly/threads', {
            method: 'POST',
            body: JSON.stringify({ clientId, title })
        });
    }

    async sendMessage(threadId, content) {
        return this.request(`/ask-advicly/threads/${threadId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });
    }

    async updateThreadTitle(threadId, title) {
        return this.request(`/ask-advicly/threads/${threadId}`, {
            method: 'PATCH',
            body: JSON.stringify({ title })
        });
    }

    async getClientsForMentions() {
        return this.request('/ask-advicly/clients');
    }

    // Client avatar upload
    async uploadClientAvatar(clientId, file) {
        const formData = new FormData();
        formData.append('avatar', file);

        return this.request(`/clients/${clientId}/avatar`, {
            method: 'POST',
            body: formData,
            headers: {} // Remove Content-Type to let browser set it for FormData
        });
    }

    // Extract clients from meeting attendees
    async extractClientsFromMeetings() {
        return this.request('/clients/extract-clients', {
            method: 'POST'
        });
    }

    // Calendly endpoints
    async getCalendlyStatus() {
        return this.request('/calendly/status');
    }

    async syncCalendlyMeetings() {
        return this.request('/calendly/sync', {
            method: 'POST'
        });
    }

    async testCalendlyConnection() {
        return this.request('/calendly/test-connection');
    }

    async getCalendlyMeetings() {
        return this.request('/calendly/meetings');
    }

    async getIntegrationStats() {
        return this.request('/calendly/stats');
    }
}

export const api = new ApiService();
export default api; // Default export for backward compatibility

export const adjustMeetingSummary = async (originalSummary, adjustmentPrompt) => {
  try {
    const response = await fetch(`${API_BASE_URL}/ai/adjust-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': api.token ? `Bearer ${api.token}` : '',
      },
      body: JSON.stringify({
        originalSummary,
        adjustmentPrompt,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to adjust summary');
    }

    const data = await response.json();
    return data.adjustedSummary;
  } catch (error) {
    console.error('Error adjusting summary:', error);
    throw error;
  }
}; 