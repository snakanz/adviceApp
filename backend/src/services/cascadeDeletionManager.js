const { getSupabase } = require('../config/supabase');

class CascadeDeletionManager {
  constructor() {
    this.supabase = getSupabase();
  }

  /**
   * Handle cascade operations when a meeting is deleted
   */
  async handleMeetingDeletion(meetingId, userId, options = {}) {
    const { 
      softDelete = true, 
      preserveHistorical = true,
      dryRun = false 
    } = options;

    console.log(`🗑️  Processing cascade deletion for meeting ${meetingId} (dry run: ${dryRun})`);

    const results = {
      meeting: null,
      affectedRecords: {
        askThreads: 0,
        summaries: 0,
        transcripts: 0,
        clientStatus: null
      },
      operations: [],
      errors: []
    };

    try {
      // Get meeting details first
      const { data: meeting } = await this.supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .eq('user_id', userId)
        .single();

      if (!meeting) {
        throw new Error(`Meeting ${meetingId} not found for user ${userId}`);
      }

      results.meeting = meeting;

      // 1. Handle Ask Advicly threads
      if (meeting.client_id) {
        await this.handleAskAdviclyThreads(meeting.client_id, userId, results, dryRun);
      }

      // 2. Handle meeting summaries and transcripts
      await this.handleMeetingSummaries(meetingId, results, dryRun);

      // 3. Update the meeting itself
      await this.updateMeetingStatus(meetingId, softDelete, results, dryRun);

      // 4. Update client status (this will trigger our database triggers)
      if (meeting.client_id) {
        await this.updateClientStatus(meeting.client_id, results, dryRun);
      }

      console.log(`✅ Cascade deletion completed for meeting ${meetingId}`);
      return results;

    } catch (error) {
      console.error(`❌ Error in cascade deletion for meeting ${meetingId}:`, error);
      results.errors.push(error.message);
      throw error;
    }
  }

  /**
   * Handle Ask Advicly threads related to the client
   */
  async handleAskAdviclyThreads(clientId, userId, results, dryRun) {
    try {
      // Check if ask_threads table exists
      const { data: tableExists } = await this.supabase
        .rpc('check_table_exists', { table_name: 'ask_threads' });

      if (!tableExists) {
        results.operations.push('Ask Advicly threads table not found - skipping');
        return;
      }

      // Get threads for this client
      const { data: threads } = await this.supabase
        .from('ask_threads')
        .select('id, title, is_archived')
        .eq('client_id', clientId)
        .eq('advisor_id', userId)
        .eq('is_archived', false);

      if (threads && threads.length > 0) {
        if (!dryRun) {
          // Archive threads instead of deleting them
          const { error } = await this.supabase
            .from('ask_threads')
            .update({ 
              is_archived: true, 
              updated_at: new Date().toISOString() 
            })
            .eq('client_id', clientId)
            .eq('advisor_id', userId)
            .eq('is_archived', false);

          if (error) throw error;
        }

        results.affectedRecords.askThreads = threads.length;
        results.operations.push(`Archived ${threads.length} Ask Advicly threads`);
      }

    } catch (error) {
      results.errors.push(`Ask Advicly threads: ${error.message}`);
    }
  }

  /**
   * Handle meeting summaries and transcripts
   */
  async handleMeetingSummaries(meetingId, results, dryRun) {
    try {
      // Handle transcript field in meetings table
      const { data: meetingWithTranscript } = await this.supabase
        .from('meetings')
        .select('transcript, quick_summary, email_summary_draft')
        .eq('id', meetingId)
        .single();

      if (meetingWithTranscript) {
        let summaryCount = 0;
        if (meetingWithTranscript.transcript) summaryCount++;
        if (meetingWithTranscript.quick_summary) summaryCount++;
        if (meetingWithTranscript.email_summary_draft) summaryCount++;

        if (summaryCount > 0 && !dryRun) {
          // Clear summary fields but preserve in a backup column if needed
          const { error } = await this.supabase
            .from('meetings')
            .update({
              // Keep transcripts and summaries for historical reference
              // Just mark them as inactive via the meeting's deletion status
              last_summarized_at: null
            })
            .eq('id', meetingId);

          if (error) throw error;
        }

        results.affectedRecords.summaries = summaryCount;
        results.operations.push(`Processed ${summaryCount} summary/transcript records`);
      }

    } catch (error) {
      results.errors.push(`Meeting summaries: ${error.message}`);
    }
  }

  /**
   * Update meeting status (soft delete)
   */
  async updateMeetingStatus(meetingId, softDelete, results, dryRun) {
    try {
      if (!dryRun) {
        const updateData = softDelete ? {
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          last_calendar_sync: new Date().toISOString(),
          sync_status: 'deleted'
        } : {
          // Hard delete would go here, but we prefer soft delete
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          sync_status: 'deleted'
        };

        const { error } = await this.supabase
          .from('meetings')
          .update(updateData)
          .eq('id', meetingId);

        if (error) throw error;
      }

      results.operations.push(`Meeting marked as deleted (soft delete: ${softDelete})`);

    } catch (error) {
      results.errors.push(`Meeting update: ${error.message}`);
    }
  }

  /**
   * Update client status (triggers will handle the actual updates)
   */
  async updateClientStatus(clientId, results, dryRun) {
    try {
      if (!dryRun) {
        // Touch the client record to trigger our database triggers
        const { error } = await this.supabase
          .from('clients')
          .update({ last_activity_sync: new Date().toISOString() })
          .eq('id', clientId);

        if (error) throw error;

        // Get updated client status
        const { data: client } = await this.supabase
          .from('clients')
          .select('name, is_active, active_meeting_count, meeting_count')
          .eq('id', clientId)
          .single();

        results.affectedRecords.clientStatus = client;
      }

      results.operations.push('Client status updated via database triggers');

    } catch (error) {
      results.errors.push(`Client status update: ${error.message}`);
    }
  }

  /**
   * Handle bulk cascade deletion for multiple meetings
   */
  async handleBulkMeetingDeletion(meetingIds, userId, options = {}) {
    console.log(`🗑️  Processing bulk cascade deletion for ${meetingIds.length} meetings`);

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      details: [],
      summary: {
        totalAskThreads: 0,
        totalSummaries: 0,
        affectedClients: new Set()
      }
    };

    for (const meetingId of meetingIds) {
      try {
        const result = await this.handleMeetingDeletion(meetingId, userId, options);
        results.successful++;
        results.details.push({
          meetingId,
          success: true,
          result
        });

        // Aggregate summary data
        results.summary.totalAskThreads += result.affectedRecords.askThreads;
        results.summary.totalSummaries += result.affectedRecords.summaries;
        if (result.meeting?.client_id) {
          results.summary.affectedClients.add(result.meeting.client_id);
        }

      } catch (error) {
        results.failed++;
        results.details.push({
          meetingId,
          success: false,
          error: error.message
        });
      }
      results.processed++;
    }

    results.summary.affectedClients = results.summary.affectedClients.size;

    console.log(`✅ Bulk cascade deletion completed: ${results.successful}/${results.processed} successful`);
    return results;
  }

  /**
   * Restore a deleted meeting and its related data
   */
  async restoreMeeting(meetingId, userId, options = {}) {
    const { dryRun = false } = options;

    console.log(`🔄 Restoring meeting ${meetingId} and related data (dry run: ${dryRun})`);

    const results = {
      meeting: null,
      restoredRecords: {
        askThreads: 0,
        clientStatus: null
      },
      operations: [],
      errors: []
    };

    try {
      // Get meeting details
      const { data: meeting } = await this.supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .eq('userid', userId)
        .single();

      if (!meeting) {
        throw new Error(`Meeting ${meetingId} not found for user ${userId}`);
      }

      if (!meeting.is_deleted) {
        throw new Error(`Meeting ${meetingId} is not deleted`);
      }

      results.meeting = meeting;

      // 1. Restore the meeting
      if (!dryRun) {
        const { error } = await this.supabase
          .from('meetings')
          .update({
            is_deleted: false,
            deleted_at: null,
            last_calendar_sync: new Date().toISOString(),
            sync_status: 'active'
          })
          .eq('id', meetingId);

        if (error) throw error;
      }

      results.operations.push('Meeting restored to active status');

      // 2. Restore Ask Advicly threads if they were archived due to this meeting
      if (meeting.client_id) {
        await this.restoreAskAdviclyThreads(meeting.client_id, userId, results, dryRun);
      }

      // 3. Update client status (triggers will handle this)
      if (meeting.client_id) {
        await this.updateClientStatus(meeting.client_id, results, dryRun);
      }

      console.log(`✅ Meeting ${meetingId} restored successfully`);
      return results;

    } catch (error) {
      console.error(`❌ Error restoring meeting ${meetingId}:`, error);
      results.errors.push(error.message);
      throw error;
    }
  }

  /**
   * Restore Ask Advicly threads for a client
   */
  async restoreAskAdviclyThreads(clientId, userId, results, dryRun) {
    try {
      // Check if client now has active meetings
      const { data: activeMeetings } = await this.supabase
        .from('meetings')
        .select('id')
        .eq('client_id', clientId)
        .eq('userid', userId)
        .eq('is_deleted', false);

      if (activeMeetings && activeMeetings.length > 0) {
        // Client has active meetings, restore archived threads
        if (!dryRun) {
          const { error } = await this.supabase
            .from('ask_threads')
            .update({ 
              is_archived: false, 
              updated_at: new Date().toISOString() 
            })
            .eq('client_id', clientId)
            .eq('advisor_id', userId)
            .eq('is_archived', true);

          if (error) throw error;
        }

        results.operations.push('Ask Advicly threads restored from archive');
      }

    } catch (error) {
      results.errors.push(`Ask Advicly thread restoration: ${error.message}`);
    }
  }

  /**
   * Get cascade deletion preview (dry run)
   */
  async previewCascadeDeletion(meetingId, userId) {
    return await this.handleMeetingDeletion(meetingId, userId, { dryRun: true });
  }

  /**
   * Get restoration preview (dry run)
   */
  async previewMeetingRestoration(meetingId, userId) {
    return await this.restoreMeeting(meetingId, userId, { dryRun: true });
  }
}

module.exports = new CascadeDeletionManager();
