require('dotenv').config();
const express = require('express');
const router = express.Router();
const { isSupabaseAvailable } = require('../lib/supabase');
const { authenticateSupabaseUser } = require('../middleware/supabaseAuth');

// Get pipeline data grouped by month
router.get('/', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('Pipeline request for userId:', userId);

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Fetch clients with pipeline data
    // RLS policies automatically filter by user_id = auth.uid()
    const { data: clients, error: clientsError } = await req.supabase
      .from('clients')
      .select(`
        id,
        name,
        email,
        priority_level,
        last_contact_date,
        next_follow_up_date,
        created_at,
        updated_at,
        pipeline_next_steps,
        pipeline_next_steps_generated_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
      return res.status(500).json({ error: 'Failed to fetch clients' });
    }

    // Get business types for all clients (SINGLE SOURCE OF TRUTH)
    // Exclude not proceeding items from pipeline view by default
    const { data: allBusinessTypes, error: businessTypesError } = await req.supabase
      .from('client_business_types')
      .select('*')
      .in('client_id', clients.map(c => c.id))
      .or('not_proceeding.is.null,not_proceeding.eq.false');

    if (businessTypesError) {
      console.error('Error fetching business types:', businessTypesError);
      // Continue without business types rather than failing
    }

    // Group business types by client_id
    const businessTypesByClient = {};
    (allBusinessTypes || []).forEach(bt => {
      if (!businessTypesByClient[bt.client_id]) {
        businessTypesByClient[bt.client_id] = [];
      }
      businessTypesByClient[bt.client_id].push(bt);
    });

    // Get meeting counts for each client
    const { data: meetings, error: meetingsError } = await req.supabase
      .from('meetings')
      .select('id, attendees')
      .eq('userid', userId);

    if (meetingsError) {
      console.error('Error fetching meetings:', meetingsError);
    }

    // Count meetings per client
    const clientMeetingCounts = {};
    if (meetings) {
      for (const meeting of meetings) {
        if (meeting.attendees) {
          try {
            const attendees = typeof meeting.attendees === 'string'
              ? JSON.parse(meeting.attendees)
              : meeting.attendees;

            if (Array.isArray(attendees)) {
              for (const attendee of attendees) {
                if (attendee.email) {
                  clientMeetingCounts[attendee.email] = (clientMeetingCounts[attendee.email] || 0) + 1;
                }
              }
            }
          } catch (e) {
            console.error('Error parsing attendees:', e);
          }
        }
      }
    }

    // Group clients by month and unscheduled
    const pipelineByMonth = {};
    const unscheduledClients = [];
    let totalValue = 0;
    let totalClients = clients?.length || 0;

    for (const client of clients || []) {
      // Add meeting count
      client.meeting_count = clientMeetingCounts[client.email] || 0;

      // Get business types for this client (SINGLE SOURCE OF TRUTH)
      const clientBusinessTypes = businessTypesByClient[client.id] || [];

      // Calculate aggregated totals from business types
      const totalBusinessAmount = clientBusinessTypes.reduce((sum, bt) => sum + (parseFloat(bt.business_amount) || 0), 0);
      const totalIafExpected = clientBusinessTypes.reduce((sum, bt) => sum + (parseFloat(bt.iaf_expected) || 0), 0);
      const businessTypesList = clientBusinessTypes.map(bt => bt.business_type);
      const primaryBusinessType = businessTypesList[0] || client.business_type || null;

      // Enrich client with business type data
      client.business_type = primaryBusinessType;
      client.business_types = businessTypesList;
      client.business_types_data = clientBusinessTypes;
      client.totalBusinessAmount = totalBusinessAmount;
      client.totalIafExpected = totalIafExpected;

      // For backward compatibility
      client.business_amount = totalBusinessAmount;
      client.iaf_expected = totalIafExpected;
      client.likely_value = totalIafExpected;

      // Add to total value if specified
      if (totalIafExpected) {
        totalValue += parseFloat(totalIafExpected);
      }

      // Calculate expected month from business type expected_close_date
      let expectedMonth = null;
      const businessTypeDates = clientBusinessTypes
        .filter(bt => bt.expected_close_date)
        .map(bt => new Date(bt.expected_close_date))
        .sort((a, b) => a - b);

      if (businessTypeDates.length > 0) {
        // Use earliest business type close date
        const earliestDate = businessTypeDates[0];
        expectedMonth = `${earliestDate.getFullYear()}-${String(earliestDate.getMonth() + 1).padStart(2, '0')}`;
      }

      if (expectedMonth) {
        const monthKey = expectedMonth; // Already in YYYY-MM format
        const date = new Date(expectedMonth + '-01');
        const monthName = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long'
        });

        if (!pipelineByMonth[monthKey]) {
          pipelineByMonth[monthKey] = {
            monthKey,
            month: monthName,
            clients: [],
            clientCount: 0,
            totalValue: 0
          };
        }

        pipelineByMonth[monthKey].clients.push(client);
        pipelineByMonth[monthKey].clientCount++;
        if (totalIafExpected) {
          pipelineByMonth[monthKey].totalValue += parseFloat(totalIafExpected);
        }
      } else {
        unscheduledClients.push(client);
      }
    }

    // Convert to array and sort by month
    const months = Object.values(pipelineByMonth).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    // Calculate summary statistics
    const summary = {
      totalValue: totalValue,
      totalClients: totalClients,
      averageValue: totalClients > 0 ? totalValue / totalClients : 0,
      months: months,
      unscheduledClients: unscheduledClients
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching pipeline data:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline data', details: error.message });
  }
});

// Update client pipeline data (simplified - only priority level)
router.put('/client/:clientId', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { clientId } = req.params;
    const { priority_level } = req.body;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Verify client belongs to advisor
    const { data: client, error: clientError } = await req.supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('user_id', userId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Update client - only priority_level is supported now
    const updateData = { updated_at: new Date().toISOString() };
    if (priority_level !== undefined) updateData.priority_level = priority_level;

    const { data: updatedClient, error: updateError } = await req.supabase
      .from('clients')
      .update(updateData)
      .eq('id', clientId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating client:', updateError);
      return res.status(500).json({ error: 'Failed to update client' });
    }

    // Log activity
    if (pipeline_stage !== undefined) {
      try {
        await req.supabase
          .from('pipeline_activities')
          .insert({
            client_id: clientId,
            advisor_id: userId,
            activity_type: 'stage_change',
            title: `Pipeline stage changed to ${pipeline_stage}`,
            description: `Client pipeline stage updated to ${pipeline_stage}`,
            metadata: { old_stage: client.pipeline_stage, new_stage: pipeline_stage }
          });
      } catch (activityError) {
        // Don't fail the whole operation if activity logging fails
        console.warn('Failed to log pipeline activity:', activityError.message);
      }
    }

    res.json(updatedClient);
  } catch (error) {
    console.error('Error updating client pipeline:', error);
    res.status(500).json({ error: 'Failed to update client pipeline', details: error.message });
  }
});

// Get todos for a specific client
router.get('/client/:clientId/todos', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { clientId } = req.params;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Verify client belongs to advisor
    const { data: client, error: clientError } = await req.supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('user_id', userId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get todos for client
    const { data: todos, error: todosError } = await req.supabase
      .from('client_todos')
      .select('*')
      .eq('client_id', clientId)
      .eq('user_id', userId)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (todosError) {
      console.error('Error fetching todos:', todosError);
      return res.status(500).json({ error: 'Failed to fetch todos' });
    }

    res.json(todos || []);
  } catch (error) {
    console.error('Error fetching client todos:', error);
    res.status(500).json({ error: 'Failed to fetch client todos', details: error.message });
  }
});

// Create a new todo for a client
router.post('/client/:clientId/todos', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { clientId } = req.params;
    const { title, description, priority, due_date, category } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Verify client belongs to advisor
    const { data: client, error: clientError } = await req.supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('user_id', userId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Create todo
    const { data: todo, error: todoError } = await req.supabase
      .from('client_todos')
      .insert({
        client_id: clientId,
        user_id: userId,
        title: title.trim(),
        description: description?.trim() || null,
        priority: priority || 3,
        due_date: due_date || null,
        category: category || 'general'
      })
      .select()
      .single();

    if (todoError) {
      console.error('Error creating todo:', todoError);
      return res.status(500).json({ error: 'Failed to create todo' });
    }

    res.status(201).json(todo);
  } catch (error) {
    console.error('Error creating client todo:', error);
    res.status(500).json({ error: 'Failed to create client todo', details: error.message });
  }
});

// Update a todo
router.put('/todos/:todoId', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { todoId } = req.params;
    const { title, description, priority, due_date, status, category } = req.body;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Verify todo belongs to advisor
    const { data: existingTodo, error: todoError } = await req.supabase
      .from('client_todos')
      .select('*')
      .eq('id', todoId)
      .eq('user_id', userId)
      .single();

    if (todoError || !existingTodo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    // Prepare update data
    const updateData = { updated_at: new Date().toISOString() };
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (priority !== undefined) updateData.priority = priority;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (category !== undefined) updateData.category = category;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'completed' && existingTodo.status !== 'completed') {
        updateData.completed_at = new Date().toISOString();
      } else if (status !== 'completed') {
        updateData.completed_at = null;
      }
    }

    // Update todo
    const { data: updatedTodo, error: updateError } = await req.supabase
      .from('client_todos')
      .update(updateData)
      .eq('id', todoId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating todo:', updateError);
      return res.status(500).json({ error: 'Failed to update todo' });
    }

    // Log activity if todo was completed
    if (status === 'completed' && existingTodo.status !== 'completed') {
      await req.supabase
        .from('pipeline_activities')
        .insert({
          client_id: existingTodo.client_id,
          user_id: userId,
          activity_type: 'todo_completed',
          title: `Completed: ${updatedTodo.title}`,
          description: `Todo item "${updatedTodo.title}" was marked as completed`,
          metadata: { todo_id: todoId, category: updatedTodo.category }
        });
    }

    res.json(updatedTodo);
  } catch (error) {
    console.error('Error updating todo:', error);
    res.status(500).json({ error: 'Failed to update todo', details: error.message });
  }
});

// Delete a todo
router.delete('/todos/:todoId', authenticateSupabaseUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { todoId } = req.params;

    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Delete todo (verify ownership through RLS policy)
    const { error: deleteError } = await req.supabase
      .from('client_todos')
      .delete()
      .eq('id', todoId)
      .eq('advisor_id', userId);

    if (deleteError) {
      console.error('Error deleting todo:', deleteError);
      return res.status(500).json({ error: 'Failed to delete todo' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting todo:', error);
    res.status(500).json({ error: 'Failed to delete todo', details: error.message });
  }
});

module.exports = router;