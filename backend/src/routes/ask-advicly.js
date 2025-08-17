const express = require('express');
const jwt = require('jsonwebtoken');
const { supabase, isSupabaseAvailable, getSupabase } = require('../lib/supabase');
const { generateMeetingSummary } = require('../services/openai');

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

    // Get client context if this is a client-scoped thread
    let clientContext = '';
    if (thread.client_id && thread.clients) {
      const clientEmail = thread.clients.email;
      const clientName = thread.clients.name;

      // Get recent meetings for this client
      const { data: meetings } = await getSupabase()
        .from('meetings')
        .select('title, starttime, transcript, quick_summary, email_summary_draft')
        .eq('userid', advisorId)
        .contains('attendees', `[{"email": "${clientEmail}"}]`)
        .order('starttime', { ascending: false })
        .limit(5);

      if (meetings && meetings.length > 0) {
        clientContext = `\n\nClient Context for ${clientName} (${clientEmail}):\n` +
          meetings.map(m =>
            `Meeting: ${m.title} (${new Date(m.starttime).toLocaleDateString()})
            ${m.quick_summary ? `Summary: ${m.quick_summary}` : ''}
            ${m.transcript ? `Transcript excerpt: ${m.transcript.substring(0, 300)}...` : ''}`
          ).join('\n\n');
      }
    }

    // Generate AI response
    const systemPrompt = `You are Advicly AI, a helpful assistant for financial advisors. 
    You help advisors manage their client relationships and provide insights about meetings and client interactions.
    Be concise, professional, and helpful.${clientContext}`;

    const aiResponse = await generateMeetingSummary(content, 'chat', { 
      prompt: systemPrompt,
      maxTokens: 500 
    });

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
