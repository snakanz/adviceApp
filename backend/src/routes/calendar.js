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
const calendarSyncService = require('../services/calendarSync');
const fileUploadService = require('../services/fileUpload');

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

// Sync calendar meetings to database
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`🔄 Starting calendar sync for user ${userId}`);

    const results = await calendarSyncService.syncUserCalendar(userId, {
      timeRange: 'extended', // 6 months
      includeDeleted: true
    });

    console.log(`✅ Calendar sync completed:`, results);
    res.json({
      message: 'Calendar synced successfully',
      results
    });
  } catch (error) {
    console.error('Error syncing calendar:', error);
    res.status(500).json({ error: 'Failed to sync calendar' });
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
router.post('/generate-summary', async (req, res) => {
  const { transcript, prompt } = req.body;
  if (!transcript) return res.status(400).json({ error: 'Transcript is required' });
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    if (!openai.isOpenAIAvailable()) {
      return res.status(503).json({
        error: 'OpenAI service is not available. Please check your API key configuration.'
      });
    }

    const summary = await openai.generateMeetingSummary(transcript, 'standard', { prompt });
    return res.json({ summary });
  } catch (err) {
    console.error('Error generating summary:', err);
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

    // Get meeting from database with client information
    const { data: meeting, error: fetchError } = await getSupabase()
      .from('meetings')
      .select(`
        *,
        client:clients(id, name, email)
      `)
      .eq('googleeventid', meetingId)
      .eq('userid', userId)
      .single();

    if (fetchError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (!meeting.transcript) {
      return res.status(400).json({ error: 'No transcript available for this meeting' });
    }

    // Extract client information for email personalization
    let clientName = 'Client';
    let clientEmail = null;

    if (meeting.client) {
      clientName = meeting.client.name || meeting.client.email.split('@')[0];
      clientEmail = meeting.client.email;
    } else if (meeting.attendees) {
      try {
        const attendees = JSON.parse(meeting.attendees);
        const clientAttendee = attendees.find(a => a.email && a.email !== req.user.email);
        if (clientAttendee) {
          clientName = clientAttendee.displayName || clientAttendee.name || clientAttendee.email.split('@')[0];
          clientEmail = clientAttendee.email;
        }
      } catch (e) {
        // Ignore parsing errors
      }
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

    // Check if OpenAI is available
    if (!openai.isOpenAIAvailable()) {
      return res.status(503).json({
        error: 'OpenAI service is not available. Please check your API key configuration.'
      });
    }

    // Generate Quick Summary (single sentence for Clients page)
    const quickSummaryPrompt = `Create a brief, single-sentence summary of this meeting transcript. Focus on the main outcome or key decision made.

Requirements:
• Must be exactly ONE sentence
• Include the most important outcome or decision
• Keep it professional and concise
• Maximum 150 characters

Transcript:
${meeting.transcript}

Respond with ONLY the single sentence summary, no additional text.`;

    const quickSummary = await openai.generateMeetingSummary(meeting.transcript, 'standard', { prompt: quickSummaryPrompt });

    // Generate Email Summary using Auto template with client name
    const autoTemplate = `Role: You are a professional, helpful, and concise financial advisor's assistant (Nelson Greenwood) tasked with creating a follow-up email summary for a client based on a meeting transcript.

Goal: Generate a clear, well-structured email that summarizes the key financial advice, confirms the numerical details, and outlines the immediate and future next steps.

Constraints & Format:
1. Opening: Start with a warm, conversational opening that confirms the pleasure of the meeting and sets the context.
2. Sections: Use bolded headings for clarity (e.g., Pension Recommendation, Next Steps).
3. Data Accuracy: Extract and use the exact numerical figures from the transcript.
4. Tone: Professional, clear, and reassuring.
5. Output: Provide only the final email text (do not include introductory/explanatory comments).

Example Output Format:

Subject: Follow-up: Summary of our [Topic] Advice & Next Steps

Hi ${clientName},

It was great speaking with you this morning and catching up on your weekend. Below are the key points we discussed regarding [main topic].

## Key Discussion Points

**1. [Main Topic]**
* [Key point with specific numbers/details]
* [Key point with specific numbers/details]
* [Key point with specific numbers/details]

**2. [Secondary Topic]**
* [Key point with specific numbers/details]
* [Key point with specific numbers/details]

**3. [Additional Topic if applicable]**
* [Key point with specific numbers/details]

## Next Steps
1. **[Action Item 1]:** [Description with timeline]
2. **[Action Item 2]:** [Description with timeline]
3. **[Action Item 3]:** [Description with timeline]
4. **[Action Item 4]:** [Description with timeline]
5. **[Action Item 5]:** [Description with timeline]

Please review the documents once they arrive. If you have any immediate questions in the meantime, please don't hesitate to let me know.

Best regards,
Nelson Greenwood
Financial Advisor

Transcript:
${meeting.transcript}

Respond with the **email body only** — no headers or subject lines.`;

    const emailSummary = await openai.generateMeetingSummary(meeting.transcript, 'standard', { prompt: autoTemplate });

    // Generate action points
    const actionPointsPrompt = `Extract key action items from this meeting transcript that the user (financial advisor) needs to complete or follow up on.

Focus on:
• Tasks the advisor committed to doing
• Follow-up actions required
• Documents to prepare or send
• Meetings to schedule
• Research to conduct
• Client requests to fulfill

Format as a clean, scannable list. Be specific and actionable. If no clear action items exist, respond with "No specific action items identified."

Transcript:
${meeting.transcript}`;

    const actionPoints = await openai.generateMeetingSummary(meeting.transcript, 'standard', { prompt: actionPointsPrompt });

    // Save summaries to database
    const { error: updateError } = await getSupabase()
      .from('meetings')
      .update({
        quick_summary: quickSummary,
        email_summary_draft: emailSummary,
        action_points: actionPoints,
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
      actionPoints,
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

// Update meeting summary with new template
router.post('/meetings/:id/update-summary', authenticateToken, async (req, res) => {
  try {
    const meetingId = req.params.id;
    const userId = req.user.id;
    const { emailSummary, templateId } = req.body;

    // Verify meeting belongs to user
    const { data: meeting, error: fetchError } = await getSupabase()
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .eq('userid', userId)
      .single();

    if (fetchError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Update the meeting with new summary
    const { error: updateError } = await getSupabase()
      .from('meetings')
      .update({
        email_summary_draft: emailSummary,
        email_template_id: templateId,
        last_summarized_at: new Date().toISOString(),
        updatedat: new Date().toISOString()
      })
      .eq('id', meetingId)
      .eq('userid', userId);

    if (updateError) {
      console.error('Error updating meeting summary:', updateError);
      return res.status(500).json({ error: 'Failed to update summary' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating meeting summary:', error);
    res.status(500).json({ error: 'Failed to update summary' });
  }
});

// ============================================================================
// MANUAL MEETING CREATION ENDPOINTS
// ============================================================================

// Create a manual meeting
router.post('/meetings/manual', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title,
      description,
      startTime,
      endTime,
      locationType,
      locationDetails,
      attendees,
      transcript
    } = req.body;

    // Validation
    if (!title || !startTime) {
      return res.status(400).json({ error: 'Title and start time are required' });
    }

    // Generate a unique event ID for manual meetings
    const manualEventId = `manual_${userId}_${Date.now()}`;

    // Prepare meeting data
    const meetingData = {
      userid: userId,
      googleeventid: manualEventId,
      title: title.trim(),
      starttime: new Date(startTime).toISOString(),
      endtime: endTime ? new Date(endTime).toISOString() : null,
      summary: description || null,
      transcript: transcript || null,
      location_type: locationType || 'other',
      location_details: locationDetails || null,
      manual_attendees: attendees || null,
      attendees: attendees ? JSON.stringify([{ displayName: attendees }]) : null,
      meeting_source: 'manual',
      is_manual: true,
      created_by: userId,
      recording_status: 'none',
      created_at: new Date().toISOString(),
      updatedat: new Date().toISOString()
    };

    // Insert meeting into database
    const { data: meeting, error: insertError } = await getSupabase()
      .from('meetings')
      .insert(meetingData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating manual meeting:', insertError);
      return res.status(500).json({ error: 'Failed to create meeting' });
    }

    res.status(201).json({
      message: 'Meeting created successfully',
      meeting: {
        ...meeting,
        id: meeting.googleeventid, // For frontend compatibility
        startTime: meeting.starttime,
        googleEventId: meeting.googleeventid
      }
    });

  } catch (error) {
    console.error('Error in manual meeting creation:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

// Update a manual meeting
router.put('/meetings/manual/:meetingId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { meetingId } = req.params;
    const {
      title,
      description,
      startTime,
      endTime,
      locationType,
      locationDetails,
      attendees,
      transcript
    } = req.body;

    // Verify meeting exists and is manual
    const { data: existingMeeting, error: fetchError } = await getSupabase()
      .from('meetings')
      .select('*')
      .eq('googleeventid', meetingId)
      .eq('userid', userId)
      .eq('is_manual', true)
      .single();

    if (fetchError || !existingMeeting) {
      return res.status(404).json({ error: 'Manual meeting not found' });
    }

    // Prepare update data
    const updateData = {
      title: title?.trim() || existingMeeting.title,
      summary: description !== undefined ? description : existingMeeting.summary,
      starttime: startTime ? new Date(startTime).toISOString() : existingMeeting.starttime,
      endtime: endTime ? new Date(endTime).toISOString() : existingMeeting.endtime,
      location_type: locationType || existingMeeting.location_type,
      location_details: locationDetails !== undefined ? locationDetails : existingMeeting.location_details,
      manual_attendees: attendees !== undefined ? attendees : existingMeeting.manual_attendees,
      attendees: attendees ? JSON.stringify([{ displayName: attendees }]) : existingMeeting.attendees,
      transcript: transcript !== undefined ? transcript : existingMeeting.transcript,
      updatedat: new Date().toISOString()
    };

    // Update meeting
    const { data: updatedMeeting, error: updateError } = await getSupabase()
      .from('meetings')
      .update(updateData)
      .eq('googleeventid', meetingId)
      .eq('userid', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating manual meeting:', updateError);
      return res.status(500).json({ error: 'Failed to update meeting' });
    }

    res.json({
      message: 'Meeting updated successfully',
      meeting: {
        ...updatedMeeting,
        id: updatedMeeting.googleeventid,
        startTime: updatedMeeting.starttime,
        googleEventId: updatedMeeting.googleeventid
      }
    });

  } catch (error) {
    console.error('Error updating manual meeting:', error);
    res.status(500).json({ error: 'Failed to update meeting' });
  }
});

// Delete a manual meeting
router.delete('/meetings/manual/:meetingId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { meetingId } = req.params;

    // Verify meeting exists and is manual
    const { data: existingMeeting, error: fetchError } = await getSupabase()
      .from('meetings')
      .select('id')
      .eq('googleeventid', meetingId)
      .eq('userid', userId)
      .eq('is_manual', true)
      .single();

    if (fetchError || !existingMeeting) {
      return res.status(404).json({ error: 'Manual meeting not found' });
    }

    // Delete meeting (this will cascade delete documents due to foreign key)
    const { error: deleteError } = await getSupabase()
      .from('meetings')
      .delete()
      .eq('googleeventid', meetingId)
      .eq('userid', userId);

    if (deleteError) {
      console.error('Error deleting manual meeting:', deleteError);
      return res.status(500).json({ error: 'Failed to delete meeting' });
    }

    res.json({ message: 'Meeting deleted successfully' });

  } catch (error) {
    console.error('Error deleting manual meeting:', error);
    res.status(500).json({ error: 'Failed to delete meeting' });
  }
});

// Update meeting transcript (for both manual and Google meetings)
router.post('/meetings/:meetingId/transcript', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { meetingId } = req.params;
    const { transcript } = req.body;

    if (transcript === undefined) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    // Verify meeting exists and user has access
    const { data: existingMeeting, error: fetchError } = await getSupabase()
      .from('meetings')
      .select('*')
      .eq('googleeventid', meetingId)
      .eq('userid', userId)
      .single();

    if (fetchError || !existingMeeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Update transcript
    const { data: updatedMeeting, error: updateError } = await getSupabase()
      .from('meetings')
      .update({
        transcript: transcript,
        updatedat: new Date().toISOString()
      })
      .eq('googleeventid', meetingId)
      .eq('userid', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating meeting transcript:', updateError);
      return res.status(500).json({ error: 'Failed to update transcript' });
    }

    res.json({
      message: 'Transcript updated successfully',
      meeting: {
        ...updatedMeeting,
        id: updatedMeeting.googleeventid,
        startTime: updatedMeeting.starttime,
        googleEventId: updatedMeeting.googleeventid
      }
    });

  } catch (error) {
    console.error('Error updating meeting transcript:', error);
    res.status(500).json({ error: 'Failed to update transcript' });
  }
});

// ============================================================================
// ANNUAL REVIEW ENDPOINTS
// ============================================================================

// Toggle annual review flag for a meeting
router.patch('/meetings/:meetingId/annual-review', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { meetingId } = req.params;
    const { isAnnualReview } = req.body;

    if (typeof isAnnualReview !== 'boolean') {
      return res.status(400).json({ error: 'isAnnualReview must be a boolean' });
    }

    // Verify meeting exists and user has access
    const { data: existingMeeting, error: fetchError } = await getSupabase()
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .eq('userid', userId)
      .single();

    if (fetchError || !existingMeeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Update the annual review flag
    const { data: updatedMeeting, error: updateError } = await getSupabase()
      .from('meetings')
      .update({ is_annual_review: isAnnualReview })
      .eq('id', meetingId)
      .eq('userid', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating annual review flag:', updateError);
      return res.status(500).json({ error: 'Failed to update annual review flag' });
    }

    res.json({
      success: true,
      meeting: updatedMeeting,
      message: isAnnualReview ? 'Meeting marked as annual review' : 'Annual review flag removed'
    });
  } catch (error) {
    console.error('Error toggling annual review:', error);
    res.status(500).json({ error: 'Failed to toggle annual review flag' });
  }
});

// Get annual review dashboard for current user
router.get('/annual-reviews/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get annual review dashboard data
    const { data: reviews, error } = await getSupabase()
      .from('annual_review_dashboard')
      .select('*')
      .eq('advisor_id', userId)
      .order('computed_status', { ascending: true })
      .order('client_name', { ascending: true });

    if (error) {
      console.error('Error fetching annual review dashboard:', error);
      return res.status(500).json({ error: 'Failed to fetch annual review dashboard' });
    }

    res.json(reviews || []);
  } catch (error) {
    console.error('Error fetching annual review dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch annual review dashboard' });
  }
});

// Get annual review status for a specific client
router.get('/clients/:clientId/annual-review', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { clientId } = req.params;
    const currentYear = new Date().getFullYear();

    // Get annual review record for current year
    const { data: review, error } = await getSupabase()
      .from('client_annual_reviews')
      .select('*')
      .eq('client_id', clientId)
      .eq('advisor_id', userId)
      .eq('review_year', currentYear)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching annual review:', error);
      return res.status(500).json({ error: 'Failed to fetch annual review' });
    }

    res.json(review || null);
  } catch (error) {
    console.error('Error fetching annual review:', error);
    res.status(500).json({ error: 'Failed to fetch annual review' });
  }
});

// Update annual review status for a client
router.put('/clients/:clientId/annual-review', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { clientId } = req.params;
    const { reviewYear, reviewDate, meetingId, status, notes } = req.body;
    const currentYear = reviewYear || new Date().getFullYear();

    // Verify client exists and belongs to user
    const { data: client, error: clientError } = await getSupabase()
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('userid', userId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Upsert annual review record
    const { data: review, error: upsertError } = await getSupabase()
      .from('client_annual_reviews')
      .upsert({
        client_id: clientId,
        advisor_id: userId,
        review_year: currentYear,
        review_date: reviewDate || null,
        meeting_id: meetingId || null,
        status: status || 'pending',
        notes: notes || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'client_id,review_year'
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Error updating annual review:', upsertError);
      return res.status(500).json({ error: 'Failed to update annual review' });
    }

    res.json({
      success: true,
      review,
      message: 'Annual review updated successfully'
    });
  } catch (error) {
    console.error('Error updating annual review:', error);
    res.status(500).json({ error: 'Failed to update annual review' });
  }
});

// ============================================================================
// FILE UPLOAD ENDPOINTS
// ============================================================================

// Upload files to a meeting
router.post('/meetings/:meetingId/documents', authenticateToken, fileUploadService.upload.array('files', 10), async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Verify meeting exists and user has access
    const { data: meeting, error: meetingError } = await getSupabase()
      .from('meetings')
      .select('id, title')
      .eq('id', meetingId)
      .eq('userid', userId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const uploadedFiles = [];
    const errors = [];

    // Process each file
    for (const file of files) {
      try {
        // Generate unique filename
        const fileName = fileUploadService.generateFileName(file.originalname, meetingId);

        // Upload to storage
        const storageResult = await fileUploadService.uploadToStorage(file, fileName);

        // Save metadata to database
        const fileData = {
          meeting_id: parseInt(meetingId),
          file_name: fileName,
          original_name: file.originalname,
          file_type: file.mimetype,
          file_category: fileUploadService.getFileCategory(file.mimetype),
          file_size: file.size,
          storage_path: storageResult.path,
          storage_bucket: 'meeting-documents',
          uploaded_by: userId
        };

        const savedFile = await fileUploadService.saveFileMetadata(fileData);

        // Add download URL
        savedFile.download_url = await fileUploadService.getFileDownloadUrl(storageResult.path);

        uploadedFiles.push(savedFile);
      } catch (fileError) {
        console.error(`Error uploading file ${file.originalname}:`, fileError);
        errors.push({
          filename: file.originalname,
          error: fileError.message
        });
      }
    }

    res.json({
      message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
      files: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error in file upload:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Get files for a meeting
router.get('/meetings/:meetingId/documents', authenticateToken, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;

    // Verify meeting access
    const { data: meeting, error: meetingError } = await getSupabase()
      .from('meetings')
      .select('id')
      .eq('id', meetingId)
      .eq('userid', userId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const files = await fileUploadService.getMeetingFiles(meetingId, userId);

    res.json({
      files,
      count: files.length
    });

  } catch (error) {
    console.error('Error fetching meeting files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Delete a file
router.delete('/meetings/:meetingId/documents/:fileId', authenticateToken, async (req, res) => {
  try {
    const { meetingId, fileId } = req.params;
    const userId = req.user.id;

    // Verify meeting access
    const { data: meeting, error: meetingError } = await getSupabase()
      .from('meetings')
      .select('id')
      .eq('id', meetingId)
      .eq('userid', userId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    await fileUploadService.deleteFile(fileId, userId);

    res.json({ message: 'File deleted successfully' });

  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: error.message || 'Failed to delete file' });
  }
});

// Debug route to confirm calendar.js is loaded
router.get('/debug-alive', (req, res) => {
  res.json({ status: 'calendar routes alive' });
});

module.exports = router;