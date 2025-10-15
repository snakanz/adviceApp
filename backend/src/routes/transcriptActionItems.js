const express = require('express');
const router = express.Router();
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');
const { authenticateToken } = require('../middleware/auth');

// Get action items for a specific meeting
router.get('/meetings/:meetingId/action-items', authenticateToken, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Fetch action items for the meeting
    const { data: actionItems, error } = await getSupabase()
      .from('transcript_action_items')
      .select('*')
      .eq('meeting_id', meetingId)
      .eq('advisor_id', userId)
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
router.patch('/action-items/:actionItemId/toggle', authenticateToken, async (req, res) => {
  try {
    const { actionItemId } = req.params;
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // First, get the current state
    const { data: currentItem, error: fetchError } = await getSupabase()
      .from('transcript_action_items')
      .select('completed')
      .eq('id', actionItemId)
      .eq('advisor_id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching action item:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch action item' });
    }

    // Toggle the completion status
    const newCompleted = !currentItem.completed;
    const updateData = {
      completed: newCompleted,
      completed_at: newCompleted ? new Date().toISOString() : null
    };

    const { data: updatedItem, error: updateError } = await getSupabase()
      .from('transcript_action_items')
      .update(updateData)
      .eq('id', actionItemId)
      .eq('advisor_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating action item:', updateError);
      return res.status(500).json({ error: 'Failed to update action item' });
    }

    res.json({ actionItem: updatedItem });
  } catch (error) {
    console.error('Error in toggle action item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all action items grouped by client
router.get('/action-items/by-client', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Fetch all action items with client and meeting info
    const { data: actionItems, error } = await getSupabase()
      .from('transcript_action_items')
      .select(`
        *,
        meeting:meetings!inner(
          id,
          title,
          starttime,
          googleeventid
        ),
        client:clients(
          id,
          name,
          email
        )
      `)
      .eq('advisor_id', userId)
      .order('completed', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching action items by client:', error);
      return res.status(500).json({ error: 'Failed to fetch action items' });
    }

    // Group by client
    const groupedByClient = {};
    
    actionItems.forEach(item => {
      const clientId = item.client_id || 'no-client';
      const clientName = item.client?.name || 'Unknown Client';
      const clientEmail = item.client?.email || '';

      if (!groupedByClient[clientId]) {
        groupedByClient[clientId] = {
          clientId,
          clientName,
          clientEmail,
          actionItems: []
        };
      }

      groupedByClient[clientId].actionItems.push({
        id: item.id,
        actionText: item.action_text,
        completed: item.completed,
        completedAt: item.completed_at,
        displayOrder: item.display_order,
        createdAt: item.created_at,
        meeting: {
          id: item.meeting.id,
          title: item.meeting.title,
          startTime: item.meeting.starttime,
          googleEventId: item.meeting.googleeventid
        }
      });
    });

    // Convert to array and sort by client name
    const clientsArray = Object.values(groupedByClient).sort((a, b) => 
      a.clientName.localeCompare(b.clientName)
    );

    res.json({ clients: clientsArray });
  } catch (error) {
    console.error('Error in get action items by client:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get action items for a specific client
router.get('/clients/:clientId/action-items', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Fetch action items for the client
    const { data: actionItems, error } = await getSupabase()
      .from('transcript_action_items')
      .select(`
        *,
        meeting:meetings!inner(
          id,
          title,
          starttime,
          googleeventid
        )
      `)
      .eq('client_id', clientId)
      .eq('advisor_id', userId)
      .order('completed', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching client action items:', error);
      return res.status(500).json({ error: 'Failed to fetch action items' });
    }

    // Group by meeting
    const groupedByMeeting = {};
    
    actionItems.forEach(item => {
      const meetingId = item.meeting_id;
      
      if (!groupedByMeeting[meetingId]) {
        groupedByMeeting[meetingId] = {
          meetingId,
          meetingTitle: item.meeting.title,
          meetingStartTime: item.meeting.starttime,
          googleEventId: item.meeting.googleeventid,
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
router.get('/meetings/:meetingId/pending', authenticateToken, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Fetch pending action items for the meeting
    const { data: pendingItems, error } = await getSupabase()
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
router.get('/pending/all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    console.log(`📋 Fetching all pending action items for advisor ${userId}`);

    // Fetch all pending action items with client and meeting info
    const { data: pendingItems, error } = await getSupabase()
      .from('pending_transcript_action_items')
      .select(`
        *,
        meeting:meetings!inner(
          id,
          title,
          starttime,
          googleeventid
        ),
        client:clients(
          id,
          name,
          email
        )
      `)
      .eq('advisor_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all pending action items:', error);
      return res.status(500).json({ error: 'Failed to fetch pending action items' });
    }

    // Group by client
    const groupedByClient = {};

    pendingItems.forEach(item => {
      const clientId = item.client_id || 'no-client';
      const clientName = item.client?.name || 'Unknown Client';
      const clientEmail = item.client?.email || '';

      if (!groupedByClient[clientId]) {
        groupedByClient[clientId] = {
          clientId,
          clientName,
          clientEmail,
          meetings: {}
        };
      }

      const meetingId = item.meeting_id;
      if (!groupedByClient[clientId].meetings[meetingId]) {
        groupedByClient[clientId].meetings[meetingId] = {
          meetingId,
          meetingTitle: item.meeting.title,
          meetingStartTime: item.meeting.starttime,
          googleEventId: item.meeting.googleeventid,
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
router.post('/approve', authenticateToken, async (req, res) => {
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
    const { data: pendingItems, error: fetchError } = await getSupabase()
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

    // Transform pending items to approved action items
    const approvedItems = pendingItems.map(item => ({
      meeting_id: item.meeting_id,
      client_id: item.client_id,
      advisor_id: item.advisor_id,
      action_text: item.action_text,
      display_order: item.display_order,
      completed: false
    }));

    // Insert into transcript_action_items table
    const { data: insertedItems, error: insertError } = await getSupabase()
      .from('transcript_action_items')
      .insert(approvedItems)
      .select();

    if (insertError) {
      console.error('Error inserting approved items:', insertError);
      return res.status(500).json({ error: 'Failed to approve action items' });
    }

    // Delete from pending table
    const { error: deleteError } = await getSupabase()
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

// Reject/delete pending action items
router.delete('/pending', authenticateToken, async (req, res) => {
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
    const { error: deleteError } = await getSupabase()
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

