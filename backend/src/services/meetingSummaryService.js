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

const { generateUnifiedMeetingSummary, generateDetailedMeetingSummary } = require('./openai');

/**
 * Helper: wrap a promise with a timeout to prevent hanging requests.
 * @param {Promise} promise - The promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} label - Label for error messages
 * @returns {Promise}
 */
function withTimeout(promise, ms, label = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    )
  ]);
}

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
    detailedSummary: null,
    clientSummaryUpdated: false,
    pipelineUpdated: false,
    errors: []
  };

  if (!transcript || !transcript.trim()) {
    console.warn(`⚠️ No transcript text for meeting ${meetingId} - skipping summary generation`);
    return results;
  }

  // Fail fast if OpenAI is not available
  if (!process.env.OPENAI_API_KEY) {
    console.error(`❌ OPENAI_API_KEY not set - cannot generate summaries for meeting ${meetingId}`);
    results.errors.push('OPENAI_API_KEY not configured');
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
    console.log(`🤖 [MeetingSummaryService] Calling generateUnifiedMeetingSummary (transcript length: ${transcript.length} chars)...`);
    const unified = await withTimeout(
      generateUnifiedMeetingSummary(transcript, {
        clientName,
        maxActionItems: 7
      }),
      30000, // 30 second timeout for AI call
      'generateUnifiedMeetingSummary'
    );
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

    // ═══════════════════════════════════════════════════════
    // STEP 2.5: Generate Detailed Meeting Summary (1000+ words)
    // This provides the comprehensive breakdown for the Summary tab
    // ═══════════════════════════════════════════════════════
    console.log(`🤖 [MeetingSummaryService] Generating detailed summary for meeting ${meetingId}...`);
    try {
      const detailedSummary = await withTimeout(
        generateDetailedMeetingSummary(transcript, { clientName }),
        60000, // 60 second timeout for longer summary
        'generateDetailedMeetingSummary'
      );

      if (detailedSummary) {
        results.detailedSummary = detailedSummary;

        // Save detailed summary to meetings table
        const { error: detailedError } = await supabase
          .from('meetings')
          .update({
            detailed_summary: detailedSummary,
            updated_at: new Date().toISOString()
          })
          .eq('id', meetingId);

        if (detailedError) {
          console.error(`❌ Error saving detailed summary for meeting ${meetingId}:`, detailedError);
          results.errors.push('Failed to save detailed summary');
        } else {
          console.log(`✅ Detailed summary saved for meeting ${meetingId} (${detailedSummary.length} chars)`);
        }
      }
    } catch (detailedError) {
      console.error(`❌ Error generating detailed summary for meeting ${meetingId}:`, detailedError.message);
      results.errors.push(`Detailed summary generation failed: ${detailedError.message}`);
      // Don't rethrow - detailed summary is non-critical
    }

  } catch (error) {
    console.error(`❌ Error in quick summary generation for meeting ${meetingId}:`, error.message, error.stack);
    results.errors.push(`Quick summary generation failed: ${error.message}`);
  }

  // ═══════════════════════════════════════════════════════
  // STEPS 3 & 4: Update Client Summary + Pipeline (run in parallel)
  // These are secondary outputs - their failure doesn't affect quick summary
  // ═══════════════════════════════════════════════════════
  if (clientId) {
    const secondaryUpdates = [];

    // STEP 3: Update Client Summary (aggregated across ALL meetings)
    secondaryUpdates.push(
      withTimeout(
        updateClientSummary(supabase, userId, clientId),
        20000,
        'updateClientSummary'
      )
        .then(() => {
          results.clientSummaryUpdated = true;
          console.log(`✅ Client summary updated for client ${clientId}`);
        })
        .catch(error => {
          console.error(`❌ Error updating client summary for client ${clientId}:`, error.message);
          results.errors.push(`Client summary update failed: ${error.message}`);
        })
    );

    // STEP 4: Update Pipeline Next Steps (if client has business types)
    secondaryUpdates.push(
      withTimeout(
        updatePipelineNextSteps(supabase, userId, clientId),
        20000,
        'updatePipelineNextSteps'
      )
        .then(updated => {
          results.pipelineUpdated = !!updated;
          if (updated) {
            console.log(`✅ Pipeline next steps updated for client ${clientId}`);
          }
        })
        .catch(error => {
          console.error(`❌ Error updating pipeline next steps for client ${clientId}:`, error.message);
          results.errors.push(`Pipeline update failed: ${error.message}`);
        })
    );

    // Wait for both to complete (or timeout)
    await Promise.all(secondaryUpdates);
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
  console.log(`\n👤 CLIENT SUMMARY GENERATION`);
  console.log(`================================`);
  console.log(`Client ID: ${clientId}, User ID: ${userId}`);

  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY not set');
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
      console.error('❌ Client not found:', clientError?.message || 'No data returned');
      throw new Error(`Client ${clientId} not found`);
    }

    console.log(`📋 Generating summary for: ${client.name}`);

    // Get ALL meetings for this client (most recent first, limit 10 for context)
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('id, title, starttime, quick_summary, action_points, transcript')
      .eq('client_id', clientId)
      .eq('user_id', userId)
      .order('starttime', { ascending: false })
      .limit(10);

    if (meetingsError) {
      console.warn('⚠️ Error fetching meetings:', meetingsError.message);
    }

    console.log(`📅 Found ${meetings?.length || 0} meetings for context`);

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

    console.log(`🤖 Calling OpenAI API...`);

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
    console.log(`✅ Generated summary: ${summary.substring(0, 80)}...`);

    // Store updated summary
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        ai_summary: summary,
        ai_summary_generated_at: new Date().toISOString()
      })
      .eq('id', clientId);

    if (updateError) {
      console.error('❌ Error saving summary:', updateError.message);
    } else {
      console.log(`✅ Client summary saved successfully`);
    }

    console.log(`================================\n`);
    return summary;

  } catch (error) {
    console.error('❌ Error in updateClientSummary:', error.message);
    console.error(error.stack);
    throw error;
  }
}

/**
 * Update Pipeline Next Steps for a client by considering ALL meetings.
 * Only regenerates if the client has business types in the pipeline.
 * Returns true if updated, false if skipped.
 */
async function updatePipelineNextSteps(supabase, userId, clientId) {
  console.log(`\n📊 PIPELINE NEXT STEPS GENERATION`);
  console.log(`================================`);
  console.log(`Client ID: ${clientId}, User ID: ${userId}`);

  try {
    // Check if client has business types (pipeline entries)
    const { data: businessTypes, error: btError } = await supabase
      .from('client_business_types')
      .select('*')
      .eq('client_id', clientId);

    if (btError) {
      console.error('❌ Error fetching business types:', btError.message);
      return { success: false, error: 'Failed to fetch business types' };
    }

    if (!businessTypes || businessTypes.length === 0) {
      console.log('⏭️ No business types found - skipping pipeline summary');
      return { success: false, error: 'No business types configured for this client' };
    }

    console.log(`✅ Found ${businessTypes.length} business types`);

    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY not set');
      return { success: false, error: 'OpenAI API key not configured' };
    }

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Get client info
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('name, pipeline_notes')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError?.message || 'No data returned');
      return { success: false, error: 'Client not found' };
    }

    console.log(`📋 Generating summary for: ${client.name}`);

    // Get ALL meetings for context (limit to 5 most recent)
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('title, starttime, quick_summary, action_points')
      .eq('client_id', clientId)
      .eq('user_id', userId)
      .order('starttime', { ascending: false })
      .limit(5);

    if (meetingsError) {
      console.warn('⚠️ Error fetching meetings:', meetingsError.message);
    }

    console.log(`📅 Found ${meetings?.length || 0} meetings for context`);

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

    console.log(`🤖 Calling OpenAI API...`);

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
    console.log(`✅ Generated summary: ${summary.substring(0, 80)}...`);

    // Store updated pipeline summary (include user_id for RLS)
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        pipeline_next_steps: summary,
        pipeline_next_steps_generated_at: new Date().toISOString()
      })
      .eq('id', clientId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('❌ Error saving summary:', updateError.message);
      return { success: false, error: 'Failed to save summary', summary };
    }

    console.log(`✅ Pipeline summary saved successfully`);
    console.log(`================================\n`);
    return { success: true, summary };

  } catch (error) {
    console.error('❌ Error in updatePipelineNextSteps:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

module.exports = {
  generateMeetingOutputs,
  updateClientSummary,
  updatePipelineNextSteps
};
