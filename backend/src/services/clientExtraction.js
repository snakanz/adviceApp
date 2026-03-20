const { getSupabase } = require('../lib/supabase');

/**
 * Client Extraction Service
 * Extracts client information from meeting attendees and links meetings to clients
 */
class ClientExtractionService {
  
  /**
   * Process all meetings without client_id and link them to clients
   */
  async linkMeetingsToClients(userId) {
    console.log('🔗 Starting client extraction and linking process...');
    
    try {
      // Get all meetings without client_id
      const { data: unlinkedMeetings, error: meetingsError } = await getSupabase()
        .from('meetings')
        .select('id, title, attendees, external_id')
        .eq('user_id', userId)
        .is('client_id', null)
        .not('attendees', 'is', null);

      if (meetingsError) {
        throw new Error(`Failed to fetch unlinked meetings: ${meetingsError.message}`);
      }

      console.log(`📊 Found ${unlinkedMeetings.length} meetings without client links`);

      let processed = 0;
      let linked = 0;
      let clientsCreated = 0;

      for (const meeting of unlinkedMeetings) {
        try {
          const result = await this.processMeetingForClientExtraction(userId, meeting);
          processed++;
          
          if (result.linked) {
            linked++;
          }
          if (result.clientCreated) {
            clientsCreated++;
          }
          
          console.log(`✅ Processed: ${meeting.title} - ${result.action}`);
        } catch (error) {
          console.error(`❌ Failed to process meeting "${meeting.title}":`, error.message);
        }
      }

      console.log(`🎉 Client linking complete!`);
      console.log(`📈 Results: ${processed} processed, ${linked} linked, ${clientsCreated} clients created`);

      return {
        processed,
        linked,
        clientsCreated,
        success: true
      };

    } catch (error) {
      console.error('❌ Client extraction failed:', error);
      return {
        processed: 0,
        linked: 0,
        clientsCreated: 0,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process a single meeting to extract and link client
   */
  async processMeetingForClientExtraction(userId, meeting) {
    // Parse attendees JSON
    let attendees;
    try {
      attendees = JSON.parse(meeting.attendees);
    } catch (error) {
      return { action: 'Skipped - Invalid attendees JSON', linked: false, clientCreated: false };
    }

    if (!Array.isArray(attendees) || attendees.length === 0) {
      return { action: 'Skipped - No attendees', linked: false, clientCreated: false };
    }

    // Find the primary client (first attendee that's not the advisor)
    const primaryClient = this.extractPrimaryClient(attendees, meeting.title);
    
    if (!primaryClient) {
      return { action: 'Skipped - No client found in attendees', linked: false, clientCreated: false };
    }

    // Find or create client
    const client = await this.findOrCreateClient(userId, primaryClient);
    
    if (!client) {
      return { action: 'Failed - Could not create/find client', linked: false, clientCreated: false };
    }

    // Link meeting to client
    const { error: updateError } = await getSupabase()
      .from('meetings')
      .update({ client_id: client.id })
      .eq('id', meeting.id);

    if (updateError) {
      throw new Error(`Failed to link meeting to client: ${updateError.message}`);
    }

    return { 
      action: `Linked to ${client.name} (${client.email})`, 
      linked: true, 
      clientCreated: client.wasCreated || false 
    };
  }

  /**
   * Extract primary client from attendees list
   */
  extractPrimaryClient(attendees, meetingTitle) {
    // Filter out common advisor/organizer emails and focus on clients
    const potentialClients = attendees.filter(attendee => {
      const email = attendee.email?.toLowerCase();
      if (!email || !email.includes('@')) return false;
      
      // Skip system/no-reply emails (be specific to avoid filtering real clients)
      if (email.includes('noreply') ||
          email.includes('no-reply') ||
          email.endsWith('@calendar.google.com') ||
          email.endsWith('@resource.calendar.google.com') ||
          email.includes('calendar-notification') ||
          email === 'simon@greenwood.co.nz') {
        return false;
      }
      
      return true;
    });

    if (potentialClients.length === 0) {
      return null;
    }

    // Use the first valid client attendee
    const primaryAttendee = potentialClients[0];
    
    return {
      email: primaryAttendee.email,
      name: this.extractClientName(primaryAttendee, meetingTitle),
      displayName: primaryAttendee.displayName
    };
  }

  /**
   * Extract client name from attendee data or meeting title
   */
  extractClientName(attendee, meetingTitle) {
    // Try displayName first
    if (attendee.displayName && attendee.displayName.trim()) {
      return attendee.displayName.trim();
    }

    // Try to extract name from meeting title
    const nameFromTitle = this.extractNameFromMeetingTitle(meetingTitle);
    if (nameFromTitle) {
      return nameFromTitle;
    }

    // Fallback to email username
    return attendee.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Extract client name from meeting title patterns
   */
  extractNameFromMeetingTitle(title) {
    if (!title) return null;

    // Common patterns: "Meeting with John", "John and Nelson", "Call with Sarah"
    const patterns = [
      /meeting with ([^,\n]+)/i,
      /call with ([^,\n]+)/i,
      /([^,\n]+) and nelson/i,
      /nelson and ([^,\n]+)/i,
      /([^,\n]+) meeting/i
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        // Skip if it looks like a generic term
        if (!['dad', 'mom', 'team', 'group', 'staff'].includes(name.toLowerCase())) {
          return name;
        }
      }
    }

    return null;
  }

  /**
   * Find existing client or create new one
   */
  async findOrCreateClient(userId, clientData) {
    // First, try to find existing client by email
    const { data: existingClient } = await getSupabase()
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .eq('email', clientData.email)
      .single();

    if (existingClient) {
      return { ...existingClient, wasCreated: false };
    }

    // Create new client
    const newClientData = {
      user_id: userId,
      email: clientData.email,
      name: clientData.name,
      pipeline_stage: 'unscheduled',
      priority_level: 3,
      source: 'google_calendar',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: newClient, error: createError } = await getSupabase()
      .from('clients')
      .insert(newClientData)
      .select()
      .single();

    if (createError) {
      console.error('Failed to create client:', createError);
      return null;
    }

    console.log(`👤 Created new client: ${newClient.name} (${newClient.email})`);
    return { ...newClient, wasCreated: true };
  }
}

module.exports = new ClientExtractionService();
