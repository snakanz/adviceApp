const express = require('express');
const app = express();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Test server is running' });
});

app.get('/', (req, res) => {
  res.json({ message: 'Test server root' });
});

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`Test server running on port ${port}`);
});
