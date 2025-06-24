const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');
const recallService = require('./recall');

const prisma = new PrismaClient();

class CalendarService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  async getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  async handleCallback(code, userId) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      // Store tokens in database
      await prisma.calendarToken.upsert({
        where: { userId },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || undefined,
          expiresAt: new Date(tokens.expiry_date),
          provider: 'google'
        },
        create: {
          userId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: new Date(tokens.expiry_date),
          provider: 'google'
        }
      });

      return true;
    } catch (error) {
      console.error('Error handling calendar callback:', error);
      throw error;
    }
  }

  async createMeetingEvent(userId, meetingDetails) {
    try {
      const userTokens = await prisma.calendarToken.findUnique({
        where: { userId }
      });

      if (!userTokens) {
        throw new Error('User not connected to calendar');
      }

      this.oauth2Client.setCredentials({
        access_token: userTokens.accessToken,
        refresh_token: userTokens.refreshToken
      });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const event = {
        summary: meetingDetails.title,
        description: meetingDetails.description || '',
        start: {
          dateTime: new Date(meetingDetails.date + ' ' + meetingDetails.time).toISOString(),
          timeZone: 'UTC'
        },
        end: {
          dateTime: new Date(new Date(meetingDetails.date + ' ' + meetingDetails.time).getTime() + (meetingDetails.duration || 3600000)).toISOString(),
          timeZone: 'UTC'
        },
        conferenceData: {
          createRequest: {
            requestId: meetingDetails.id,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        }
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        conferenceDataVersion: 1
      });

      // Update meeting with calendar event ID
      await prisma.meeting.update({
        where: { id: meetingDetails.id },
        data: { calendarEventId: response.data.id }
      });

      // If this is a video meeting, register it with Recall.ai
      if (response.data.hangoutLink || response.data.conferenceData?.entryPoints?.[0]?.uri) {
        const meetingUrl = response.data.hangoutLink || response.data.conferenceData.entryPoints[0].uri;
        const recallBot = await recallService.createBot(meetingUrl);
        
        // Store the Recall.ai bot ID in our database
        await prisma.meeting.create({
          data: {
            userId,
            googleEventId: response.data.id,
            recallBotId: recallBot.id,
            startTime: new Date(response.data.start.dateTime),
            endTime: new Date(response.data.end.dateTime),
            title: response.data.summary,
            status: 'scheduled'
          }
        });
      }

      return response.data;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  }

  async listUpcomingMeetings(userId) {
    try {
      const userTokens = await prisma.calendarToken.findUnique({
        where: { userId }
      });

      if (!userTokens) {
        throw new Error('User not connected to calendar');
      }

      this.oauth2Client.setCredentials({
        access_token: userTokens.accessToken,
        refresh_token: userTokens.refreshToken
      });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime'
      });

      return response.data.items;
    } catch (error) {
      console.error('Error listing calendar events:', error);
      throw error;
    }
  }

  async listMeetingsWithRecentPast(userId) {
    try {
      const userTokens = await prisma.calendarToken.findUnique({
        where: { userId }
      });

      if (!userTokens) {
        throw new Error('User not connected to calendar');
      }

      this.oauth2Client.setCredentials({
        access_token: userTokens.accessToken,
        refresh_token: userTokens.refreshToken
      });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      // Calculate timeMin (2 weeks ago) and timeMax (now) for past meetings
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Fetch all meetings from 2 weeks ago into the future
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: twoWeeksAgo.toISOString(),
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime'
      });

      // Split into past and future
      const allMeetings = response.data.items || [];
      const past = [];
      const future = [];
      for (const event of allMeetings) {
        if (event.start && event.start.dateTime) {
          const eventDate = new Date(event.start.dateTime);
          if (eventDate < now) {
            past.push(event);
          } else {
            future.push(event);
          }
        }
      }
      return { past, future };
    } catch (error) {
      console.error('Error listing all meetings:', error);
      throw error;
    }
  }

  async getAuthClient(userId) {
    const userTokens = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        googleAccessToken: true,
        googleRefreshToken: true
      }
    });

    if (!userTokens?.googleAccessToken) {
      throw new Error('User not connected to Google Calendar');
    }

    this.oauth2Client.setCredentials({
      access_token: userTokens.googleAccessToken,
      refresh_token: userTokens.googleRefreshToken
    });

    return this.oauth2Client;
  }

  async listMeetings(userId) {
    try {
      const auth = await this.getAuthClient(userId);
      const calendar = google.calendar({ version: 'v3', auth });
      
      // Get current date and date 2 weeks ago
      const now = new Date();
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(now.getDate() - 14);

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: twoWeeksAgo.toISOString(),
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime'
      });

      // Get meeting records from our database
      const meetingRecords = await prisma.meeting.findMany({
        where: {
          userId,
          googleEventId: {
            in: response.data.items.map(event => event.id)
          }
        }
      });

      // Map meeting records to their Google Calendar events
      const meetingRecordsMap = new Map(
        meetingRecords.map(record => [record.googleEventId, record])
      );

      // Combine Google Calendar data with our database records
      return response.data.items.map(event => {
        const meetingRecord = meetingRecordsMap.get(event.id);
        const eventEndTime = new Date(event.end.dateTime || event.end.date);
        
        return {
          ...event,
          hasRecording: !!meetingRecord?.recallBotId,
          hasTranscript: !!meetingRecord?.transcript,
          hasSummary: !!meetingRecord?.summary,
          isPast: eventEndTime < now
        };
      });
    } catch (error) {
      console.error('Error listing meetings:', error);
      throw error;
    }
  }

  async getMeetingDetails(userId, eventId) {
    try {
      const auth = await this.getAuthClient(userId);
      const calendar = google.calendar({ version: 'v3', auth });
      
      const event = await calendar.events.get({
        calendarId: 'primary',
        eventId: eventId
      });

      // Get meeting details from our database
      const meetingRecord = await prisma.meeting.findFirst({
        where: {
          userId,
          googleEventId: eventId
        }
      });

      // If meeting has already happened and we have a Recall.ai bot ID
      if (meetingRecord?.recallBotId) {
        const now = new Date();
        const meetingEndTime = new Date(event.data.end.dateTime || event.data.end.date);
        
        if (meetingEndTime < now) {
          try {
            // Get transcript and metadata from Recall.ai
            const [transcript, metadata] = await Promise.all([
              recallService.getTranscript(meetingRecord.recallBotId),
              recallService.getMeetingMetadata(meetingRecord.recallBotId)
            ]);

            return {
              ...event.data,
              transcript,
              metadata,
              summary: meetingRecord.summary,
              notes: meetingRecord.notes,
              hasRecording: true
            };
          } catch (error) {
            console.error('Error fetching Recall.ai data:', error);
            return {
              ...event.data,
              hasRecording: false,
              error: 'Transcript not available'
            };
          }
        }
      }

      return {
        ...event.data,
        hasRecording: false
      };
    } catch (error) {
      console.error('Error getting meeting details:', error);
      throw error;
    }
  }
}

module.exports = new CalendarService(); 