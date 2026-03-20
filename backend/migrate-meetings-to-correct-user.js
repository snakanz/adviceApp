#!/usr/bin/env node

/**
 * CRITICAL MIGRATION: Move Calendly meetings from wrong user to correct user
 * This fixes the multi-tenant data isolation bug in OAuth callback
 * 
 * Usage: node migrate-meetings-to-correct-user.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const WRONG_USER_ID = '87b22d98-9347-48bc-b34a-b194ca0fd55f';
const CORRECT_USER_ID = '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d';

async function runMigration() {
  try {
    console.log('🔄 Starting migration: Move Calendly meetings to correct user\n');

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Check current state
    console.log('📊 Step 1: Checking current state...\n');
    const { data: beforeMeetings, error: beforeError } = await supabase
      .rpc('get_meetings_by_user_and_source', {
        p_source: 'calendly'
      });

    if (beforeError) {
      // Fallback: just count meetings for each user
      const { data: wrongUserMeetings } = await supabase
        .from('meetings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', WRONG_USER_ID)
        .eq('meeting_source', 'calendly');

      const { data: correctUserMeetings } = await supabase
        .from('meetings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', CORRECT_USER_ID)
        .eq('meeting_source', 'calendly');

      console.log('Calendly meetings by user (BEFORE):');
      if (wrongUserMeetings && wrongUserMeetings.length > 0) {
        console.log(`  ❌ WRONG: ${WRONG_USER_ID} - ${wrongUserMeetings.length} meetings`);
      }
      if (correctUserMeetings && correctUserMeetings.length > 0) {
        console.log(`  ✅ CORRECT: ${CORRECT_USER_ID} - ${correctUserMeetings.length} meetings`);
      }
    } else {
      console.log('Calendly meetings by user (BEFORE):');
      if (beforeMeetings && beforeMeetings.length > 0) {
        beforeMeetings.forEach(row => {
          const userLabel = row.user_id === CORRECT_USER_ID ? '✅ CORRECT' : '❌ WRONG';
          console.log(`  ${userLabel}: ${row.user_id} - ${row.count} meetings`);
        });
      } else {
        console.log('  No Calendly meetings found');
      }
    }
    console.log('');

    // Step 2: Verify both users exist
    console.log('👤 Step 2: Verifying users exist...\n');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, created_at')
      .in('id', [CORRECT_USER_ID, WRONG_USER_ID]);

    if (usersError) throw usersError;

    console.log('Users in database:');
    users.forEach(user => {
      const label = user.id === CORRECT_USER_ID ? '✅ CORRECT' : '❌ WRONG (to delete)';
      console.log(`  ${label}: ${user.email} (${user.id})`);
    });
    console.log('');

    // Step 3: Count meetings to migrate
    console.log('📈 Step 3: Counting meetings to migrate...\n');
    const { count: meetingCount, error: countError } = await supabase
      .from('meetings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', WRONG_USER_ID)
      .eq('meeting_source', 'calendly');

    if (countError) throw countError;

    console.log(`Found ${meetingCount} Calendly meetings to migrate\n`);

    if (meetingCount === 0) {
      console.log('✅ No meetings to migrate - data is already clean!');
      return;
    }

    // Step 4: Migrate meetings
    console.log('🔄 Step 4: Migrating meetings...\n');
    const { error: updateError } = await supabase
      .from('meetings')
      .update({ user_id: CORRECT_USER_ID })
      .eq('user_id', WRONG_USER_ID)
      .eq('meeting_source', 'calendly');

    if (updateError) throw updateError;

    console.log(`✅ Successfully migrated ${meetingCount} meetings\n`);

    // Step 5: Verify migration
    console.log('✅ Step 5: Verifying migration...\n');
    const { count: correctCount } = await supabase
      .from('meetings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', CORRECT_USER_ID)
      .eq('meeting_source', 'calendly');

    const { count: wrongCount } = await supabase
      .from('meetings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', WRONG_USER_ID)
      .eq('meeting_source', 'calendly');

    console.log('Calendly meetings by user (AFTER):');
    console.log(`  ✅ CORRECT: ${CORRECT_USER_ID} - ${correctCount} meetings`);
    if (wrongCount > 0) {
      console.log(`  ❌ WRONG: ${WRONG_USER_ID} - ${wrongCount} meetings`);
    }
    console.log('');

    // Step 6: Check for orphaned meetings
    console.log('🔍 Step 6: Checking for orphaned meetings...\n');
    const { count: orphanedCount, error: orphanError } = await supabase
      .from('meetings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', WRONG_USER_ID);

    if (orphanError) throw orphanError;

    if (orphanedCount === 0) {
      console.log('✅ No orphaned meetings - all clean!\n');
    } else {
      console.log(`⚠️  Found ${orphanedCount} orphaned meetings\n`);
    }

    // Step 7: Delete duplicate user
    console.log('🗑️  Step 7: Deleting duplicate user...\n');
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', WRONG_USER_ID);

    if (deleteError) throw deleteError;

    console.log(`✅ Successfully deleted duplicate user: ${WRONG_USER_ID}\n`);

    // Step 8: Final verification
    console.log('🎉 Step 8: Final verification...\n');
    const { data: finalUser, error: finalError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', CORRECT_USER_ID)
      .single();

    if (finalError) throw finalError;

    const { count: finalMeetingCount } = await supabase
      .from('meetings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', CORRECT_USER_ID)
      .eq('meeting_source', 'calendly');

    console.log('✅ MIGRATION COMPLETE!\n');
    console.log('Final state:');
    console.log(`  User: ${finalUser.email} (${finalUser.id})`);
    console.log(`  Calendly meetings: ${finalMeetingCount}`);
    console.log('');
    console.log('✨ All Calendly meetings are now associated with the correct user!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();

