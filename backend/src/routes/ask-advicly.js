const express = require('express');
const jwt = require('jsonwebtoken');
const { supabase, isSupabaseAvailable, getSupabase } = require('../lib/supabase');
const { generateMeetingSummary, generateChatResponse } = require('../services/openai');

// Generate proactive insights based on meeting content
function generateProactiveInsights(meetingData) {
  if (!meetingData) return '';

  let insights = [];

  // Add context-aware insights based on meeting content
  if (meetingData.transcript) {
    insights.push(`
    PROACTIVE INSIGHTS FOR THIS MEETING:
    Based on the transcript and summary, consider these follow-up opportunities:
    - Review any specific financial products or strategies mentioned
    - Follow up on action items or decisions that were made
    - Address any concerns or questions the client raised
    - Explore related financial planning opportunities based on their situation
    `);
  }

  if (meetingData.quick_summary) {
    insights.push(`
    MEETING SUMMARY CONTEXT:
    Use this summary to understand the key outcomes: ${meetingData.quick_summary}
    `);
  }

  return insights.join('\n');
}

const router = express.Router();

console.log('Ask Advicly router created');

// Helper function to generate contextual thread titles
function generateContextualTitle(contextType, contextData) {
  try {
    switch (contextType) {
      case 'meeting':
        if (contextData.clientName && contextData.meetingTitle) {
          const date = contextData.meetingDate ?
            new Date(contextData.meetingDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            }) : '';
          return `${contextData.clientName} - ${contextData.meetingTitle}${date ? ` (${date})` : ''}`;
        }
        return contextData.meetingTitle || 'Meeting Discussion';

      case 'client':
        if (contextData.clientName) {
          return `${contextData.clientName} - Client Discussion`;
        }
        return 'Client Discussion';

      default:
        return 'General Advisory Chat';
    }
  } catch (error) {
    console.error('Error generating contextual title:', error);
    return 'New Conversation';
  }
}

// Helper function to extract topic from message for title generation
function extractTopicFromMessage(message) {
  if (!message || typeof message !== 'string') return null;

  const words = message.toLowerCase().split(' ');
  const topics = ['retirement', 'investment', 'portfolio', 'planning', 'insurance', 'tax', 'estate', 'savings'];
  const foundTopic = topics.find(topic => words.includes(topic));

  return foundTopic ? foundTopic.charAt(0).toUpperCase() + foundTopic.slice(1) + ' Discussion' : null;
}

// Test route
router.get('/test', (req, res) => {
  console.log('Test route hit!');
  res.json({ message: 'Ask Advicly routes working!' });
});

// Debug route to check meeting data
router.get('/debug/meetings', async (req, res) => {
  try {
    const { data: meetings } = await getSupabase()
      .from('meetings')
      .select('googleeventid, title, starttime, attendees, transcript, quick_summary, email_summary_draft')
      .order('starttime', { ascending: false })
      .limit(10);

    res.json({
      count: meetings?.length || 0,
      meetings: meetings?.map(m => ({
        googleeventid: m.googleeventid,
        title: m.title,
        starttime: m.starttime,
        attendees: m.attendees,
        hasTranscript: !!m.transcript,
        transcriptLength: m.transcript?.length || 0,
        hasQuickSummary: !!m.quick_summary,
        hasEmailSummary: !!m.email_summary_draft
      }))
    });
  } catch (error) {
    console.error('Debug meetings error:', error);
    res.status(500).json({ error: error.message });
  }
});

console.log('Test route registered');

// Get all threads for an advisor with enhanced context support
router.get('/threads', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    const { data: threads, error } = await getSupabase()
      .from('ask_threads')
      .select(`
        id,
        title,
        client_id,
        context_type,
        context_data,
        meeting_id,
        created_at,
        updated_at,
        clients(name, email)
      `)
      .eq('advisor_id', advisorId)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching threads:', error);
      return res.status(500).json({ error: 'Failed to fetch threads' });
    }

    // Group threads by context type for easier frontend handling
    const allThreads = threads || [];
    const groupedThreads = {
      meeting: allThreads.filter(t => t.context_type === 'meeting'),
      client: allThreads.filter(t => t.context_type === 'client'),
      general: allThreads.filter(t => t.context_type === 'general')
    };

    res.json({
      threads: allThreads,
      grouped: groupedThreads,
      counts: {
        total: allThreads.length,
        meeting: groupedThreads.meeting.length,
        client: groupedThreads.client.length,
        general: groupedThreads.general.length
      }
    });
  } catch (error) {
    console.error('Error in /threads:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get messages for a specific thread
router.get('/threads/:threadId/messages', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const { threadId } = req.params;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Verify thread belongs to advisor
    const { data: thread, error: threadError } = await getSupabase()
      .from('ask_threads')
      .select('id')
      .eq('id', threadId)
      .eq('advisor_id', advisorId)
      .single();

    if (threadError || !thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const { data: messages, error } = await getSupabase()
      .from('ask_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    res.json(messages || []);
  } catch (error) {
    console.error('Error in /threads/:threadId/messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new thread with enhanced context support
router.post('/threads', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const {
      clientId,
      title = 'New Conversation',
      contextType = 'general',
      contextData = {},
      meetingId = null
    } = req.body;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Generate smart title if not provided and we have context data
    let finalTitle = title;
    if (title === 'New Conversation' && contextData && Object.keys(contextData).length > 0) {
      finalTitle = generateContextualTitle(contextType, contextData);
    }

    const { data: thread, error } = await getSupabase()
      .from('ask_threads')
      .insert({
        advisor_id: advisorId,
        client_id: clientId || null,
        title: finalTitle,
        context_type: contextType,
        context_data: contextData,
        meeting_id: meetingId
      })
      .select(`
        id,
        title,
        client_id,
        context_type,
        context_data,
        meeting_id,
        created_at,
        updated_at,
        clients(name, email)
      `)
      .single();

    if (error) {
      console.error('Error creating thread:', error);
      return res.status(500).json({ error: 'Failed to create thread' });
    }

    console.log('✅ Created new thread:', {
      id: thread.id,
      title: thread.title,
      contextType: thread.context_type,
      meetingId: thread.meeting_id,
      contextData: contextData
    });

    res.json(thread);
  } catch (error) {
    console.error('Error in POST /threads:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send a message to a thread
router.post('/threads/:threadId/messages', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const { threadId } = req.params;
    const { content, mentionedClients = [] } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Verify thread belongs to advisor and get enhanced context
    const { data: thread, error: threadError } = await getSupabase()
      .from('ask_threads')
      .select(`
        id,
        client_id,
        context_type,
        context_data,
        meeting_id,
        clients(name, email)
      `)
      .eq('id', threadId)
      .eq('advisor_id', advisorId)
      .single();

    if (threadError || !thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Save user message
    const { data: userMessage, error: userMessageError } = await getSupabase()
      .from('ask_messages')
      .insert({
        thread_id: threadId,
        role: 'user',
        content: content.trim()
      })
      .select()
      .single();

    if (userMessageError) {
      console.error('Error saving user message:', userMessageError);
      return res.status(500).json({ error: 'Failed to save message' });
    }

    // Get comprehensive advisor context
    let advisorContext = '';

    // Get ALL meetings for the advisor (for general questions)
    const { data: allMeetings } = await getSupabase()
      .from('meetings')
      .select('title, starttime, endtime, transcript, quick_summary, email_summary_draft, attendees')
      .eq('userid', advisorId)
      .order('starttime', { ascending: false })
      .limit(50); // Get recent 50 meetings

    // Get all clients for the advisor
    const { data: allClients } = await getSupabase()
      .from('clients')
      .select('name, email, status, likely_value, likely_close_month')
      .eq('advisor_id', advisorId);

    // Build comprehensive context
    if (allMeetings && allMeetings.length > 0) {
      const currentDate = new Date();
      const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      const thisMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

      const lastMonthMeetings = allMeetings.filter(m => {
        const meetingDate = new Date(m.starttime);
        return meetingDate >= lastMonth && meetingDate < thisMonth;
      });

      const thisMonthMeetings = allMeetings.filter(m => {
        const meetingDate = new Date(m.starttime);
        return meetingDate >= thisMonth;
      });

      advisorContext = `\n\nYour Meeting Data:
      - Total meetings in database: ${allMeetings.length}
      - Meetings last month: ${lastMonthMeetings.length}
      - Meetings this month: ${thisMonthMeetings.length}
      - Total clients: ${allClients ? allClients.length : 0}

      Recent Meetings:
      ${allMeetings.slice(0, 10).map(m =>
        `• ${m.title} (${new Date(m.starttime).toLocaleDateString()})${m.quick_summary ? ` - ${m.quick_summary.substring(0, 100)}...` : ''}`
      ).join('\n')}`;
    }

    // Add enhanced context based on thread type
    let specificContext = '';

    if (thread.context_type === 'meeting' && thread.meeting_id) {
      // Meeting-specific context
      console.log(`🔍 Looking for meeting with googleeventid: ${thread.meeting_id}`);
      console.log(`📊 Available meetings count: ${allMeetings?.length || 0}`);

      const meetingData = allMeetings?.find(m => m.googleeventid === thread.meeting_id);
      console.log(`🎯 Found meeting data:`, meetingData ? 'YES' : 'NO');

      if (meetingData) {
        console.log(`✅ Meeting found: ${meetingData.title}`);
        console.log(`📝 Has transcript: ${!!meetingData.transcript}`);
        console.log(`📋 Has quick summary: ${!!meetingData.quick_summary}`);

        // Build comprehensive meeting context with explicit instructions
        let meetingContextParts = [
          `=== SPECIFIC MEETING CONTEXT ===`,
          `Meeting Title: ${meetingData.title}`,
          `Date: ${new Date(meetingData.starttime).toLocaleDateString()}`,
          `Attendees: ${meetingData.attendees || 'Not specified'}`,
          ``
        ];

        if (meetingData.quick_summary) {
          meetingContextParts.push(`QUICK SUMMARY:`);
          meetingContextParts.push(meetingData.quick_summary);
          meetingContextParts.push(``);
        }

        if (meetingData.email_summary_draft) {
          meetingContextParts.push(`DETAILED SUMMARY:`);
          meetingContextParts.push(meetingData.email_summary_draft);
          meetingContextParts.push(``);
        }

        if (meetingData.transcript) {
          meetingContextParts.push(`FULL MEETING TRANSCRIPT:`);
          meetingContextParts.push(`"${meetingData.transcript}"`);
          meetingContextParts.push(``);
        }

        meetingContextParts.push(`=== END MEETING CONTEXT ===`);

        // Add proactive insights
        const proactiveInsights = generateProactiveInsights(meetingData);

        // Find related meetings with the same client for cross-reference
        let relatedMeetingsContext = '';
        if (meetingData.attendees) {
          try {
            const attendeeEmails = JSON.parse(meetingData.attendees).map(a => a.email).filter(Boolean);
            if (attendeeEmails.length > 0) {
              const relatedMeetings = allMeetings?.filter(m =>
                m.googleeventid !== meetingData.googleeventid &&
                m.attendees &&
                attendeeEmails.some(email => m.attendees.includes(email))
              ).slice(0, 3);

              if (relatedMeetings && relatedMeetings.length > 0) {
                relatedMeetingsContext = `\n\nRELATED MEETINGS WITH SAME CLIENT(S):
                ${relatedMeetings.map(m =>
                  `• ${m.title} (${new Date(m.starttime).toLocaleDateString()})${m.quick_summary ? ` - ${m.quick_summary}` : ''}`
                ).join('\n')}

                Use this relationship history to provide continuity and context in your responses.`;
              }
            }
          } catch (e) {
            console.log('Error parsing attendees for cross-reference:', e);
          }
        }

        specificContext = `\n\n${meetingContextParts.join('\n')}

        ${proactiveInsights}${relatedMeetingsContext}

        CRITICAL: You are discussing the specific meeting "${meetingData.title}" from ${new Date(meetingData.starttime).toLocaleDateString()}.
        - Reference specific quotes, decisions, and details from the transcript above
        - Mention specific client concerns, goals, or situations discussed
        - Provide insights based on the actual conversation content
        - Suggest follow-up actions based on what was actually discussed
        - Cross-reference with related meetings when relevant for relationship continuity
        - Never give generic responses when you have this specific meeting data
        - Be proactive in offering relevant insights and suggestions based on the meeting content`;
      } else {
        console.log(`❌ No meeting found with googleeventid: ${thread.meeting_id}`);
        console.log(`📋 Available googleeventids:`, allMeetings?.slice(0, 5).map(m => m.googleeventid));
      }
    } else if (thread.context_type === 'client' && thread.client_id && thread.clients) {
      // Client-specific context
      const clientEmail = thread.clients.email;
      const clientName = thread.clients.name;

      // Get recent meetings for this specific client
      const clientMeetings = allMeetings?.filter(m => {
        if (!m.attendees) return false;
        try {
          const attendeesList = typeof m.attendees === 'string' ? JSON.parse(m.attendees) : m.attendees;
          return Array.isArray(attendeesList) && attendeesList.some(attendee =>
            (typeof attendee === 'string' && attendee.toLowerCase().includes(clientEmail.toLowerCase())) ||
            (typeof attendee === 'object' && attendee.email && attendee.email.toLowerCase() === clientEmail.toLowerCase())
          );
        } catch (e) {
          // Fallback to string search if JSON parsing fails
          return m.attendees.toLowerCase().includes(clientEmail.toLowerCase());
        }
      }) || [];

      if (clientMeetings.length > 0) {
        specificContext = `\n\nClient-Specific Context for ${clientName} (${clientEmail}):
        - Total meetings with this client: ${clientMeetings.length}
        - Recent meetings:
        ${clientMeetings.slice(0, 5).map(m =>
          `• ${m.title} (${new Date(m.starttime).toLocaleDateString()})${m.quick_summary ? ` - ${m.quick_summary}` : ''}`
        ).join('\n')}

        IMPORTANT: This conversation is specifically about ${clientName}. Focus your responses on this client's relationship, meetings, and specific needs.`;
      }
    } else if (thread.context_type === 'general') {
      // General context
      specificContext = `\n\nGeneral Advisory Context:
      - This is a general advisory conversation covering cross-client insights and portfolio-level analysis
      - You have access to data from all ${allMeetings?.length || 0} meetings and ${allClients?.length || 0} clients
      - Focus on broader financial planning, market insights, and business development advice`;
    }

    // Add mentioned clients context
    let mentionedClientsContext = '';
    if (mentionedClients && mentionedClients.length > 0) {
      const mentionedClientDetails = [];

      for (const mentionedClient of mentionedClients) {
        // Get meetings for this mentioned client
        const clientMeetings = allMeetings?.filter(m => {
          if (!m.attendees) return false;
          try {
            const attendeesList = typeof m.attendees === 'string' ? JSON.parse(m.attendees) : m.attendees;
            return Array.isArray(attendeesList) && attendeesList.some(attendee =>
              (typeof attendee === 'string' && attendee.toLowerCase().includes(mentionedClient.email.toLowerCase())) ||
              (typeof attendee === 'object' && attendee.email && attendee.email.toLowerCase() === mentionedClient.email.toLowerCase())
            );
          } catch (e) {
            // Fallback to string search if JSON parsing fails
            return JSON.stringify(m.attendees).toLowerCase().includes(mentionedClient.email.toLowerCase());
          }
        }) || [];

        // Get client details from database
        const { data: fullClientData } = await getSupabase()
          .from('clients')
          .select('*')
          .eq('id', mentionedClient.id)
          .single();

        mentionedClientDetails.push({
          ...mentionedClient,
          meetings: clientMeetings,
          fullData: fullClientData
        });
      }

      mentionedClientsContext = `\n\nMentioned Clients Context:
      ${mentionedClientDetails.map(client => `
      Client: ${client.name} (${client.email})
      Status: ${client.status || 'Unknown'}
      ${client.fullData ? `Value: ${client.fullData.likely_value || 'Not set'}, Close Month: ${client.fullData.likely_close_month || 'Not set'}` : ''}
      Recent Meetings: ${client.meetings.length}
      ${client.meetings.slice(0, 3).map(m =>
        `  • ${m.title} (${new Date(m.starttime).toLocaleDateString()})${m.quick_summary ? ` - ${m.quick_summary.substring(0, 80)}...` : ''}`
      ).join('\n')}
      `).join('\n')}`;
    }

    // Generate AI response with enhanced context-aware prompt
    const systemPrompt = `You are Advicly AI, an expert financial advisor assistant with deep contextual awareness.

    CRITICAL INSTRUCTIONS:
    1. You have access to SPECIFIC meeting transcripts, client data, and conversation details below
    2. ALWAYS reference and use the actual data provided - never give generic responses
    3. When discussing meetings, quote specific details from transcripts and summaries
    4. Demonstrate deep understanding by referencing specific client situations, decisions made, and action items
    5. Provide proactive insights based on the actual meeting content
    6. Cross-reference information across multiple meetings when relevant

    CONTEXT DATA AVAILABLE:
    ${advisorContext}${specificContext}${mentionedClientsContext}

    RESPONSE GUIDELINES:
    - Always start responses by acknowledging the specific context (e.g., "Based on your meeting with John on August 12th...")
    - Quote specific details from transcripts when available
    - Reference specific decisions, concerns, or goals mentioned in meetings
    - Provide actionable insights based on the actual conversation content
    - Suggest follow-up actions based on what was discussed
    - Never say you don't have access to information when context data is provided above

    Your responses should demonstrate that you have thoroughly "read" and "understood" the specific meeting content.`;

    // Log context for debugging
    console.log('🎯 Final system prompt length:', systemPrompt.length);
    console.log('📋 Context includes meeting data:', specificContext.includes('MEETING CONTEXT'));
    console.log('💬 User question:', content.trim());
    console.log('🔍 System prompt preview:', systemPrompt.substring(0, 500) + '...');

    // Log specific context details
    if (thread.context_type === 'meeting') {
      console.log('🎪 Meeting context details:');
      console.log('  - Meeting ID:', thread.meeting_id);
      console.log('  - Context data:', JSON.stringify(thread.context_data, null, 2));
      console.log('  - Specific context length:', specificContext.length);
    }

    const aiResponse = await generateChatResponse(content.trim(), systemPrompt, 1200);

    // Save AI response
    const { data: aiMessage, error: aiMessageError } = await getSupabase()
      .from('ask_messages')
      .insert({
        thread_id: threadId,
        role: 'assistant',
        content: aiResponse
      })
      .select()
      .single();

    if (aiMessageError) {
      console.error('Error saving AI message:', aiMessageError);
      return res.status(500).json({ error: 'Failed to save AI response' });
    }

    // Update thread timestamp
    await getSupabase()
      .from('ask_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId);

    res.json({
      userMessage,
      aiMessage
    });
  } catch (error) {
    console.error('Error in POST /threads/:threadId/messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update thread title
router.patch('/threads/:threadId', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const { threadId } = req.params;
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    const { data: thread, error } = await getSupabase()
      .from('ask_threads')
      .update({ 
        title: title.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId)
      .eq('advisor_id', advisorId)
      .select()
      .single();

    if (error) {
      console.error('Error updating thread:', error);
      return res.status(500).json({ error: 'Failed to update thread' });
    }

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    res.json(thread);
  } catch (error) {
    console.error('Error in PATCH /threads/:threadId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



module.exports = router;
