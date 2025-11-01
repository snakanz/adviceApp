const express = require('express');
const router = express.Router();
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');
const OpenAI = require('openai');

// Get action items for a specific meeting
router.get('/meetings/:meetingId/action-items', authenticateSupabaseUser, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Fetch action items for the meeting - RLS auto-filters
    const { data: actionItems, error } = await req.supabase
      .from('transcript_action_items')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching action items:', error);
      return res.status(500).json({ error: 'Failed to fetch action items' });
    }

    res.json({ actionItems: actionItems || [] });
  } catch (error) {
    console.error('Error in get action items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle action item completion
router.patch('/action-items/:actionItemId/toggle', authenticateSupabaseUser, async (req, res) => {
  const { actionItemId } = req.params;
  const userId = req.user.id;

  console.log(`🔄 Toggle action item ${actionItemId} for user ${userId}`);

  try {
    if (!isSupabaseAvailable()) {
      console.error('❌ Database unavailable');
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // First, get the current state
    console.log(`📋 Fetching current state for item ${actionItemId}...`);
    const { data: currentItem, error: fetchError } = await req.supabase
      .from('transcript_action_items')
      .select('*')
      .eq('id', actionItemId)
      .eq('advisor_id', userId)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching action item:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch action item', details: fetchError.message });
    }

    if (!currentItem) {
      console.error('❌ Action item not found');
      return res.status(404).json({ error: 'Action item not found' });
    }

    console.log(`📋 Current state: completed=${currentItem.completed}`);

    // Toggle the completion status
    const newCompleted = !currentItem.completed;
    const updateData = {
      completed: newCompleted,
      completed_at: newCompleted ? new Date().toISOString() : null
    };

    console.log(`🔄 Toggling to: completed=${newCompleted}`);

    const { data: updatedItem, error: updateError } = await req.supabase
      .from('transcript_action_items')
      .update(updateData)
      .eq('id', actionItemId)
      .eq('advisor_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating action item:', updateError);
      return res.status(500).json({ error: 'Failed to update action item', details: updateError.message });
    }

    if (!updatedItem) {
      console.error('❌ No item returned after update');
      return res.status(500).json({ error: 'Update failed - no item returned' });
    }

    console.log(`✅ Successfully toggled action item ${actionItemId} to completed=${updatedItem.completed}`);

    // Transform to camelCase format to match frontend expectations
    const formattedItem = {
      id: updatedItem.id,
      actionText: updatedItem.action_text,
      completed: updatedItem.completed,
      completedAt: updatedItem.completed_at,
      displayOrder: updatedItem.display_order,
      priority: updatedItem.priority || 3,
      createdAt: updatedItem.created_at,
      meetingId: updatedItem.meeting_id,
      clientId: updatedItem.client_id,
      advisorId: updatedItem.advisor_id
    };

    // Ensure we're sending the response
    return res.status(200).json({ actionItem: formattedItem });
  } catch (error) {
    console.error('❌ EXCEPTION in toggle action item:', error);
    console.error('Stack trace:', error.stack);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Update action item text (inline editing)
router.patch('/action-items/:actionItemId/text', authenticateSupabaseUser, async (req, res) => {
  try {
    const { actionItemId } = req.params;
    const { actionText } = req.body;
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    if (!actionText || !actionText.trim()) {
      return res.status(400).json({ error: 'Action text is required' });
    }

    const { data: updatedItem, error: updateError } = await req.supabase
      .from('transcript_action_items')
      .update({ action_text: actionText.trim() })
      .eq('id', actionItemId)
      .eq('advisor_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating action item text:', updateError);
      return res.status(500).json({ error: 'Failed to update action item' });
    }

    if (!updatedItem) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    // Transform to camelCase format to match frontend expectations
    const formattedItem = {
      id: updatedItem.id,
      actionText: updatedItem.action_text,
      completed: updatedItem.completed,
      completedAt: updatedItem.completed_at,
      displayOrder: updatedItem.display_order,
      priority: updatedItem.priority || 3,
      createdAt: updatedItem.created_at,
      meetingId: updatedItem.meeting_id,
      clientId: updatedItem.client_id,
      advisorId: updatedItem.advisor_id
    };

    res.json({ actionItem: formattedItem });
  } catch (error) {
    console.error('Error in update action item text:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI-powered priority assignment for action items
router.post('/action-items/assign-priorities', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { actionItemIds } = req.body;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OpenAI API key not configured' });
    }

    // Fetch action items to prioritize - use req.supabase (user-scoped) not getSupabase() (service role)
    let query = req.supabase
      .from('transcript_action_items')
      .select('*')
      .eq('advisor_id', userId);

    // If specific IDs provided, filter by them
    if (actionItemIds && Array.isArray(actionItemIds) && actionItemIds.length > 0) {
      query = query.in('id', actionItemIds);
    }

    const { data: actionItems, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching action items:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch action items' });
    }

    if (!actionItems || actionItems.length === 0) {
      return res.json({ message: 'No action items to prioritize', updatedCount: 0 });
    }

    // Fetch meetings separately to avoid relationship issues
    const meetingIds = [...new Set(actionItems.map(item => item.meeting_id))];
    let meetingsMap = {};

    if (meetingIds.length > 0) {
      const { data: meetings } = await req.supabase
        .from('meetings')
        .select('id, title, starttime, transcript')
        .in('id', meetingIds);

      if (meetings) {
        meetingsMap = Object.fromEntries(meetings.map(m => [m.id, m]));
      }
    }

    // Fetch clients separately to avoid relationship issues
    const clientIds = [...new Set(actionItems.map(item => item.client_id).filter(Boolean))];
    let clientsMap = {};

    if (clientIds.length > 0) {
      const { data: clients } = await req.supabase
        .from('clients')
        .select('id, name')
        .in('id', clientIds);

      if (clients) {
        clientsMap = Object.fromEntries(clients.map(c => [c.id, c]));
      }
    }

    console.log(`🤖 Assigning priorities to ${actionItems.length} action items using AI...`);

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Prepare action items for AI analysis
    const itemsForAnalysis = actionItems.map(item => {
      const meeting = meetingsMap[item.meeting_id];
      const client = clientsMap[item.client_id];

      return {
        id: item.id,
        text: item.action_text,
        meetingTitle: meeting?.title || 'Unknown Meeting',
        meetingDate: meeting?.starttime || null,
        clientName: client?.name || 'Unknown Client'
      };
    });

    // Call OpenAI to analyze and assign priorities
    const prompt = `You are an AI assistant helping a financial advisor prioritize action items.
Analyze the following action items and assign each a priority level from 1 to 4:
- 1 = Urgent (time-sensitive, critical, requires immediate attention, contains words like "urgent", "ASAP", "deadline", "today")
- 2 = High (important but not immediately urgent, should be done soon)
- 3 = Medium (standard priority, can be scheduled normally)
- 4 = Low (nice to have, can be done when time permits)

Consider:
- Keywords indicating urgency (urgent, ASAP, deadline, today, tomorrow, this week)
- Time-sensitive language
- Client importance
- Meeting context
- Regulatory or compliance-related items (higher priority)

Action items:
${itemsForAnalysis.map((item, idx) => `${idx + 1}. [ID: ${item.id}] "${item.text}" (Client: ${item.clientName}, Meeting: ${item.meetingTitle})`).join('\n')}

Respond with ONLY a JSON array in this exact format:
[
  {"id": "uuid-here", "priority": 1},
  {"id": "uuid-here", "priority": 2}
]`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that analyzes action items and assigns priority levels. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const aiResponse = completion.choices[0].message.content;
    console.log('🤖 AI Response:', aiResponse);

    // Parse AI response
    let priorities;
    try {
      const parsed = JSON.parse(aiResponse);
      // Handle both array and object with array property
      priorities = Array.isArray(parsed) ? parsed : (parsed.priorities || parsed.items || []);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    if (!Array.isArray(priorities) || priorities.length === 0) {
      console.error('Invalid priorities format:', priorities);
      return res.status(500).json({ error: 'Invalid AI response format' });
    }

    // Update action items with assigned priorities
    const updatePromises = priorities.map(async ({ id, priority }) => {
      // Validate priority is between 1 and 4
      const validPriority = Math.max(1, Math.min(4, parseInt(priority) || 3));

      const { data, error } = await req.supabase
        .from('transcript_action_items')
        .update({ priority: validPriority })
        .eq('id', id)
        .eq('advisor_id', userId)
        .select()
        .single();

      if (error) {
        console.error(`Error updating priority for item ${id}:`, error);
        return null;
      }

      return data;
    });

    const updatedItems = await Promise.all(updatePromises);
    const successCount = updatedItems.filter(item => item !== null).length;

    console.log(`✅ Successfully assigned priorities to ${successCount} action items`);

    res.json({
      success: true,
      updatedCount: successCount,
      actionItems: updatedItems.filter(item => item !== null)
    });
  } catch (error) {
    console.error('Error in assign priorities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all action items grouped by client
router.get('/action-items/by-client', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { priorityFilter, sortBy } = req.query; // Add query params for filtering/sorting

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Build query - use req.supabase (user-scoped) not getSupabase() (service role)
    let query = req.supabase
      .from('transcript_action_items')
      .select('*')
      .eq('advisor_id', userId);

    // Apply priority filter if specified
    if (priorityFilter && priorityFilter !== 'all') {
      query = query.eq('priority', parseInt(priorityFilter));
    }

    // Apply sorting
    if (sortBy === 'priority') {
      query = query.order('priority', { ascending: true }); // 1 (urgent) first
      query = query.order('completed', { ascending: true });
    } else {
      query = query.order('completed', { ascending: true });
      query = query.order('created_at', { ascending: false });
    }

    const { data: actionItems, error } = await query;

    if (error) {
      console.error('Error fetching action items by client:', error);
      return res.status(500).json({ error: 'Failed to fetch action items' });
    }

    // Fetch meetings separately to avoid relationship issues
    const meetingIds = [...new Set(actionItems.map(item => item.meeting_id))];
    let meetingsMap = {};

    if (meetingIds.length > 0) {
      const { data: meetings } = await req.supabase
        .from('meetings')
        .select('id, title, starttime, external_id')
        .in('id', meetingIds);

      if (meetings) {
        meetingsMap = Object.fromEntries(meetings.map(m => [m.id, m]));
      }
    }

    // Fetch clients separately to avoid relationship issues
    const clientIds = [...new Set(actionItems.map(item => item.client_id).filter(Boolean))];
    let clientsMap = {};

    if (clientIds.length > 0) {
      const { data: clients } = await req.supabase
        .from('clients')
        .select('id, name, email')
        .in('id', clientIds);

      if (clients) {
        clientsMap = Object.fromEntries(clients.map(c => [c.id, c]));
      }
    }

    // Group by client
    const groupedByClient = {};

    actionItems.forEach(item => {
      const clientId = item.client_id || 'no-client';
      const client = clientsMap[clientId];
      const clientName = client?.name || 'Unknown Client';
      const clientEmail = client?.email || '';

      if (!groupedByClient[clientId]) {
        groupedByClient[clientId] = {
          clientId,
          clientName,
          clientEmail,
          actionItems: []
        };
      }

      const meeting = meetingsMap[item.meeting_id];

      groupedByClient[clientId].actionItems.push({
        id: item.id,
        actionText: item.action_text,
        completed: item.completed,
        completedAt: item.completed_at,
        displayOrder: item.display_order,
        priority: item.priority || 3, // Default to medium priority
        createdAt: item.created_at,
        meeting: {
          id: item.meeting_id,
          title: meeting?.title || 'Unknown Meeting',
          startTime: meeting?.starttime || null,
          googleEventId: meeting?.external_id || null
        }
      });
    });

    // Convert to array and sort by client name
    const clientsArray = Object.values(groupedByClient).sort((a, b) =>
      a.clientName.localeCompare(b.clientName)
    );

    // If sorting by priority, also sort action items within each client
    if (sortBy === 'priority') {
      clientsArray.forEach(client => {
        client.actionItems.sort((a, b) => {
          // Sort by priority first (1 = urgent first)
          if (a.priority !== b.priority) {
            return a.priority - b.priority;
          }
          // Then by completion status (incomplete first)
          if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
          }
          // Finally by creation date (newest first)
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
      });
    }

    res.json({ clients: clientsArray });
  } catch (error) {
    console.error('Error in get action items by client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all action items (not grouped) with priority sorting
router.get('/action-items/all', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { priorityFilter, sortBy } = req.query;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Build query - use req.supabase (user-scoped) not getSupabase() (service role)
    let query = req.supabase
      .from('transcript_action_items')
      .select('*')
      .eq('advisor_id', userId);

    // Apply priority filter if specified
    if (priorityFilter && priorityFilter !== 'all') {
      query = query.eq('priority', parseInt(priorityFilter));
    }

    // Apply sorting
    if (sortBy === 'priority') {
      query = query.order('priority', { ascending: true }); // 1 (urgent) first
      query = query.order('completed', { ascending: true });
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('completed', { ascending: true });
      query = query.order('created_at', { ascending: false });
    }

    const { data: actionItems, error } = await query;

    if (error) {
      console.error('Error fetching all action items:', error);
      return res.status(500).json({ error: 'Failed to fetch action items' });
    }

    // Fetch meetings separately to avoid relationship issues
    const meetingIds = [...new Set(actionItems.map(item => item.meeting_id))];
    let meetingsMap = {};

    if (meetingIds.length > 0) {
      const { data: meetings } = await req.supabase
        .from('meetings')
        .select('id, title, starttime, external_id')
        .in('id', meetingIds);

      if (meetings) {
        meetingsMap = Object.fromEntries(meetings.map(m => [m.id, m]));
      }
    }

    // Fetch clients separately to avoid relationship issues
    const clientIds = [...new Set(actionItems.map(item => item.client_id).filter(Boolean))];
    let clientsMap = {};

    if (clientIds.length > 0) {
      const { data: clients } = await req.supabase
        .from('clients')
        .select('id, name, email')
        .in('id', clientIds);

      if (clients) {
        clientsMap = Object.fromEntries(clients.map(c => [c.id, c]));
      }
    }

    // Format response
    const formattedItems = actionItems.map(item => {
      const meeting = meetingsMap[item.meeting_id];
      const client = clientsMap[item.client_id];

      return {
        id: item.id,
        actionText: item.action_text,
        completed: item.completed,
        completedAt: item.completed_at,
        displayOrder: item.display_order,
        priority: item.priority || 3,
        createdAt: item.created_at,
        meeting: {
          id: item.meeting_id,
          title: meeting?.title || 'Unknown Meeting',
          startTime: meeting?.starttime || null,
          googleEventId: meeting?.external_id || null
        },
        client: client ? {
          id: client.id,
          name: client.name,
          email: client.email
        } : null
      };
    });

    res.json({ actionItems: formattedItems });
  } catch (error) {
    console.error('Error in get all action items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get action items for a specific client
router.get('/clients/:clientId/action-items', authenticateSupabaseUser, async (req, res) => {
  try {
    const { clientId } = req.params;
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Fetch action items for the client
    const { data: actionItems, error } = await req.supabase
      .from('transcript_action_items')
      .select('*')
      .eq('client_id', clientId)
      .eq('advisor_id', userId)
      .order('completed', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching client action items:', error);
      return res.status(500).json({ error: 'Failed to fetch action items' });
    }

    // Fetch meetings separately to avoid relationship issues
    const meetingIds = [...new Set(actionItems.map(item => item.meeting_id))];
    let meetingsMap = {};

    if (meetingIds.length > 0) {
      const { data: meetings } = await req.supabase
        .from('meetings')
        .select('id, title, starttime, external_id')
        .in('id', meetingIds);

      if (meetings) {
        meetingsMap = Object.fromEntries(meetings.map(m => [m.id, m]));
      }
    }

    // Group by meeting
    const groupedByMeeting = {};

    actionItems.forEach(item => {
      const meetingId = item.meeting_id;
      const meeting = meetingsMap[meetingId];

      if (!groupedByMeeting[meetingId]) {
        groupedByMeeting[meetingId] = {
          meetingId,
          meetingTitle: meeting?.title || 'Unknown Meeting',
          meetingStartTime: meeting?.starttime || null,
          googleEventId: meeting?.external_id || null,
          actionItems: []
        };
      }

      groupedByMeeting[meetingId].actionItems.push({
        id: item.id,
        actionText: item.action_text,
        completed: item.completed,
        completedAt: item.completed_at,
        displayOrder: item.display_order,
        createdAt: item.created_at
      });
    });

    // Convert to array and sort by meeting date (most recent first)
    const meetingsArray = Object.values(groupedByMeeting).sort((a, b) => 
      new Date(b.meetingStartTime) - new Date(a.meetingStartTime)
    );

    res.json({ meetings: meetingsArray });
  } catch (error) {
    console.error('Error in get client action items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending action items for a specific meeting (awaiting approval)
router.get('/meetings/:meetingId/pending', authenticateSupabaseUser, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Fetch pending action items for the meeting
    const { data: pendingItems, error } = await req.supabase
      .from('pending_transcript_action_items')
      .select('*')
      .eq('meeting_id', meetingId)
      .eq('advisor_id', userId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching pending action items:', error);
      return res.status(500).json({ error: 'Failed to fetch pending action items' });
    }

    res.json({ pendingItems: pendingItems || [] });
  } catch (error) {
    console.error('Error in get pending action items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get ALL pending action items for the advisor (across all meetings)
router.get('/pending/all', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    console.log(`📋 Fetching all pending action items for advisor ${userId}`);

    // Fetch all pending action items
    const { data: pendingItems, error } = await req.supabase
      .from('pending_transcript_action_items')
      .select('*')
      .eq('advisor_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all pending action items:', error);
      return res.status(500).json({ error: 'Failed to fetch pending action items' });
    }

    // Fetch meetings separately to avoid relationship issues
    const meetingIds = [...new Set(pendingItems.map(item => item.meeting_id))];
    let meetingsMap = {};

    if (meetingIds.length > 0) {
      const { data: meetings } = await req.supabase
        .from('meetings')
        .select('id, title, starttime, external_id')
        .in('id', meetingIds);

      if (meetings) {
        meetingsMap = Object.fromEntries(meetings.map(m => [m.id, m]));
      }
    }

    // Fetch clients separately to avoid relationship issues
    const clientIds = [...new Set(pendingItems.map(item => item.client_id).filter(Boolean))];
    let clientsMap = {};

    if (clientIds.length > 0) {
      const { data: clients } = await req.supabase
        .from('clients')
        .select('id, name, email')
        .in('id', clientIds);

      if (clients) {
        clientsMap = Object.fromEntries(clients.map(c => [c.id, c]));
      }
    }

    // Group by client
    const groupedByClient = {};

    pendingItems.forEach(item => {
      const clientId = item.client_id || 'no-client';
      const client = clientsMap[clientId];
      const clientName = client?.name || 'Unknown Client';
      const clientEmail = client?.email || '';

      if (!groupedByClient[clientId]) {
        groupedByClient[clientId] = {
          clientId,
          clientName,
          clientEmail,
          meetings: {}
        };
      }

      const meetingId = item.meeting_id;
      const meeting = meetingsMap[meetingId];

      if (!groupedByClient[clientId].meetings[meetingId]) {
        groupedByClient[clientId].meetings[meetingId] = {
          meetingId,
          meetingTitle: meeting?.title || 'Unknown Meeting',
          meetingStartTime: meeting?.starttime || null,
          googleEventId: meeting?.external_id || null,
          pendingItems: []
        };
      }

      groupedByClient[clientId].meetings[meetingId].pendingItems.push({
        id: item.id,
        actionText: item.action_text,
        displayOrder: item.display_order,
        createdAt: item.created_at
      });
    });

    // Convert to array format
    const clientsArray = Object.values(groupedByClient).map(client => ({
      clientId: client.clientId,
      clientName: client.clientName,
      clientEmail: client.clientEmail,
      meetings: Object.values(client.meetings)
    })).sort((a, b) => a.clientName.localeCompare(b.clientName));

    // Calculate total count
    const totalPendingCount = pendingItems.length;

    console.log(`✅ Found ${totalPendingCount} pending action items across ${clientsArray.length} clients`);

    res.json({
      clients: clientsArray,
      totalCount: totalPendingCount
    });
  } catch (error) {
    console.error('Error in get all pending action items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve selected action items (move from pending to approved)
router.post('/approve', authenticateSupabaseUser, async (req, res) => {
  try {
    const { pendingItemIds } = req.body;
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    if (!pendingItemIds || !Array.isArray(pendingItemIds) || pendingItemIds.length === 0) {
      return res.status(400).json({ error: 'pendingItemIds array is required' });
    }

    console.log(`📋 Approving ${pendingItemIds.length} action items for user ${userId}`);

    // Fetch the pending items to approve
    const { data: pendingItems, error: fetchError } = await req.supabase
      .from('pending_transcript_action_items')
      .select('*')
      .in('id', pendingItemIds)
      .eq('advisor_id', userId);

    if (fetchError) {
      console.error('Error fetching pending items:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch pending items' });
    }

    if (!pendingItems || pendingItems.length === 0) {
      return res.status(404).json({ error: 'No pending items found' });
    }

    // Transform pending items to approved action items (preserve priority)
    const approvedItems = pendingItems.map(item => ({
      meeting_id: item.meeting_id,
      client_id: item.client_id,
      advisor_id: item.advisor_id,
      action_text: item.action_text,
      display_order: item.display_order,
      priority: item.priority || 3,  // Preserve user-selected priority or default to Medium
      completed: false
    }));

    // Insert into transcript_action_items table
    const { data: insertedItems, error: insertError } = await req.supabase
      .from('transcript_action_items')
      .insert(approvedItems)
      .select();

    if (insertError) {
      console.error('Error inserting approved items:', insertError);
      return res.status(500).json({ error: 'Failed to approve action items' });
    }

    // Delete from pending table
    const { error: deleteError } = await req.supabase
      .from('pending_transcript_action_items')
      .delete()
      .in('id', pendingItemIds)
      .eq('advisor_id', userId);

    if (deleteError) {
      console.error('Error deleting pending items:', deleteError);
      // Don't fail the request - items are already approved
    }

    console.log(`✅ Successfully approved ${insertedItems.length} action items`);

    res.json({
      success: true,
      approvedCount: insertedItems.length,
      actionItems: insertedItems
    });
  } catch (error) {
    console.error('Error in approve action items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update priority of a pending action item
router.patch('/pending/:pendingItemId/priority', authenticateSupabaseUser, async (req, res) => {
  try {
    const { pendingItemId } = req.params;
    const { priority } = req.body;
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    if (!priority || priority < 1 || priority > 4) {
      return res.status(400).json({ error: 'Priority must be between 1 and 4' });
    }

    console.log(`🎯 Updating priority for pending item ${pendingItemId} to ${priority}`);

    // Update priority
    const { data: updatedItem, error: updateError } = await req.supabase
      .from('pending_transcript_action_items')
      .update({ priority })
      .eq('id', pendingItemId)
      .eq('advisor_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating pending item priority:', updateError);
      return res.status(500).json({ error: 'Failed to update priority' });
    }

    if (!updatedItem) {
      return res.status(404).json({ error: 'Pending item not found' });
    }

    res.json({
      success: true,
      pendingItem: updatedItem
    });
  } catch (error) {
    console.error('Error in update pending item priority:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update text of a pending action item
router.patch('/pending/:pendingItemId/text', authenticateSupabaseUser, async (req, res) => {
  try {
    const { pendingItemId } = req.params;
    const { actionText } = req.body;
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    if (!actionText || actionText.trim().length === 0) {
      return res.status(400).json({ error: 'Action text is required' });
    }

    console.log(`✏️  Updating text for pending item ${pendingItemId}`);

    // Update action text
    const { data: updatedItem, error: updateError } = await req.supabase
      .from('pending_transcript_action_items')
      .update({ action_text: actionText.trim() })
      .eq('id', pendingItemId)
      .eq('advisor_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating pending item text:', updateError);
      return res.status(500).json({ error: 'Failed to update action text' });
    }

    if (!updatedItem) {
      return res.status(404).json({ error: 'Pending item not found' });
    }

    res.json({
      success: true,
      pendingItem: updatedItem
    });
  } catch (error) {
    console.error('Error in update pending item text:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new pending action item
router.post('/pending', authenticateSupabaseUser, async (req, res) => {
  try {
    const { meetingId, clientId, actionText, priority } = req.body;
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Validate required fields
    if (!meetingId) {
      return res.status(400).json({ error: 'Meeting ID is required' });
    }

    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    if (!actionText || actionText.trim().length === 0) {
      return res.status(400).json({ error: 'Action text is required' });
    }

    const finalPriority = priority && priority >= 1 && priority <= 4 ? priority : 3;

    console.log(`➕ Creating new pending action item for meeting ${meetingId}`);

    // Get the highest display_order for this meeting to append the new item
    const { data: existingItems, error: fetchError } = await req.supabase
      .from('pending_transcript_action_items')
      .select('display_order')
      .eq('meeting_id', meetingId)
      .order('display_order', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('Error fetching existing items:', fetchError);
      return res.status(500).json({ error: 'Failed to create action item' });
    }

    const nextDisplayOrder = existingItems && existingItems.length > 0
      ? existingItems[0].display_order + 1
      : 1;

    // Create the new pending item
    const { data: newItem, error: insertError } = await req.supabase
      .from('pending_transcript_action_items')
      .insert({
        meeting_id: meetingId,
        client_id: clientId,
        advisor_id: userId,
        action_text: actionText.trim(),
        priority: finalPriority,
        display_order: nextDisplayOrder
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating pending item:', insertError);
      return res.status(500).json({ error: 'Failed to create action item' });
    }

    console.log(`✅ Successfully created pending action item ${newItem.id}`);

    res.json({
      success: true,
      pendingItem: newItem
    });
  } catch (error) {
    console.error('Error in create pending item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reject/delete pending action items
router.delete('/pending', authenticateSupabaseUser, async (req, res) => {
  try {
    const { pendingItemIds } = req.body;
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    if (!pendingItemIds || !Array.isArray(pendingItemIds) || pendingItemIds.length === 0) {
      return res.status(400).json({ error: 'pendingItemIds array is required' });
    }

    console.log(`🗑️  Rejecting ${pendingItemIds.length} pending action items for user ${userId}`);

    // Delete from pending table
    const { error: deleteError } = await req.supabase
      .from('pending_transcript_action_items')
      .delete()
      .in('id', pendingItemIds)
      .eq('advisor_id', userId);

    if (deleteError) {
      console.error('Error deleting pending items:', deleteError);
      return res.status(500).json({ error: 'Failed to reject pending items' });
    }

    console.log(`✅ Successfully rejected ${pendingItemIds.length} pending action items`);

    res.json({
      success: true,
      rejectedCount: pendingItemIds.length
    });
  } catch (error) {
    console.error('Error in reject pending items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

