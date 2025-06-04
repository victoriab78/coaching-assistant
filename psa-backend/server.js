const express = require('express');
const app = express();
app.use(express.json());

console.log('Server starting...');

const API_KEY = process.env.API_KEY || 'pacodamyan';

// API key middleware with debug logs
app.use((req, res, next) => {
  console.log('--- New request received ---');
  console.log('Expected API_KEY:', API_KEY);
  console.log('Received x-api-key:', req.headers['x-api-key']);
  if (req.headers['x-api-key'] !== API_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Cloud Run backend!' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}`));