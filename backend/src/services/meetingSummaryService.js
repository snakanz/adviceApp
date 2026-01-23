/**
 * Meeting Summary Service
 *
 * Core service that handles ALL AI-generated outputs for a meeting.
 * This runs INDEPENDENTLY of email generation - it always produces:
 *   - Quick Summary (1 sentence)
 *   - Action Items (pending approval)
 *   - Client Summary update (aggregated across all meetings)
 *   - Pipeline Next Steps update (if client has business types)
 *
 * Email generation is SECONDARY and handled separately by emailPromptEngine.
 */

const { generateUnifiedMeetingSummary } = require('./openai');

/**
 * Generate all core meeting outputs (excluding email).
 * This should be called whenever a transcript becomes available,
 * regardless of whether an email will be generated.
 *
 * @param {object} params
 * @param {object} params.supabase - Supabase client
 * @param {string} params.userId - User ID
 * @param {number} params.meetingId - Meeting DB ID
 * @param {string} params.transcript - Full transcript text
 * @param {object} [params.meeting] - Pre-fetched meeting object (optional, will fetch if not provided)
 * @returns {object} { quickSummary, actionPointsArray, clientSummaryUpdated, pipelineUpdated }
 */
async function generateMeetingOutputs({ supabase, userId, meetingId, transcript, meeting }) {
  const results = {
    quickSummary: null,
    actionPointsArray: [],
    clientSummaryUpdated: false,
    pipelineUpdated: false,
    errors: []
  };

  if (!transcript || !transcript.trim()) {
    console.warn(`⚠️ No transcript text for meeting ${meetingId} - skipping summary generation`);
    return results;
  }

  // Fetch full meeting with client info if not provided
  if (!meeting) {
    const { data: fetchedMeeting, error } = await supabase
      .from('meetings')
      .select('*, clients(id, name, email)')
      .eq('id', meetingId)
      .single();

    if (error || !fetchedMeeting) {
      console.error(`❌ Could not fetch meeting ${meetingId}:`, error);
      results.errors.push('Failed to fetch meeting data');
      return results;
    }
    meeting = fetchedMeeting;
  }

  // Extract client info
  const clientName = meeting.clients?.name || meeting.client?.name || 'Client';
  const clientId = meeting.client_id;

  // ═══════════════════════════════════════════════════════
  // STEP 1: Generate Quick Summary + Action Items
  // This ALWAYS runs regardless of email generation
  // ═══════════════════════════════════════════════════════
  console.log(`🤖 [MeetingSummaryService] Generating quick summary + action items for meeting ${meetingId} (client: ${clientName})`);

  try {
    console.log(`🤖 [MeetingSummaryService] Calling generateUnifiedMeetingSummary...`);
    const unified = await generateUnifiedMeetingSummary(transcript, {
      clientName,
      maxActionItems: 7
    });
    console.log(`🤖 [MeetingSummaryService] AI response received: quickSummary=${unified.quickSummary ? 'YES' : 'NO'}, actionPoints=${unified.actionPointsArray?.length || 0}`);

    results.quickSummary = unified.quickSummary;
    results.actionPointsArray = unified.actionPointsArray || [];

    // Build action points string for DB storage
    const actionPointsString = results.actionPointsArray.length > 0
      ? results.actionPointsArray.map((item, i) => `${i + 1}. ${item}`).join('\n')
      : '';

    // Save to meetings table
    console.log(`🤖 [MeetingSummaryService] Saving quick summary to DB for meeting ${meetingId}...`);
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        quick_summary: results.quickSummary,
        action_points: actionPointsString,
        last_summarized_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', meetingId);

    if (updateError) {
      console.error(`❌ Error saving quick summary for meeting ${meetingId}:`, updateError);
      results.errors.push('Failed to save quick summary');
    } else {
      console.log(`✅ Quick summary saved for meeting ${meetingId}: "${results.quickSummary?.substring(0, 50)}..."`);
    }

    // ═══════════════════════════════════════════════════════
    // STEP 2: Save Action Items to Pending Table
    // ═══════════════════════════════════════════════════════
    if (results.actionPointsArray.length > 0) {
      console.log(`🤖 [MeetingSummaryService] Saving ${results.actionPointsArray.length} action items to pending table...`);

      // Delete existing pending items for this meeting
      const { error: deleteError } = await supabase
        .from('pending_transcript_action_items')
        .delete()
        .eq('meeting_id', meetingId);

      if (deleteError) {
        console.warn(`⚠️ Error deleting old pending items (continuing):`, deleteError);
      }

      const actionItemsToInsert = results.actionPointsArray.map((actionText, index) => ({
        meeting_id: meetingId,
        client_id: clientId || null,
        advisor_id: userId,
        action_text: actionText,
        display_order: index
      }));

      console.log(`🤖 [MeetingSummaryService] Inserting action items:`, JSON.stringify(actionItemsToInsert[0]));
      const { error: actionItemsError } = await supabase
        .from('pending_transcript_action_items')
        .insert(actionItemsToInsert);

      if (actionItemsError) {
        console.error(`❌ Error saving pending action items for meeting ${meetingId}:`, actionItemsError);
        results.errors.push(`Failed to save action items: ${JSON.stringify(actionItemsError)}`);
      } else {
        console.log(`✅ Saved ${results.actionPointsArray.length} pending action items for meeting ${meetingId}`);
      }
    }

  } catch (error) {
    console.error(`❌ Error in quick summary generation for meeting ${meetingId}:`, error.message, error.stack);
    results.errors.push(`Quick summary generation failed: ${error.message}`);
  }

  // ═══════════════════════════════════════════════════════
  // STEP 3: Update Client Summary (aggregated across ALL meetings)
  // Only if meeting is linked to a client
  // ═══════════════════════════════════════════════════════
  if (clientId) {
    try {
      await updateClientSummary(supabase, userId, clientId);
      results.clientSummaryUpdated = true;
      console.log(`✅ Client summary updated for client ${clientId}`);
    } catch (error) {
      console.error(`❌ Error updating client summary for client ${clientId}:`, error);
      results.errors.push(`Client summary update failed: ${error.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP 4: Update Pipeline Next Steps (if client has business types)
  // Only if meeting is linked to a client
  // ═══════════════════════════════════════════════════════
  if (clientId) {
    try {
      const updated = await updatePipelineNextSteps(supabase, userId, clientId);
      results.pipelineUpdated = updated;
      if (updated) {
        console.log(`✅ Pipeline next steps updated for client ${clientId}`);
      }
    } catch (error) {
      console.error(`❌ Error updating pipeline next steps for client ${clientId}:`, error);
      results.errors.push(`Pipeline update failed: ${error.message}`);
    }
  }

  console.log(`✅ [MeetingSummaryService] Complete for meeting ${meetingId}. ` +
    `Quick summary: ${results.quickSummary ? 'YES' : 'NO'}, ` +
    `Action items: ${results.actionPointsArray.length}, ` +
    `Client summary: ${results.clientSummaryUpdated ? 'UPDATED' : 'SKIPPED'}, ` +
    `Pipeline: ${results.pipelineUpdated ? 'UPDATED' : 'SKIPPED'}`);

  return results;
}

/**
 * Update client AI summary by aggregating across ALL meetings for that client.
 * This provides a rolling, always-current view of the client relationship.
 */
async function updateClientSummary(supabase, userId, clientId) {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️ OPENAI_API_KEY not set - skipping client summary update');
    return null;
  }
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Get client info
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .eq('user_id', userId)
    .single();

  if (clientError || !client) {
    throw new Error(`Client ${clientId} not found`);
  }

  // Get ALL meetings for this client (most recent first, limit 10 for context)
  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, title, starttime, quick_summary, action_points, transcript')
    .eq('client_id', clientId)
    .eq('user_id', userId)
    .order('starttime', { ascending: false })
    .limit(10);

  const meetingsWithContent = (meetings || []).filter(m =>
    m.quick_summary || m.action_points || m.transcript
  );

  // Get business types
  const { data: businessTypes } = await supabase
    .from('client_business_types')
    .select('*')
    .eq('client_id', clientId);

  // Get pending action items across all meetings (guard against empty array)
  let actionItems = [];
  const meetingIds = (meetings || []).map(m => m.id).filter(Boolean);
  if (meetingIds.length > 0) {
    const { data: fetchedItems } = await supabase
      .from('transcript_action_items')
      .select('action_text, completed')
      .eq('advisor_id', userId)
      .in('meeting_id', meetingIds)
      .eq('completed', false);
    actionItems = fetchedItems || [];
  }

  // Get client todos
  const { data: clientTodos } = await supabase
    .from('client_todos')
    .select('title, status')
    .eq('client_id', clientId)
    .eq('status', 'pending');

  // Build meeting context (recency-weighted: more detail for recent meetings)
  const meetingContext = meetingsWithContent.map((m, idx) => {
    const isRecent = idx < 3;
    return `- ${new Date(m.starttime).toLocaleDateString()}: ${m.title}\n  ${isRecent ? (m.quick_summary || 'No summary') : (m.quick_summary?.substring(0, 80) || 'No summary')}${isRecent && m.action_points ? '\n  Actions: ' + m.action_points.substring(0, 200) : ''}`;
  }).join('\n');

  const businessContext = (businessTypes || []).map(bt =>
    `- ${bt.business_type}: £${bt.business_amount?.toLocaleString() || 0} (IAF: £${bt.iaf_expected?.toLocaleString() || 0})`
  ).join('\n');

  const pendingActions = [
    ...actionItems.map(ai => ai.action_text),
    ...(clientTodos || []).map(t => t.title)
  ];

  // Calculate meeting stats
  const now = new Date();
  const totalMeetings = meetings?.length || 0;
  const upcomingMeetings = (meetings || []).filter(m => new Date(m.starttime) > now);
  const hasUpcoming = upcomingMeetings.length > 0;
  const nextMeetingDate = hasUpcoming
    ? upcomingMeetings.sort((a, b) => new Date(a.starttime) - new Date(b.starttime))[0].starttime
    : null;

  const prompt = `You are a financial advisor's assistant. Generate a brief, professional summary (2-3 sentences) of where we're at with this client based on ALL their meetings and business information.

Client: ${client.name}

Meeting History (${totalMeetings} total, most recent first):
${meetingContext || 'No meetings with content'}

Has upcoming meeting: ${hasUpcoming ? `Yes (${new Date(nextMeetingDate).toLocaleDateString()})` : 'No - CONSIDER BOOKING A MEETING'}

Business Types:
${businessContext || 'No business types set'}

Pending Action Items (${pendingActions.length}):
${pendingActions.length > 0 ? pendingActions.slice(0, 7).map(ai => `- ${ai}`).join('\n') : 'None'}

Generate a concise summary that captures:
1. Current relationship status and engagement level (based on meeting frequency/recency)
2. Key business opportunities or progress
3. Immediate next steps (prioritize pending action items and meeting scheduling if needed)

${!hasUpcoming ? 'IMPORTANT: Suggest booking a meeting since there is no upcoming meeting scheduled.' : ''}
${pendingActions.length > 0 ? 'IMPORTANT: Mention the most critical pending action items.' : ''}

Keep it professional, factual, and under 100 words. This should represent the OVERALL client relationship, not just the latest meeting.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a professional financial advisor assistant. Generate concise, factual client summaries that aggregate information across all meetings.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.5,
    max_tokens: 200
  });

  const summary = completion.choices[0].message.content.trim();

  // Store updated summary
  await supabase
    .from('clients')
    .update({
      ai_summary: summary,
      ai_summary_generated_at: new Date().toISOString()
    })
    .eq('id', clientId);

  return summary;
}

/**
 * Update Pipeline Next Steps for a client by considering ALL meetings.
 * Only regenerates if the client has business types in the pipeline.
 * Returns true if updated, false if skipped.
 */
async function updatePipelineNextSteps(supabase, userId, clientId) {
  // Check if client has business types (pipeline entries)
  const { data: businessTypes } = await supabase
    .from('client_business_types')
    .select('*')
    .eq('client_id', clientId);

  if (!businessTypes || businessTypes.length === 0) {
    return false; // No pipeline entries, skip
  }

  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️ OPENAI_API_KEY not set - skipping pipeline update');
    return false;
  }
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Get client info
  const { data: client } = await supabase
    .from('clients')
    .select('name, pipeline_notes')
    .eq('id', clientId)
    .single();

  if (!client) return false;

  // Get ALL meetings for context (limit to 5 most recent)
  const { data: meetings } = await supabase
    .from('meetings')
    .select('title, starttime, quick_summary, action_points')
    .eq('client_id', clientId)
    .eq('user_id', userId)
    .order('starttime', { ascending: false })
    .limit(5);

  // Aggregate action points from all meetings
  const allActionPoints = (meetings || [])
    .filter(m => m.action_points)
    .map(m => m.action_points)
    .join('\n');

  // Build meeting summaries context
  const meetingSummaries = (meetings || [])
    .filter(m => m.quick_summary)
    .map(m => `- ${new Date(m.starttime).toLocaleDateString()}: ${m.quick_summary}`)
    .join('\n');

  const businessContext = businessTypes.map(bt => ({
    type: bt.business_type,
    amount: bt.business_amount,
    iaf: bt.iaf_expected,
    expectedClose: bt.expected_close_date,
    stage: bt.stage,
    notes: bt.notes
  }));

  const prompt = `You are a financial advisor's assistant. Generate a brief, actionable summary (2-3 sentences maximum) explaining what needs to happen to finalize this business deal.

Client: ${client.name}

Business Types:
${businessContext.map(bt => `- ${bt.type}: £${bt.amount?.toLocaleString() || 0} (IAF: £${bt.iaf?.toLocaleString() || 0})
  Stage: ${bt.stage || 'Not set'} | Expected Close: ${bt.expectedClose || 'Not set'}
  ${bt.notes ? 'Notes: ' + bt.notes : ''}`).join('\n')}

Recent Meeting Summaries:
${meetingSummaries || 'No meeting summaries available'}

Action Points (from all meetings):
${allActionPoints || 'None'}

Pipeline Notes:
${client.pipeline_notes || 'None'}

Generate a concise, actionable summary that explains:
1. What specific actions or documents are needed to close this deal
2. Any blockers or pending items from recent meetings that need attention
3. The immediate next step the advisor should take

Be specific and actionable. Focus on what needs to happen NOW to move this forward. Maximum 3 sentences.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a professional financial advisor assistant. Generate concise, actionable next steps for closing business deals, incorporating context from all client meetings.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.5,
    max_tokens: 150
  });

  const summary = completion.choices[0].message.content.trim();

  // Store updated pipeline summary
  await supabase
    .from('clients')
    .update({
      pipeline_next_steps: summary,
      pipeline_next_steps_generated_at: new Date().toISOString()
    })
    .eq('id', clientId);

  return true;
}

module.exports = {
  generateMeetingOutputs,
  updateClientSummary,
  updatePipelineNextSteps
};
