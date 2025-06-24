const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const calendarService = require('../services/calendar');
const meetingService = require('../services/meeting');
const { authenticateUser, authenticateToken } = require('../middleware/auth');
const openai = require('../services/openai');
const { google } = require('googleapis');
const { getGoogleAuthClient, refreshAccessToken } = require('../services/calendar');
const { processMeetingWithAI } = require('../services/meeting');

// Get Google Calendar auth URL
router.get('/auth/google', async (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  res.redirect(url);
});

// Handle Google Calendar OAuth callback
// This route handles the full Google OAuth flow and should NOT require authenticateUser
router.get('/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    return res.redirect('http://localhost:3000/login?error=' + encodeURIComponent(error));
  }
  if (!code) {
    return res.redirect('http://localhost:3000/login?error=NoCode');
  }
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // Find or create user in DB
    let user = await prisma.user.findUnique({ where: { email: userInfo.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userInfo.email,
          name: userInfo.name,
          provider: 'google',
          providerId: userInfo.id
        }
      });
    }

    // Store/Update calendar tokens
    await prisma.calendarToken.upsert({
      where: { userId: user.id },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: new Date(tokens.expiry_date),
        provider: 'google'
      },
      create: {
        userId: user.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date),
        provider: 'google'
      }
    });

    // Issue JWT
    const jwtToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Redirect to frontend with token in URL
    res.redirect(`http://localhost:3000/auth/callback?token=${jwtToken}`);
  } catch (err) {
    res.redirect('http://localhost:3000/login?error=OAuthFailed');
  }
});

// Create a new meeting with calendar event
router.post('/meetings', authenticateUser, async (req, res) => {
  try {
    const { title, description, date, time, duration } = req.body;
    
    // Create meeting in database
    const meeting = await prisma.meeting.create({
      data: {
        userId: req.user.id,
        title,
        type: 'scheduled',
        date: new Date(date),
        time,
        status: 'scheduled'
      }
    });

    // Create calendar event
    const calendarEvent = await calendarService.createMeetingEvent(req.user.id, {
      id: meeting.id,
      title,
      description,
      date,
      time,
      duration
    });

    res.json({ meeting, calendarEvent });
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

// Get all meetings for a user
router.get('/meetings', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const meetings = await calendarService.listMeetings(userId);
        res.json(meetings);
    } catch (error) {
        console.error('Error fetching meetings:', error);
        res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

// List upcoming meetings
router.get('/meetings/all', authenticateUser, async (req, res) => {
  try {
    const meetings = await calendarService.listMeetingsWithRecentPast(req.user.id);
    res.json(meetings);
  } catch (error) {
    console.error('Error listing all meetings:', error);
    res.status(500).json({ error: 'Failed to list all meetings' });
  }
});

// Start meeting recording
router.post('/meetings/:id/record/start', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const recording = await meetingService.startRecording(id);
    res.json(recording);
  } catch (error) {
    console.error('Error starting recording:', error);
    res.status(500).json({ error: 'Failed to start recording' });
  }
});

// Stop meeting recording
router.post('/meetings/:id/record/stop', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { recordingUrl } = req.body;
    await meetingService.stopRecording(id, recordingUrl);
    
    // Generate transcript and summary
    const transcript = await meetingService.generateTranscript(id);
    const summary = await meetingService.generateSummary(id);
    const actionItems = await meetingService.extractActionItems(id);

    res.json({ transcript, summary, actionItems });
  } catch (error) {
    console.error('Error processing meeting recording:', error);
    res.status(500).json({ error: 'Failed to process recording' });
  }
});

// Get meeting details including transcript and recording if available
router.get('/meetings/:eventId', authenticateToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user.id;

        const meetingDetails = await calendarService.getMeetingDetails(userId, eventId);
        
        // If the meeting has a transcript and we need to generate a summary
        if (meetingDetails.hasRecording && meetingDetails.transcript && !meetingDetails.summary) {
            // Get the meeting template preference if any
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { preferences: true }
            });

            const template = user?.preferences?.defaultTemplate || 'standard';
            
            // Generate summary using OpenAI
            const summary = await openai.generateMeetingSummary(
                meetingDetails.transcript,
                template,
                meetingDetails.metadata
            );

            // Update the meeting record with the summary
            await prisma.meeting.update({
                where: {
                    googleEventId: eventId
                },
                data: {
                    summary
                }
            });

            meetingDetails.summary = summary;
        }

        res.json(meetingDetails);
    } catch (error) {
        console.error('Error fetching meeting details:', error);
        res.status(500).json({ error: 'Failed to fetch meeting details' });
    }
});

// Add manual notes to a meeting
router.post('/meetings/:eventId/notes', authenticateToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { notes } = req.body;
        const userId = req.user.id;

        // Update meeting with manual notes
        const meeting = await prisma.meeting.update({
            where: {
                googleEventId: eventId,
                userId
            },
            data: {
                notes,
                // Generate summary if notes are provided
                summary: notes ? await openai.generateMeetingSummary(notes, 'standard') : undefined
            }
        });

        res.json(meeting);
    } catch (error) {
        console.error('Error adding meeting notes:', error);
        res.status(500).json({ error: 'Failed to add meeting notes' });
    }
});

// Upload meeting image/document
router.post('/meetings/:eventId/attachments', authenticateToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { imageText } = req.body; // Assuming we're receiving OCR'd text from the frontend
        const userId = req.user.id;

        if (!imageText) {
            return res.status(400).json({ error: 'No text content provided' });
        }

        // Update meeting with the extracted text as notes
        const meeting = await prisma.meeting.update({
            where: {
                googleEventId: eventId,
                userId
            },
            data: {
                notes: imageText,
                // Generate summary from the image text
                summary: await openai.generateMeetingSummary(imageText, 'standard')
            }
        });

        res.json(meeting);
    } catch (error) {
        console.error('Error processing meeting attachment:', error);
        res.status(500).json({ error: 'Failed to process meeting attachment' });
  }
});

module.exports = router; 