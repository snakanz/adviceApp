const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function createTestPipelineData() {
  try {
    console.log('Creating test pipeline data...');
    
    // Sample clients with different close months (using existing schema)
    const testClients = [
      {
        advisor_id: '1',
        email: 'john.smith@example.com',
        name: 'John Smith',
        business_type: 'Retirement Planning',
        likely_value: 25000,
        likely_close_month: '2025-09-01'
      },
      {
        advisor_id: '1',
        email: 'sarah.johnson@example.com',
        name: 'Sarah Johnson',
        business_type: 'Investment Advisory',
        likely_value: 50000,
        likely_close_month: '2025-10-01'
      },
      {
        advisor_id: '1',
        email: 'mike.wilson@example.com',
        name: 'Mike Wilson',
        business_type: 'Tax Planning',
        likely_value: 15000,
        likely_close_month: '2025-11-01'
      },
      {
        advisor_id: '1',
        email: 'lisa.brown@example.com',
        name: 'Lisa Brown',
        business_type: 'Estate Planning',
        likely_value: 75000,
        likely_close_month: null // Unscheduled
      },
      {
        advisor_id: '1',
        email: 'david.taylor@example.com',
        name: 'David Taylor',
        business_type: 'Business Financial Planning',
        likely_value: 100000,
        likely_close_month: '2025-12-01'
      }
    ];

    // Insert test clients
    for (const client of testClients) {
      const { data, error } = await supabase
        .from('clients')
        .upsert(client, { onConflict: 'advisor_id,email' })
        .select();
      
      if (error) {
        console.error('Error inserting client:', client.email, error.message);
      } else {
        console.log('✅ Created/updated client:', client.name);
        
        // Skip todos for now since the table doesn't exist yet
        console.log('  - Client ID:', data[0].id);
      }
    }
    
    console.log('✅ Test pipeline data created successfully!');
  } catch (err) {
    console.error('Error creating test data:', err.message);
  }
}

createTestPipelineData();
