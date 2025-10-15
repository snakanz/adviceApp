const express = require('express');
const jwt = require('jsonwebtoken');
const { getSupabase, isSupabaseAvailable } = require('../lib/supabase');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// Get all action items for dashboard
router.get('/dashboard', authenticateUser, async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No authorization header' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Get action items from the dashboard view
    const { data: actionItems, error } = await getSupabase()
      .from('action_items_dashboard')
      .select('*')
      .eq('advisor_id', advisorId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching action items:', error);
      return res.status(500).json({ error: 'Failed to fetch action items' });
    }

    // Get annual review dashboard data
    const { data: annualReviews, error: reviewError } = await getSupabase()
      .from('annual_review_dashboard')
      .select('*')
      .eq('advisor_id', advisorId)
      .order('computed_status', { ascending: true })
      .order('client_name', { ascending: true });

    if (reviewError) {
      console.error('Error fetching annual reviews:', reviewError);
      // Continue without annual reviews rather than failing completely
    }

    // Group action items by type for easier frontend processing
    const groupedItems = {
      transcriptNeeded: actionItems.filter(item => item.action_type === 'transcript_needed'),
      emailPending: actionItems.filter(item => item.action_type === 'email_pending'),
      adHocTasks: actionItems.filter(item => item.action_type === 'ad_hoc_task'),
      annualReviews: annualReviews || []
    };

    res.json(groupedItems);
  } catch (error) {
    console.error('Error in action items dashboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new ad-hoc task
router.post('/tasks', authenticateUser, async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No authorization header' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const { title, description, priority, due_date } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    const { data: newTask, error } = await getSupabase()
      .from('advisor_tasks')
      .insert({
        advisor_id: advisorId,
        title,
        description,
        priority: priority || 3,
        due_date: due_date || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      return res.status(500).json({ error: 'Failed to create task' });
    }

    res.json(newTask);
  } catch (error) {
    console.error('Error in create task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update ad-hoc task
router.put('/tasks/:taskId', authenticateUser, async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No authorization header' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const taskId = req.params.taskId;
    const { title, description, priority, due_date, status } = req.body;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }
    }

    const { data: updatedTask, error } = await getSupabase()
      .from('advisor_tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('advisor_id', advisorId)
      .select()
      .single();

    if (error) {
      console.error('Error updating task:', error);
      return res.status(500).json({ error: 'Failed to update task' });
    }

    if (!updatedTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(updatedTask);
  } catch (error) {
    console.error('Error in update task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete ad-hoc task
router.delete('/tasks/:taskId', authenticateUser, async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No authorization header' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const taskId = req.params.taskId;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    const { error } = await getSupabase()
      .from('advisor_tasks')
      .delete()
      .eq('id', taskId)
      .eq('advisor_id', advisorId);

    if (error) {
      console.error('Error deleting task:', error);
      return res.status(500).json({ error: 'Failed to delete task' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error in delete task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update meeting transcript status
router.post('/meetings/:meetingId/transcript', authenticateUser, async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No authorization header' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const meetingId = req.params.meetingId;
    const { transcript, markAsNotRequired } = req.body;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    if (markAsNotRequired) {
      // Mark meeting as not requiring transcript
      const { error } = await getSupabase()
        .from('meetings')
        .update({ transcript: 'NOT_REQUIRED' })
        .eq('id', meetingId)
        .eq('userid', advisorId);

      if (error) {
        console.error('Error marking transcript as not required:', error);
        return res.status(500).json({ error: 'Failed to update meeting' });
      }
    } else if (transcript) {
      // Add transcript to meeting
      const { error } = await getSupabase()
        .from('meetings')
        .update({ transcript })
        .eq('id', meetingId)
        .eq('userid', advisorId);

      if (error) {
        console.error('Error adding transcript:', error);
        return res.status(500).json({ error: 'Failed to update meeting' });
      }
    } else {
      return res.status(400).json({ error: 'Either transcript or markAsNotRequired must be provided' });
    }

    res.json({ message: 'Meeting updated successfully' });
  } catch (error) {
    console.error('Error in update meeting transcript:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk operations for action items
router.post('/bulk-actions', authenticateUser, async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No authorization header' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const { action, itemIds, itemType } = req.body;

    if (!action || !itemIds || !Array.isArray(itemIds)) {
      return res.status(400).json({ error: 'Invalid bulk action request' });
    }

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    let results = [];

    if (itemType === 'tasks' && action === 'complete') {
      // Complete multiple tasks
      const { data, error } = await getSupabase()
        .from('advisor_tasks')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .in('id', itemIds)
        .eq('advisor_id', advisorId)
        .select();

      if (error) {
        console.error('Error completing tasks:', error);
        return res.status(500).json({ error: 'Failed to complete tasks' });
      }

      results = data;
    } else if (itemType === 'meetings' && action === 'mark_transcript_not_required') {
      // Mark multiple meetings as not requiring transcripts
      const { data, error } = await getSupabase()
        .from('meetings')
        .update({ transcript: 'NOT_REQUIRED' })
        .in('id', itemIds)
        .eq('userid', advisorId)
        .select();

      if (error) {
        console.error('Error marking transcripts as not required:', error);
        return res.status(500).json({ error: 'Failed to update meetings' });
      }

      results = data;
    }

    res.json({ 
      message: `Bulk action ${action} completed successfully`,
      results 
    });
  } catch (error) {
    console.error('Error in bulk actions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get email summary for a meeting
router.get('/meetings/:meetingId/email-summary', authenticateUser, async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No authorization header' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const meetingId = req.params.meetingId;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Check if email summary already exists
    const { data: existingSummary, error: summaryError } = await getSupabase()
      .from('email_summaries')
      .select('*')
      .eq('meeting_id', meetingId)
      .eq('advisor_id', advisorId)
      .single();

    if (summaryError && summaryError.code !== 'PGRST116') {
      console.error('Error fetching email summary:', summaryError);
      return res.status(500).json({ error: 'Failed to fetch email summary' });
    }

    if (existingSummary) {
      return res.json(existingSummary);
    }

    // Get meeting details to generate email summary
    const { data: meeting, error: meetingError } = await getSupabase()
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .eq('userid', advisorId)
      .single();

    if (meetingError) {
      console.error('Error fetching meeting:', meetingError);
      return res.status(500).json({ error: 'Failed to fetch meeting' });
    }

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Generate email summary (placeholder - would integrate with OpenAI)
    const emailContent = generateEmailSummary(meeting);
    const clientEmail = extractClientEmail(meeting.attendees);

    // Create draft email summary
    const { data: newSummary, error: createError } = await getSupabase()
      .from('email_summaries')
      .insert({
        meeting_id: meetingId,
        advisor_id: advisorId,
        client_email: clientEmail,
        subject: `Meeting Summary - ${meeting.title}`,
        content: emailContent,
        status: 'draft'
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating email summary:', createError);
      return res.status(500).json({ error: 'Failed to create email summary' });
    }

    res.json(newSummary);
  } catch (error) {
    console.error('Error in get email summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update email summary
router.put('/email-summaries/:summaryId', authenticateUser, async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No authorization header' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const summaryId = req.params.summaryId;
    const { subject, content } = req.body;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    const { data: updatedSummary, error } = await getSupabase()
      .from('email_summaries')
      .update({ subject, content })
      .eq('id', summaryId)
      .eq('advisor_id', advisorId)
      .select()
      .single();

    if (error) {
      console.error('Error updating email summary:', error);
      return res.status(500).json({ error: 'Failed to update email summary' });
    }

    if (!updatedSummary) {
      return res.status(404).json({ error: 'Email summary not found' });
    }

    res.json(updatedSummary);
  } catch (error) {
    console.error('Error in update email summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send email summary
router.post('/email-summaries/:summaryId/send', authenticateUser, async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No authorization header' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const advisorId = decoded.id;
    const summaryId = req.params.summaryId;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Get email summary
    const { data: summary, error: summaryError } = await getSupabase()
      .from('email_summaries')
      .select('*')
      .eq('id', summaryId)
      .eq('advisor_id', advisorId)
      .single();

    if (summaryError) {
      console.error('Error fetching email summary:', summaryError);
      return res.status(500).json({ error: 'Failed to fetch email summary' });
    }

    if (!summary) {
      return res.status(404).json({ error: 'Email summary not found' });
    }

    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    // For now, we'll just mark it as sent
    const { data: updatedSummary, error: updateError } = await getSupabase()
      .from('email_summaries')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', summaryId)
      .eq('advisor_id', advisorId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating email summary status:', updateError);
      return res.status(500).json({ error: 'Failed to update email summary' });
    }

    res.json({
      message: 'Email sent successfully',
      summary: updatedSummary
    });
  } catch (error) {
    console.error('Error in send email summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions
function generateEmailSummary(meeting) {
  // Placeholder email generation - would integrate with OpenAI
  return `Dear ${extractClientName(meeting.attendees)},

Thank you for taking the time to meet with me on ${new Date(meeting.starttime).toLocaleDateString()}.

Meeting Summary:
${meeting.title}

${meeting.transcript ? 'Key Discussion Points:\n' + meeting.transcript.substring(0, 500) + '...' : 'We discussed your financial planning needs and next steps.'}

Next Steps:
- I will review the information we discussed
- Follow up on any action items identified
- Schedule our next meeting as appropriate

Please don't hesitate to reach out if you have any questions.

Best regards,
Your Financial Advisor`;
}

function extractClientEmail(attendees) {
  if (!attendees) return '';
  try {
    const attendeeList = JSON.parse(attendees);
    // Find the first attendee that's not the advisor
    const clientAttendee = attendeeList.find(attendee =>
      !attendee.email.includes('advisor') &&
      !attendee.email.includes('greenwood')
    );
    return clientAttendee ? clientAttendee.email : '';
  } catch (error) {
    return '';
  }
}

function extractClientName(attendees) {
  if (!attendees) return 'Client';
  try {
    const attendeeList = JSON.parse(attendees);
    const clientAttendee = attendeeList.find(attendee =>
      !attendee.email.includes('advisor') &&
      !attendee.email.includes('greenwood')
    );
    return clientAttendee ? clientAttendee.name : 'Client';
  } catch (error) {
    return 'Client';
  }
}

module.exports = router;
