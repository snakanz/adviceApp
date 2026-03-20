const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://ixqkqvfkpbkdxqjlbvxr.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cWtxdmZrcGJrZHhxamxidnhyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDkyNTg3NCwiZXhwIjoyMDUwNTAxODc0fQ.YhUKVauu_Aw6Ej_2vJGGKJJOJqOdHZhHnqJhJqOdHZhH';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addActionPointsColumn() {
  try {
    console.log('🔧 Starting action_points column migration...');
    
    // Check if column already exists
    const { data: existingData, error: checkError } = await supabase
      .from('meetings')
      .select('action_points')
      .limit(1);
    
    if (checkError && checkError.message.includes('column "action_points" does not exist')) {
      console.log('📝 Column does not exist, adding it...');
      
      // Execute raw SQL to add the column
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE meetings ADD COLUMN IF NOT EXISTS action_points TEXT;'
      });
      
      if (error) {
        console.error('❌ Error adding column with rpc:', error);
        
        // Try direct approach - this might work better
        try {
          const { error: directError } = await supabase
            .from('meetings')
            .update({ action_points: null })
            .eq('id', 999999); // Non-existent ID to trigger column check
            
          if (directError && directError.message.includes('column "action_points" does not exist')) {
            console.log('🚨 Column definitely does not exist. Manual SQL required.');
            console.log('Please run this SQL in your Supabase dashboard:');
            console.log('ALTER TABLE meetings ADD COLUMN IF NOT EXISTS action_points TEXT;');
          }
        } catch (directErr) {
          console.log('Direct approach also failed:', directErr);
        }
      } else {
        console.log('✅ Successfully added action_points column');
      }
    } else if (!checkError) {
      console.log('✅ action_points column already exists');
    } else {
      console.error('❌ Error checking column:', checkError);
    }
    
    // Verify the column was added
    const { data: verifyData, error: verifyError } = await supabase
      .from('meetings')
      .select('action_points')
      .limit(1);
    
    if (!verifyError) {
      console.log('✅ Migration completed successfully - action_points column is available');
    } else {
      console.log('❌ Migration verification failed:', verifyError.message);
    }
    
  } catch (err) {
    console.error('❌ Migration failed:', err);
  }
}

// Run migration if called directly
if (require.main === module) {
  addActionPointsColumn().then(() => {
    console.log('Migration script completed');
    process.exit(0);
  }).catch(err => {
    console.error('Migration script failed:', err);
    process.exit(1);
  });
}

module.exports = { addActionPointsColumn };
