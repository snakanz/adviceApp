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

module.exports = router;

