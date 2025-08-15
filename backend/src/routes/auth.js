const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const { supabase, isSupabaseAvailable, getSupabase } = require('../lib/supabase');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Get Google OAuth URL
router.get('/google/url', (req, res) => {
  const scopes = [
        'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

    res.json({ url });
});

// Handle Google OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;

    // Check if Supabase is available
    if (!isSupabaseAvailable()) {
      return res.status(503).json({
        error: 'Database service unavailable. Please contact support.'
      });
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // Find or create user
    const { data: existingUser } = await getSupabase()
      .from('users')
      .select('*')
      .eq('email', userInfo.data.email)
      .single();

    let user;
    if (!existingUser) {
      // Create new user
      const { data: newUser } = await getSupabase()
        .from('users')
        .insert({
          email: userInfo.data.email,
          name: userInfo.data.name,
          provider: 'google',
          providerid: userInfo.data.id,
          googleaccesstoken: tokens.access_token,
          googlerefreshtoken: tokens.refresh_token,
          profilepicture: userInfo.data.picture
        })
        .select()
        .single();
      user = newUser;
    } else {
      // Update existing user's tokens
      const { data: updatedUser } = await getSupabase()
        .from('users')
        .update({
          googleaccesstoken: tokens.access_token,
          googlerefreshtoken: tokens.refresh_token || existingUser.googlerefreshtoken,
          profilepicture: userInfo.data.picture,
          name: userInfo.data.name
        })
        .eq('email', userInfo.data.email)
        .select()
        .single();
      user = updatedUser;
    }

        // Generate JWT
        const jwtToken = jwt.sign(
            { 
                id: user.id,
                email: user.email
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Redirect to frontend with token
        res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${jwtToken}`);
    } catch (error) {
        console.error('Google auth error:', error);
        res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }
});

// Verify token and return user info
router.get('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // Check if Supabase is available
        if (!isSupabaseAvailable()) {
            return res.status(503).json({
                error: 'Database service unavailable. Please contact support.'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { data: user } = await getSupabase()
            .from('users')
            .select('id, email, name, profilepicture')
            .eq('id', decoded.id)
            .single();

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

module.exports = router; 