const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

class ApiService {
    constructor() {
        this.baseUrl = API_BASE_URL;
        this.token = localStorage.getItem('jwt');
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('jwt', token);
        } else {
            localStorage.removeItem('jwt');
        }
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}/api${endpoint}`;
        const headers = {
    'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.setToken(null);
                    window.location.href = '/login';
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
}

export const api = new ApiService();

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

export const improveTemplate = async (template, improvement) => {
  try {
    const response = await fetch(`${API_BASE_URL}/ai/improve-template`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': api.token ? `Bearer ${api.token}` : '',
      },
      body: JSON.stringify({
        template,
        improvement,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to improve template');
    }

    const data = await response.json();
    return data.improvedTemplate;
  } catch (error) {
    console.error('Error improving template:', error);
    throw error;
  }
};

export const generateAISummary = async (transcript) => {
  try {
    const response = await fetch(`${API_BASE_URL}/calendar/generate-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': api.token ? `Bearer ${api.token}` : '',
      },
      body: JSON.stringify({
        transcript,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate AI summary');
    }

    const data = await response.json();
    return data.summary;
  } catch (error) {
    console.error('Error generating AI summary:', error);
    throw error;
  }
}; 