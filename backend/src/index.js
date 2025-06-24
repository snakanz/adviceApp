require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const authRoutes = require('./routes/auth');

// Debug logging for environment variables
console.log('Environment variables loaded:', {
  hasOpenAIKey: !!process.env.OPENAI_API_KEY,
  hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
  hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
  hasGoogleRedirectUri: !!process.env.GOOGLE_REDIRECT_URI,
  hasDatabaseUrl: !!process.env.DATABASE_URL
});

console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET);
console.log('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('AdvisorAgent Backend API is running');
});

app.use('/api', routes);
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

module.exports = app;
