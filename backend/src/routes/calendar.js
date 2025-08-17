const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const calendarService = require('../services/calendar');
// const meetingService = require('../services/meeting'); // Removed because file does not exist
const { authenticateUser, authenticateToken } = require('../middleware/auth');
const openai = require('../services/openai');
const { google } = require('googleapis');
const { getGoogleAuthClient, refreshAccessToken } = require('../services/calendar');
const { supabase, isSupabaseAvailable, getSupabase } = require('../lib/supabase');

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
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=NoCode`);
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
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${jwtToken}`);
  } catch (err) {
    res.redirect(`${process.env.FRONTEND_URL}/login?error=OAuthFailed`);
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

// Generate email summary for a meeting (AI or template)
router.post('/meetings/:id/generate-summary', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { transcript, prompt } = req.body;
    if (!transcript || !prompt) {
      return res.status(400).json({ error: 'Transcript and prompt are required.' });
    }
    // Call OpenAI to generate summary
    const summary = await openai.generateMeetingSummary(transcript, undefined, { prompt });
    res.json({ summary });
  } catch (error) {
    console.error('Error generating email summary:', error);
    res.status(500).json({ error: 'Failed to generate email summary.' });
  }
});

// Improved AI summary email route for Advicly
const OpenAI = require('openai');
router.post('/generate-summary', async (req, res) => {
  const { transcript, prompt } = req.body;
  if (!transcript) return res.status(400).json({ error: 'Transcript is required' });
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-16k',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.7,
    });
    return res.json({ summary: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// Auto-generate summaries for a meeting
router.post('/meetings/:id/auto-generate-summaries', authenticateToken, async (req, res) => {
  try {
    const meetingId = req.params.id;
    const userId = req.user.id;
    const { forceRegenerate = false } = req.body;

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please configure Supabase environment variables.'
      });
    }

    // Get meeting from database
    const { data: meeting, error: fetchError } = await getSupabase()
      .from('meetings')
      .select('*')
      .eq('googleeventid', meetingId)
      .eq('userid', userId)
      .single();

    if (fetchError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (!meeting.transcript) {
      return res.status(400).json({ error: 'No transcript available for this meeting' });
    }

    // Check if summaries already exist and we're not forcing regeneration
    if (!forceRegenerate && meeting.quick_summary && meeting.email_summary_draft) {
      return res.json({
        quickSummary: meeting.quick_summary,
        emailSummary: meeting.email_summary_draft,
        templateId: meeting.email_template_id,
        lastSummarizedAt: meeting.last_summarized_at,
        alreadyGenerated: true
      });
    }

    // Generate Quick Summary (fixed bullet points)
    const quickSummaryPrompt = `Please create a concise bullet-point summary of this meeting transcript. Focus on:
• Key decisions made
• Action items assigned
• Important topics discussed
• Next steps

Keep it brief and professional. Use bullet points only.

Transcript:
${meeting.transcript}`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const quickSummaryResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-16k',
      messages: [{ role: 'user', content: quickSummaryPrompt }],
      max_tokens: 400,
      temperature: 0.7,
    });
    const quickSummary = quickSummaryResponse.choices[0].message.content;

    // Generate Email Summary using Auto template
    const autoTemplate = `# SYSTEM PROMPT: Advicly Auto Email Generator
You are an expert financial advisor drafting a professional email for a client immediately after a meeting. Your role is to generate a **clear, accurate summary email based ONLY on the provided transcript**.

Create a professional email summary that includes:
• Meeting overview
• Key points discussed
• Decisions made
• Next steps
• Action items

Keep it professional and client-friendly.

Transcript:
${meeting.transcript}

Respond with the **email body only** — no headers or subject lines.`;

    const emailSummaryResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-16k',
      messages: [{ role: 'user', content: autoTemplate }],
      max_tokens: 800,
      temperature: 0.7,
    });
    const emailSummary = emailSummaryResponse.choices[0].message.content;

    // Save summaries to database
    const { error: updateError } = await getSupabase()
      .from('meetings')
      .update({
        quick_summary: quickSummary,
        email_summary_draft: emailSummary,
        email_template_id: 'auto-template',
        last_summarized_at: new Date().toISOString(),
        updatedat: new Date().toISOString()
      })
      .eq('googleeventid', meetingId)
      .eq('userid', userId);

    if (updateError) {
      console.error('Error saving summaries:', updateError);
      return res.status(500).json({ error: 'Failed to save summaries' });
    }

    res.json({
      quickSummary,
      emailSummary,
      templateId: 'auto-template',
      lastSummarizedAt: new Date().toISOString(),
      generated: true
    });

  } catch (error) {
    console.error('Error auto-generating summaries:', error);
    res.status(500).json({ error: 'Failed to generate summaries' });
  }
});

// Delete a meeting and its associated data
router.delete('/meetings/:eventId', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    // Find the meeting first to check if it exists and belongs to the user
    const meeting = await prisma.meeting.findFirst({
      where: {
        googleEventId: eventId,
        userId
      }
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Delete related records first (due to foreign key constraints)
    await prisma.actionItem.deleteMany({
      where: { meetingId: meeting.id }
    });

    await prisma.recording.deleteMany({
      where: { meetingId: meeting.id }
    });

    // Delete the meeting
    await prisma.meeting.delete({
      where: { id: meeting.id }
    });

    res.json({ message: 'Meeting deleted successfully' });
  } catch (error) {
    console.error('Error deleting meeting:', error);
    res.status(500).json({ error: 'Failed to delete meeting' });
  }
});

// Delete all meetings for a user (cleanup endpoint)
router.delete('/meetings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { olderThan } = req.query; // Optional: delete meetings older than X days

    let whereClause = { userId };
    
    if (olderThan) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThan));
      whereClause.startTime = { lt: cutoffDate };
    }

    // Get all meetings to delete
    const meetingsToDelete = await prisma.meeting.findMany({
      where: whereClause,
      select: { id: true }
    });

    const meetingIds = meetingsToDelete.map(m => m.id);

    // Delete related records first
    await prisma.actionItem.deleteMany({
      where: { meetingId: { in: meetingIds } }
    });

    await prisma.recording.deleteMany({
      where: { meetingId: { in: meetingIds } }
    });

    // Delete the meetings
    const deletedCount = await prisma.meeting.deleteMany({
      where: whereClause
    });

    res.json({ 
      message: `Deleted ${deletedCount.count} meetings successfully`,
      deletedCount: deletedCount.count
    });
  } catch (error) {
    console.error('Error deleting meetings:', error);
    res.status(500).json({ error: 'Failed to delete meetings' });
  }
});

// Debug route to confirm calendar.js is loaded
router.get('/debug-alive', (req, res) => {
  res.json({ status: 'calendar routes alive' });
});

module.exports = router; 