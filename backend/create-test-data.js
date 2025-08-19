const { getSupabase } = require('./src/lib/supabase');

async function createTestDataForSimon() {
  console.log('Creating test data for simon@greenwood.co.nz...');
  
  try {
    // First, find Simon's user ID
    const { data: user, error: userError } = await getSupabase()
      .from('users')
      .select('id')
      .eq('email', 'simon@greenwood.co.nz')
      .single();

    if (userError || !user) {
      console.error('User not found:', userError);
      return;
    }

    console.log('Found user ID:', user.id);

    // Create test clients
    const testClients = [
      {
        advisor_id: user.id,
        name: 'Amelia Johnson',
        email: 'amelia@wealthpipeline.co.uk',
        phone: '+44 20 7123 4567',
        status: 'active',
        likely_value: 150000,
        likely_close_month: '2025-03'
      },
      {
        advisor_id: user.id,
        name: 'Tyler Anderson',
        email: 'tyler@test.com',
        phone: '+1 555 0123',
        status: 'prospect',
        likely_value: 75000,
        likely_close_month: '2025-02'
      }
    ];

    const { data: clients, error: clientError } = await getSupabase()
      .from('clients')
      .insert(testClients)
      .select();

    if (clientError) {
      console.error('Error creating clients:', clientError);
      return;
    }

    console.log('Created clients:', clients.length);

    // Create test meetings
    const now = new Date();
    const testMeetings = [
      {
        userid: user.id,
        googleeventid: 'test-meeting-1',
        title: 'Investment Meeting: Amelia and Nelson',
        starttime: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        endtime: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hour later
        attendees: JSON.stringify([
          { email: 'simon@greenwood.co.nz', name: 'Simon Greenwood' },
          { email: 'amelia@wealthpipeline.co.uk', name: 'Amelia Johnson' }
        ]),
        transcript: 'Meeting transcript: We discussed Amelia\'s pension consolidation plans. She has two existing workplace pensions that she wants to combine into a single SJP Retirement Account. The current fragmentation is causing underperformance relative to her retirement goals. We agreed on a 1.7% management fee structure with ongoing advice and investment management.',
        quick_summary: '• Discussed pension consolidation into single SJP account\n• Agreed on 1.7% fee structure\n• Client interested in ongoing advice\n• Next steps: Review documents by end of week',
        email_summary_draft: 'Dear Amelia,\n\nThank you for your time during our meeting today. I\'m writing to summarize our key discussion points regarding your pension arrangements.\n\nWe discussed consolidating your two existing workplace pensions into a single SJP Retirement Account for better management and performance.\n\nNext Steps:\n- You will review the documents by end of week\n- I will follow up on Friday morning\n\nBest regards,\nSimon',
        email_template_id: 'auto-template'
      },
      {
        userid: user.id,
        googleeventid: 'test-meeting-2',
        title: 'Written Advice Meeting: Tyler and Simon',
        starttime: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        endtime: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        attendees: JSON.stringify([
          { email: 'simon@greenwood.co.nz', name: 'Simon Greenwood' },
          { email: 'tyler@test.com', name: 'Tyler Anderson' }
        ]),
        transcript: 'Meeting with Tyler to discuss his investment portfolio and risk tolerance. Tyler is looking to diversify his current holdings and is interested in ESG investments. We reviewed his current portfolio performance and discussed rebalancing strategies.',
        quick_summary: '• Reviewed current portfolio performance\n• Discussed ESG investment options\n• Identified rebalancing opportunities\n• Client interested in sustainable investing',
        email_summary_draft: 'Dear Tyler,\n\nThank you for our productive meeting today. We covered your portfolio review and discussed your interest in ESG investments.\n\nKey points:\n- Current portfolio analysis completed\n- ESG investment options identified\n- Rebalancing strategy proposed\n\nI will prepare a detailed proposal for our next meeting.\n\nBest regards,\nSimon'
      }
    ];

    const { data: meetings, error: meetingError } = await getSupabase()
      .from('meetings')
      .insert(testMeetings)
      .select();

    if (meetingError) {
      console.error('Error creating meetings:', meetingError);
      return;
    }

    console.log('Created meetings:', meetings.length);
    console.log('✅ Test data created successfully!');
    console.log('You should now see meetings in your dashboard.');

  } catch (error) {
    console.error('Error creating test data:', error);
  }
}

// Run the script
createTestDataForSimon().then(() => {
  console.log('Script completed');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
