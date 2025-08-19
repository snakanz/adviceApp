const express = require('express');
const jwt = require('jsonwebtoken');
const { supabase, isSupabaseAvailable, getSupabase } = require('../lib/supabase');
const { generateMeetingSummary, generateChatResponse } = require('../services/openai');

const router = express.Router();

console.log('Ask Advicly router created');

// Test route
router.get('/test', (req, res) => {
  console.log('Test route hit!');
  res.json({ message: 'Ask Advicly routes working!' });
});

console.log('Test route registered');

// Get all threads for an advisor
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

    res.json(threads || []);
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

// Create a new thread
router.post('/threads', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const { clientId, title = 'New Conversation' } = req.body;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    const { data: thread, error } = await getSupabase()
      .from('ask_threads')
      .insert({
        advisor_id: advisorId,
        client_id: clientId || null,
        title
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating thread:', error);
      return res.status(500).json({ error: 'Failed to create thread' });
    }

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
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Verify thread belongs to advisor and get client context
    const { data: thread, error: threadError } = await getSupabase()
      .from('ask_threads')
      .select(`
        id,
        client_id,
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

    // Add specific client context if this is a client-scoped thread
    let clientContext = '';
    if (thread.client_id && thread.clients) {
      const clientEmail = thread.clients.email;
      const clientName = thread.clients.name;

      // Get recent meetings for this specific client
      const clientMeetings = allMeetings?.filter(m =>
        m.attendees && m.attendees.includes(clientEmail)
      ) || [];

      if (clientMeetings.length > 0) {
        clientContext = `\n\nSpecific Client Context for ${clientName} (${clientEmail}):
        - Total meetings with this client: ${clientMeetings.length}
        ${clientMeetings.slice(0, 5).map(m =>
          `• ${m.title} (${new Date(m.starttime).toLocaleDateString()})${m.quick_summary ? ` - ${m.quick_summary}` : ''}`
        ).join('\n')}`;
      }
    }

    // Generate AI response with comprehensive context
    const systemPrompt = `You are Advicly AI, a helpful assistant for financial advisors.
    You help advisors manage their client relationships and provide insights about meetings and client interactions.

    IMPORTANT: Always use the actual data provided below to answer questions. Be specific and accurate with numbers and dates.

    ${advisorContext}${clientContext}

    When answering questions about meetings, clients, or data, always reference the specific information provided above.
    Be concise, professional, and helpful.`;

    const aiResponse = await generateChatResponse(content.trim(), systemPrompt, 800);

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

// Get all clients for @ mentions
router.get('/clients', async (req, res) => {
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

    const { data: clients, error } = await getSupabase()
      .from('clients')
      .select('id, name, email')
      .eq('advisor_id', advisorId)
      .order('name');

    if (error) {
      console.error('Error fetching clients:', error);
      return res.status(500).json({ error: 'Failed to fetch clients' });
    }

    res.json(clients || []);
  } catch (error) {
    console.error('Error in /clients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
