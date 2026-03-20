const express = require('express');
const { isSupabaseAvailable, getSupabase } = require('../lib/supabase');
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');
const { generateMeetingSummary, generateChatResponse } = require('../services/openai');
const clientDocumentsService = require('../services/clientDocuments');
const { askAdviclyMessage, conversationUpdate } = require('../middleware/validators');

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

// Test route - simple health check
router.get('/test', (req, res) => {
  res.json({ message: 'Ask Advicly routes working!' });
});

// SECURITY: Debug endpoint removed - was exposing meeting data without proper user filtering
// The /debug/meetings endpoint has been removed as it returned data from any user
// without authentication or ownership verification

// Get all threads for an advisor with enhanced context support
router.get('/threads', authenticateSupabaseUser, async (req, res) => {
  try {
    const advisorId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    const { data: threads, error } = await req.supabase
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
      .eq('user_id', advisorId)
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
router.get('/threads/:threadId/messages', authenticateSupabaseUser, async (req, res) => {
  try {
    const advisorId = req.user.id;
    const { threadId } = req.params;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Verify thread belongs to advisor
    const { data: thread, error: threadError } = await req.supabase
      .from('ask_threads')
      .select('id')
      .eq('id', threadId)
      .eq('user_id', advisorId)
      .single();

    if (threadError || !thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const { data: messages, error } = await req.supabase
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
router.post('/threads', authenticateSupabaseUser, async (req, res) => {
  try {
    const advisorId = req.user.id;
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

    const { data: thread, error } = await req.supabase
      .from('ask_threads')
      .insert({
        user_id: advisorId,
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
router.post('/threads/:threadId/messages', authenticateSupabaseUser, ...askAdviclyMessage, async (req, res) => {
  try {
    const advisorId = req.user.id;
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
    const { data: thread, error: threadError } = await req.supabase
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
      .eq('user_id', advisorId)
      .single();

    if (threadError || !thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Save user message
    const { data: userMessage, error: userMessageError } = await req.supabase
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

    // Base meeting + client queries (scoped later depending on thread type)
    const { data: allMeetings } = await req.supabase
      .from('meetings')
      .select('id, external_id, title, starttime, endtime, transcript, quick_summary, detailed_summary, attendees')
      .eq('user_id', advisorId)
      .eq('is_deleted', false) // Only get non-deleted meetings
      .order('starttime', { ascending: false })
      .limit(200); // Increased limit to ensure we get all client meetings for accurate counts

    const { data: allClients } = await req.supabase
      .from('clients')
      .select('id, name, email, pipeline_stage, notes')
      .eq('user_id', advisorId);

    // Cross-client hard block: if this is a client-specific thread and the
    // advisor appears to ask about a different client, block and suggest
    // using an all-clients chat instead.
    let primaryClient = null;
    let mentionedOtherClient = null;

    if (thread.context_type === 'client' && thread.client_id && allClients && Array.isArray(allClients)) {
      primaryClient = allClients.find(c => c.id === thread.client_id) || null;
      const lowerContent = content.toLowerCase();

      for (const c of allClients) {
        if (c.id === thread.client_id) continue;
        if (!c || (!c.name && !c.email)) continue;

        const nameMatch = c.name && c.name.length > 2 && lowerContent.includes(c.name.toLowerCase());
        const emailMatch = c.email && lowerContent.includes(c.email.toLowerCase());

        if (nameMatch || emailMatch) {
          mentionedOtherClient = c;
          break;
        }
      }
    }

    if (primaryClient && mentionedOtherClient) {
      const blockText = `This conversation is scoped only to ${primaryClient.name || primaryClient.email}.
It looks like you may be asking about another client (${mentionedOtherClient.name || mentionedOtherClient.email}).
\nTo ask about other clients or compare across your whole client base, please start an "All clients" chat (orange in the sidebar).`;

      const { data: aiMessage, error: aiMessageError } = await req.supabase
        .from('ask_messages')
        .insert({
          thread_id: threadId,
          role: 'assistant',
          content: blockText
        })
        .select()
        .single();

      if (aiMessageError) {
        console.error('Error saving cross-client block message:', aiMessageError);
        return res.status(500).json({ error: 'Failed to save AI response' });
      }

      return res.json({
        userMessage,
        aiMessage,
        crossClientBlock: true,
        primaryClient: primaryClient
          ? { id: primaryClient.id, name: primaryClient.name, email: primaryClient.email }
          : null,
        mentionedClient: mentionedOtherClient
          ? { id: mentionedOtherClient.id, name: mentionedOtherClient.name, email: mentionedOtherClient.email }
          : null
      });
    }

    // Fetch documents for this client/meeting when applicable so AI can use PDFs etc.
    let clientDocuments = [];
    let meetingDocuments = [];

    try {
      if (thread.context_type === 'client' && thread.client_id) {
        clientDocuments = await clientDocumentsService.getClientDocuments(thread.client_id, advisorId);
      }

      if (thread.context_type === 'meeting' && thread.meeting_id) {
        meetingDocuments = await clientDocumentsService.getMeetingDocuments(thread.meeting_id, advisorId);
      }
    } catch (docError) {
      console.error('Error loading client/meeting documents for Ask Advicly context:', docError);
    }

    // Build human-readable document context text
    let documentsContext = '';

    if ((clientDocuments && clientDocuments.length > 0) || (meetingDocuments && meetingDocuments.length > 0)) {
      const formatDoc = (doc) => {
        const parts = [];
        if (doc.original_name) parts.push(`File: ${doc.original_name}`);
        if (doc.file_category) parts.push(`Type: ${doc.file_category}`);
        if (doc.ai_summary) {
          parts.push(`AI summary: ${doc.ai_summary}`);
        } else if (doc.extracted_text) {
          parts.push(`Key content: ${doc.extracted_text.substring(0, 600)}${doc.extracted_text.length > 600 ? '...' : ''}`);
        }
        return parts.join(' | ');
      };

      if (clientDocuments && clientDocuments.length > 0) {
        documentsContext += `\n\nClient Documents (for this client):\n${clientDocuments.slice(0, 6).map(d => `- ${formatDoc(d)}`).join('\n')}`;
        if (clientDocuments.length > 6) {
          documentsContext += `\n(+ ${clientDocuments.length - 6} more client document(s) not fully shown)`;
        }
      }

      if (meetingDocuments && meetingDocuments.length > 0) {
        documentsContext += `\n\nMeeting Documents (for this specific meeting):\n${meetingDocuments.slice(0, 6).map(d => `- ${formatDoc(d)}`).join('\n')}`;
        if (meetingDocuments.length > 6) {
          documentsContext += `\n(+ ${meetingDocuments.length - 6} more meeting document(s) not fully shown)`;
        }
      }
    }

    // By default, build a lightweight global stats block; more detail is added per-context below
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

      advisorContext = `\n\nYour Overall Meeting Data:
      - Total meetings in database: ${allMeetings.length}
      - Meetings last month: ${lastMonthMeetings.length}
      - Meetings this month: ${thisMonthMeetings.length}
      - Total clients: ${allClients ? allClients.length : 0}`;
    }

    // Add enhanced context based on thread type
    let specificContext = '';

    if (thread.context_type === 'meeting' && thread.meeting_id) {
      // Meeting-specific context – use numeric ID first, then external_id fallback
      console.log(`🔍 Looking for meeting with id or external_id: ${thread.meeting_id}`);
      console.log(`📊 Available meetings count: ${allMeetings?.length || 0}`);

      const meetingData = allMeetings?.find(m => {
        const idMatch = String(m.id) === String(thread.meeting_id);
        const externalMatch = m.external_id && String(m.external_id) === String(thread.meeting_id);
        return idMatch || externalMatch;
      });

      console.log('🎯 Found meeting data:', meetingData ? 'YES' : 'NO');

      if (meetingData) {
        console.log(`✅ Meeting found: ${meetingData.title}`);
        console.log('📝 Has transcript:', !!meetingData.transcript);
        console.log('📋 Has quick summary:', !!meetingData.quick_summary);

        let meetingContextParts = [
          '=== SPECIFIC MEETING CONTEXT ===',
          `Meeting Title: ${meetingData.title}`,
          `Date: ${new Date(meetingData.starttime).toLocaleDateString()}`,
          `Attendees: ${meetingData.attendees || 'Not specified'}`,
          ''
        ];

        if (meetingData.quick_summary) {
          meetingContextParts.push('QUICK SUMMARY:');
          meetingContextParts.push(meetingData.quick_summary);
          meetingContextParts.push('');
        }

        if (meetingData.detailed_summary) {
          meetingContextParts.push('DETAILED SUMMARY:');
          meetingContextParts.push(meetingData.detailed_summary);
          meetingContextParts.push('');
        }

        if (meetingData.transcript) {
          meetingContextParts.push('FULL MEETING TRANSCRIPT:');
          meetingContextParts.push(`"${meetingData.transcript}"`);
          meetingContextParts.push('');
        }

        meetingContextParts.push('=== END MEETING CONTEXT ===');

        const proactiveInsights = generateProactiveInsights(meetingData);

        // Extract client email from meeting attendees to provide broader client context
        let clientEmail = null;
        let clientName = null;
        try {
          const attendeesList = typeof meetingData.attendees === 'string'
            ? JSON.parse(meetingData.attendees)
            : meetingData.attendees;

          if (Array.isArray(attendeesList) && attendeesList.length > 0) {
            // Find the first attendee that's not the advisor (assuming advisor is the user)
            const { data: advisorData } = await req.supabase
              .from('users')
              .select('email')
              .eq('id', advisorId)
              .single();

            const advisorEmail = advisorData?.email?.toLowerCase();
            const clientAttendee = attendeesList.find(a => {
              const email = typeof a === 'string' ? a : a.email;
              return email && email.toLowerCase() !== advisorEmail;
            });

            if (clientAttendee) {
              clientEmail = typeof clientAttendee === 'string' ? clientAttendee : clientAttendee.email;
              clientName = typeof clientAttendee === 'object' ? clientAttendee.name : null;
            }
          }
        } catch (e) {
          console.error('Error extracting client from attendees:', e);
        }

        // If we found a client email, add all their meetings to context
        let clientMeetingsContext = '';
        if (clientEmail) {
          const clientMeetings = allMeetings?.filter(m => {
            if (!m.attendees || m.id === meetingData.id) return false; // Exclude current meeting
            try {
              const attendeesList = typeof m.attendees === 'string' ? JSON.parse(m.attendees) : m.attendees;
              return Array.isArray(attendeesList) && attendeesList.some(attendee =>
                (typeof attendee === 'string' && attendee.toLowerCase() === clientEmail.toLowerCase()) ||
                (typeof attendee === 'object' && attendee.email && attendee.email.toLowerCase() === clientEmail.toLowerCase())
              );
            } catch (e) {
              return String(m.attendees).toLowerCase().includes(clientEmail.toLowerCase());
            }
          }) || [];

          if (clientMeetings.length > 0) {
            clientMeetingsContext = `\n\n=== CLIENT MEETING HISTORY ===
Client: ${clientName || clientEmail}
Total past meetings with this client: ${clientMeetings.length}

Recent meetings:
${clientMeetings.slice(0, 10).map(m =>
  `• ${m.title} (${new Date(m.starttime).toLocaleDateString()})${m.quick_summary ? ` - ${m.quick_summary}` : ''}`
).join('\n')}

=== END CLIENT MEETING HISTORY ===`;
          }
        }

        specificContext = `\n\n${meetingContextParts.join('\n')}

        ${proactiveInsights}
        ${clientMeetingsContext}

        CRITICAL: You are discussing the specific meeting "${meetingData.title}" from ${new Date(meetingData.starttime).toLocaleDateString()}${clientName ? ` with ${clientName}` : ''}.
        - You have access to the full meeting transcript and summary above${clientMeetingsContext ? ', as well as the complete history of meetings with this client' : ''}
        - When asked about this client's meeting history, use the CLIENT MEETING HISTORY section above to provide accurate counts and details
        - Reference specific quotes, decisions, and details from the transcript
        - Mention specific client concerns, goals, or situations discussed
        - Provide insights and follow-up actions based on what was actually discussed`;
      } else {
        console.log('❌ No meeting found for thread.meeting_id:', thread.meeting_id);
      }
    } else if (thread.context_type === 'client' && thread.client_id && thread.clients) {
      // Client-specific context — load FULL meeting data for this client
      const clientEmail = thread.clients.email;
      const clientName = thread.clients.name;

      // Also get full client record with notes, pipeline info
      const clientRecord = allClients?.find(c => c.id === thread.client_id);

      const clientMeetings = allMeetings?.filter(m => {
        if (!m.attendees) return false;
        try {
          const attendeesList = typeof m.attendees === 'string' ? JSON.parse(m.attendees) : m.attendees;
          return Array.isArray(attendeesList) && attendeesList.some(attendee => {
            const email = typeof attendee === 'string' ? attendee : attendee?.email;
            return email && email.toLowerCase() === clientEmail.toLowerCase();
          });
        } catch (e) {
          return String(m.attendees).toLowerCase().includes(clientEmail.toLowerCase());
        }
      }) || [];

      if (clientMeetings.length > 0) {
        // Build detailed meeting context — transcripts for recent 3, summaries for all
        const meetingDetails = clientMeetings.slice(0, 15).map((m, idx) => {
          let detail = `\n--- Meeting ${idx + 1}: ${m.title} (${new Date(m.starttime).toLocaleDateString()}) ---`;
          if (m.quick_summary) detail += `\nQuick Summary: ${m.quick_summary}`;
          if (m.detailed_summary) detail += `\nDetailed Summary: ${m.detailed_summary}`;
          // Include full transcript for the 3 most recent meetings
          if (idx < 3 && m.transcript) {
            detail += `\nFull Transcript: "${m.transcript}"`;
          }
          return detail;
        }).join('\n');

        specificContext = `\n\n=== CLIENT CONTEXT: ${clientName} (${clientEmail}) ===
Pipeline Stage: ${clientRecord?.pipeline_stage || 'Not set'}
Notes: ${clientRecord?.notes || 'None'}
Total meetings: ${clientMeetings.length}

MEETING DATA:${meetingDetails}
=== END CLIENT CONTEXT ===

CRITICAL: This conversation is specifically about ${clientName}. Use the meeting data above to answer accurately. Do not discuss other clients.`;
      } else {
        specificContext = `\n\nClient-Specific Context for ${clientName} (${clientEmail}):
        Pipeline Stage: ${clientRecord?.pipeline_stage || 'Not set'}
        Notes: ${clientRecord?.notes || 'None'}
        - No past meetings found in the system.`;
      }
    } else if (thread.context_type === 'general') {
      // General / all-clients context — include meeting data when client names are mentioned
      let generalMeetingContext = '';

      // Check if user is asking about a specific client by name
      const lowerContent = content.toLowerCase();
      const mentionedClient = allClients?.find(c =>
        c.name && c.name.length > 2 && lowerContent.includes(c.name.toLowerCase())
      );

      if (mentionedClient) {
        // User mentioned a specific client — pull their full meeting data
        const clientMeetings = allMeetings?.filter(m => {
          if (!m.attendees) return false;
          try {
            const attendeesList = typeof m.attendees === 'string' ? JSON.parse(m.attendees) : m.attendees;
            return Array.isArray(attendeesList) && attendeesList.some(attendee => {
              const email = typeof attendee === 'string' ? attendee : attendee?.email;
              return email && mentionedClient.email && email.toLowerCase() === mentionedClient.email.toLowerCase();
            });
          } catch (e) {
            return mentionedClient.email && String(m.attendees).toLowerCase().includes(mentionedClient.email.toLowerCase());
          }
        }) || [];

        const meetingDetails = clientMeetings.slice(0, 10).map((m, idx) => {
          let detail = `\n--- Meeting ${idx + 1}: ${m.title} (${new Date(m.starttime).toLocaleDateString()}) ---`;
          if (m.quick_summary) detail += `\nQuick Summary: ${m.quick_summary}`;
          if (m.detailed_summary) detail += `\nDetailed Summary: ${m.detailed_summary}`;
          if (idx < 3 && m.transcript) {
            detail += `\nFull Transcript: "${m.transcript}"`;
          }
          return detail;
        }).join('\n');

        generalMeetingContext = `\n\n=== DATA FOR MENTIONED CLIENT: ${mentionedClient.name} (${mentionedClient.email}) ===
Pipeline Stage: ${mentionedClient.pipeline_stage || 'Not set'}
Notes: ${mentionedClient.notes || 'None'}
Total meetings: ${clientMeetings.length}

MEETING DATA:${meetingDetails}
=== END CLIENT DATA ===`;
      }

      // Client overview
      const clientOverview = allClients?.slice(0, 50).map(c =>
        `• ${c.name} (${c.email}) — ${c.pipeline_stage || 'No stage'}`
      ).join('\n') || 'No clients';

      // Recent meetings overview
      const recentMeetings = allMeetings?.slice(0, 20).map(m =>
        `• ${m.title} (${new Date(m.starttime).toLocaleDateString()})${m.quick_summary ? ` — ${m.quick_summary}` : ''}`
      ).join('\n') || 'No meetings';

      specificContext = `\n\nGeneral Advisory Context (All Clients):
- Total clients: ${allClients?.length || 0}
- Total meetings: ${allMeetings?.length || 0}

CLIENT LIST:
${clientOverview}

RECENT MEETINGS:
${recentMeetings}${generalMeetingContext}

You may discuss any client or provide cross-client insights.`;
    }

    // Add mentioned clients context (used mainly for general threads)
    let mentionedClientsContext = '';
    if (mentionedClients && mentionedClients.length > 0) {
      const mentionedClientDetails = [];

      for (const mentionedClient of mentionedClients) {
        const clientMeetings = allMeetings?.filter(m => {
          if (!m.attendees) return false;
          try {
            const attendeesList = typeof m.attendees === 'string' ? JSON.parse(m.attendees) : m.attendees;
            return Array.isArray(attendeesList) && attendeesList.some(attendee =>
              (typeof attendee === 'string' && attendee.toLowerCase().includes(mentionedClient.email.toLowerCase())) ||
              (typeof attendee === 'object' && attendee.email && attendee.email.toLowerCase() === mentionedClient.email.toLowerCase())
            );
          } catch (e) {
            return JSON.stringify(m.attendees).toLowerCase().includes(mentionedClient.email.toLowerCase());
          }
        }) || [];

        const { data: fullClientData } = await req.supabase
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

    const systemPrompt = `You are Advicly AI, an expert financial advisor assistant with deep contextual awareness.

    CRITICAL INSTRUCTIONS:
    1. You have access to SPECIFIC meeting transcripts, client data, uploaded documents, and conversation details below
    2. ALWAYS reference and use the actual data provided - never give generic responses
    3. When discussing meetings, quote specific details from transcripts, summaries, and documents
    4. Demonstrate deep understanding by referencing specific client situations, decisions made, and action items
    5. Provide proactive insights based on the actual meeting content and any uploaded PDFs/documents
    6. Respect the current conversation scope:
       - If this is a client-specific thread, do NOT discuss other clients.
       - If this is a meeting-specific thread, focus primarily on that meeting (you may bring in history for the SAME client).
       - If this is a general thread, you may draw on all clients as appropriate.

    CONTEXT DATA AVAILABLE:
    ${advisorContext}${specificContext}${mentionedClientsContext}${documentsContext}

    RESPONSE GUIDELINES:
    - Always start responses by acknowledging the specific context (e.g., "Based on your meeting with John on August 12th...")
    - Quote specific details from transcripts when available
    - Reference specific decisions, concerns, or goals mentioned in meetings
    - Explicitly reference relevant uploaded documents where helpful (e.g., suitability reports, statements, fact finds)
    - Provide actionable insights based on the actual conversation content and documents
    - Suggest follow-up actions based on what was discussed
    - Never say you don't have access to information when context data is provided above

    Your responses should demonstrate that you have thoroughly "read" and "understood" the specific meeting, client context, and any related documents.`;

    console.log('🎯 Final system prompt length:', systemPrompt.length);
    console.log('📋 Context includes meeting data:', specificContext.includes('MEETING CONTEXT') || specificContext.includes('SPECIFIC MEETING CONTEXT'));
    console.log('💬 User question:', content.trim());
    console.log('🔍 System prompt preview:', systemPrompt.substring(0, 500) + '...');

    if (thread.context_type === 'meeting') {
      console.log('🎪 Meeting context details:');
      console.log('  - Meeting ID:', thread.meeting_id);
      console.log('  - Context data:', JSON.stringify(thread.context_data, null, 2));
      console.log('  - Specific context length:', specificContext.length);
    }

    // Load conversation history for multi-turn context
    const { data: previousMessages } = await req.supabase
      .from('ask_messages')
      .select('role, content')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(20);

    const conversationHistory = (previousMessages || []).map(m => ({ role: m.role, content: m.content }));

    const aiResponse = await generateChatResponse(content.trim(), systemPrompt, 1200, conversationHistory);

    const { data: aiMessage, error: aiMessageError } = await req.supabase
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

    await req.supabase
      .from('ask_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId);

    res.json({
      userMessage,
      aiMessage,
      // For future frontend UX: indicate this response came from a scoped thread
      meta: {
        contextType: thread.context_type,
        clientId: thread.client_id,
        meetingId: thread.meeting_id
      }
    });
  } catch (error) {
    console.error('Error in POST /threads/:threadId/messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update thread title
router.patch('/threads/:threadId', authenticateSupabaseUser, ...conversationUpdate, async (req, res) => {
  try {
    const advisorId = req.user.id;
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

    const { data: thread, error } = await req.supabase
      .from('ask_threads')
      .update({
        title: title.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId)
      .eq('user_id', advisorId)
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



// SSE streaming endpoint for floating widget — sends progress stages + streamed AI response
router.post('/threads/:threadId/messages/stream', authenticateSupabaseUser, ...askAdviclyMessage, async (req, res) => {
  const { threadId } = req.params;
  const advisorId = req.user.id;
  const { content, contextType, contextData, mentionedClients } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  if (!isSupabaseAvailable()) {
    return res.status(503).json({ error: 'Database service unavailable' });
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const sendStage = (stage, status, label) => {
    res.write(`data: ${JSON.stringify({ stage, status, label })}\n\n`);
  };

  const sendChunk = (chunk) => {
    res.write(`data: ${JSON.stringify({ stage: 'response', chunk })}\n\n`);
  };

  const sendDone = (messageId) => {
    res.write(`data: ${JSON.stringify({ stage: 'done', messageId })}\n\n`);
    res.end();
  };

  try {
    // Verify thread belongs to advisor
    sendStage('client', 'loading', 'Finding client profile...');

    const { data: thread, error: threadError } = await req.supabase
      .from('ask_threads')
      .select('id, client_id, context_type, context_data, meeting_id, clients(name, email)')
      .eq('id', threadId)
      .eq('user_id', advisorId)
      .single();

    if (threadError || !thread) {
      sendStage('client', 'done', 'Thread not found');
      res.write(`data: ${JSON.stringify({ stage: 'error', message: 'Thread not found' })}\n\n`);
      return res.end();
    }

    // Save user message
    const { data: userMessage } = await req.supabase
      .from('ask_messages')
      .insert({ thread_id: threadId, role: 'user', content: content.trim() })
      .select()
      .single();

    const clientName = thread.clients?.name || contextData?.clientName || 'client';
    sendStage('client', 'done', `Found: ${clientName}`);

    // Smart context loading based on thread type
    sendStage('meetings', 'loading', 'Loading meeting transcripts...');

    let allMeetings = [];
    let allClients = [];
    let specificContext = '';
    let advisorContext = '';

    if (thread.context_type === 'meeting' && thread.meeting_id) {
      // Meeting thread: load only this meeting + client's other meetings (max 5)
      const { data: meetings } = await req.supabase
        .from('meetings')
        .select('id, external_id, title, starttime, endtime, transcript, quick_summary, detailed_summary, attendees')
        .eq('user_id', advisorId)
        .eq('is_deleted', false)
        .order('starttime', { ascending: false })
        .limit(50);

      allMeetings = meetings || [];

      const meetingData = allMeetings.find(m =>
        String(m.id) === String(thread.meeting_id) || (m.external_id && String(m.external_id) === String(thread.meeting_id))
      );

      if (meetingData) {
        sendStage('meetings', 'done', `Loaded: ${meetingData.title}`);

        let meetingContextParts = [
          '=== SPECIFIC MEETING CONTEXT ===',
          `Meeting Title: ${meetingData.title}`,
          `Date: ${new Date(meetingData.starttime).toLocaleDateString()}`,
          `Attendees: ${meetingData.attendees || 'Not specified'}`,
          ''
        ];

        if (meetingData.quick_summary) {
          meetingContextParts.push('QUICK SUMMARY:', meetingData.quick_summary, '');
        }
        if (meetingData.detailed_summary) {
          meetingContextParts.push('DETAILED SUMMARY:', meetingData.detailed_summary, '');
        }
        if (meetingData.transcript) {
          meetingContextParts.push('FULL MEETING TRANSCRIPT:', `"${meetingData.transcript}"`, '');
        }
        meetingContextParts.push('=== END MEETING CONTEXT ===');

        // Find client's other meetings
        let clientEmail = null;
        try {
          const attendeesList = typeof meetingData.attendees === 'string' ? JSON.parse(meetingData.attendees) : meetingData.attendees;
          if (Array.isArray(attendeesList) && attendeesList.length > 0) {
            const { data: advisorData } = await req.supabase.from('users').select('email').eq('id', advisorId).single();
            const advisorEmail = advisorData?.email?.toLowerCase();
            const clientAttendee = attendeesList.find(a => {
              const email = typeof a === 'string' ? a : a.email;
              return email && email.toLowerCase() !== advisorEmail;
            });
            if (clientAttendee) {
              clientEmail = typeof clientAttendee === 'string' ? clientAttendee : clientAttendee.email;
            }
          }
        } catch (e) { /* ignore */ }

        let clientMeetingsContext = '';
        if (clientEmail) {
          const clientMeetings = allMeetings.filter(m => {
            if (!m.attendees || m.id === meetingData.id) return false;
            try {
              const al = typeof m.attendees === 'string' ? JSON.parse(m.attendees) : m.attendees;
              return Array.isArray(al) && al.some(a => (typeof a === 'string' ? a : a.email || '').toLowerCase() === clientEmail.toLowerCase());
            } catch (e) { return false; }
          }).slice(0, 5);

          if (clientMeetings.length > 0) {
            clientMeetingsContext = `\n\n=== CLIENT MEETING HISTORY ===\nRecent meetings:\n${clientMeetings.map(m =>
              `• ${m.title} (${new Date(m.starttime).toLocaleDateString()})${m.quick_summary ? ` - ${m.quick_summary}` : ''}`
            ).join('\n')}\n=== END CLIENT MEETING HISTORY ===`;
          }
        }

        specificContext = `\n\n${meetingContextParts.join('\n')}${clientMeetingsContext}\n\nCRITICAL: You are discussing the meeting "${meetingData.title}" from ${new Date(meetingData.starttime).toLocaleDateString()}.`;
      } else {
        sendStage('meetings', 'done', 'Meeting not found');
      }
    } else if (thread.context_type === 'client' && thread.client_id) {
      // Client thread: load only this client's meetings
      const { data: meetings } = await req.supabase
        .from('meetings')
        .select('id, external_id, title, starttime, endtime, transcript, quick_summary, attendees')
        .eq('user_id', advisorId)
        .eq('is_deleted', false)
        .order('starttime', { ascending: false })
        .limit(100);

      allMeetings = meetings || [];
      const clientEmail = thread.clients?.email;

      const clientMeetings = clientEmail ? allMeetings.filter(m => {
        if (!m.attendees) return false;
        try {
          const al = typeof m.attendees === 'string' ? JSON.parse(m.attendees) : m.attendees;
          return Array.isArray(al) && al.some(a => (typeof a === 'string' ? a : a.email || '').toLowerCase() === clientEmail.toLowerCase());
        } catch (e) { return false; }
      }) : [];

      sendStage('meetings', 'done', `Loaded ${clientMeetings.length} meetings`);

      if (clientMeetings.length > 0) {
        specificContext = `\n\nClient-Specific Context for ${clientName} (${clientEmail}):\n- Total meetings: ${clientMeetings.length}\n- Recent meetings:\n${clientMeetings.slice(0, 10).map(m =>
          `• ${m.title} (${new Date(m.starttime).toLocaleDateString()})${m.quick_summary ? ` - ${m.quick_summary}` : ''}`
        ).join('\n')}\n\nIMPORTANT: This conversation is specifically about ${clientName}.`;
      } else {
        specificContext = `\n\nClient-Specific Context for ${clientName}:\n- No past meetings found.`;
      }
    } else {
      // General thread: load summaries only, not full transcripts
      const { data: meetings } = await req.supabase
        .from('meetings')
        .select('id, title, starttime, quick_summary, attendees')
        .eq('user_id', advisorId)
        .eq('is_deleted', false)
        .order('starttime', { ascending: false })
        .limit(100);

      allMeetings = meetings || [];

      const { data: clients } = await req.supabase
        .from('clients')
        .select('id, name, email, pipeline_stage')
        .eq('user_id', advisorId);

      allClients = clients || [];

      sendStage('meetings', 'done', `Loaded ${allMeetings.length} meetings`);

      advisorContext = `\nYour Data: ${allMeetings.length} meetings, ${allClients.length} clients`;
      specificContext = `\n\nGeneral Advisory Context:\n- You can discuss all ${allClients.length} clients and ${allMeetings.length} meetings\n- Focus on cross-client insights and portfolio-level analysis`;
    }

    // Load documents
    sendStage('documents', 'loading', 'Scanning client documents...');

    let documentsContext = '';
    try {
      let clientDocuments = [];
      let meetingDocuments = [];

      if (thread.context_type === 'client' && thread.client_id) {
        clientDocuments = await clientDocumentsService.getClientDocuments(thread.client_id, advisorId);
      }
      if (thread.context_type === 'meeting' && thread.meeting_id) {
        meetingDocuments = await clientDocumentsService.getMeetingDocuments(thread.meeting_id, advisorId);
      }

      const totalDocs = (clientDocuments?.length || 0) + (meetingDocuments?.length || 0);
      sendStage('documents', 'done', totalDocs > 0 ? `Found ${totalDocs} documents` : 'No documents');

      const formatDoc = (doc) => {
        const parts = [];
        if (doc.original_name) parts.push(`File: ${doc.original_name}`);
        if (doc.ai_summary) parts.push(`Summary: ${doc.ai_summary}`);
        else if (doc.extracted_text) parts.push(`Content: ${doc.extracted_text.substring(0, 600)}`);
        return parts.join(' | ');
      };

      if (clientDocuments?.length > 0) {
        documentsContext += `\n\nClient Documents:\n${clientDocuments.slice(0, 6).map(d => `- ${formatDoc(d)}`).join('\n')}`;
      }
      if (meetingDocuments?.length > 0) {
        documentsContext += `\n\nMeeting Documents:\n${meetingDocuments.slice(0, 6).map(d => `- ${formatDoc(d)}`).join('\n')}`;
      }
    } catch (docError) {
      sendStage('documents', 'done', 'No documents');
    }

    // Generate AI response
    sendStage('thinking', 'loading', 'Analysing data...');

    const systemPrompt = `You are Advicly AI, an expert financial advisor assistant.

    INSTRUCTIONS:
    1. Use the actual data provided below — never give generic responses
    2. Quote specific details from transcripts and summaries
    3. Respect scope: client threads = only that client; meeting threads = that meeting; general = all clients
    4. Reference uploaded documents where helpful

    CONTEXT:
    ${advisorContext}${specificContext}${documentsContext}

    Be concise, actionable, and reference specific data.`;

    // Load conversation history for context
    const { data: previousMessages } = await req.supabase
      .from('ask_messages')
      .select('role, content')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(20);

    const conversationMessages = [
      { role: 'system', content: systemPrompt },
      ...(previousMessages || []).map(m => ({ role: m.role, content: m.content })),
    ];

    // Stream the response
    const OpenAI = require('openai');
    const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const stream = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: conversationMessages,
      temperature: 0.3,
      max_tokens: 1200,
      stream: true
    });

    let fullResponse = '';

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        fullResponse += text;
        sendChunk(text);
      }
    }

    // Save the AI message to database
    const { data: aiMessage } = await req.supabase
      .from('ask_messages')
      .insert({ thread_id: threadId, role: 'assistant', content: fullResponse })
      .select()
      .single();

    // Update thread timestamp
    await req.supabase
      .from('ask_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId);

    sendDone(aiMessage?.id);
  } catch (error) {
    console.error('Error in streaming message:', error);
    try {
      res.write(`data: ${JSON.stringify({ stage: 'error', message: 'Something went wrong. Please try again.' })}\n\n`);
      res.end();
    } catch (e) {
      // Response may already be closed
    }
  }
});

module.exports = router;
