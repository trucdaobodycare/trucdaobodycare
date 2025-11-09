const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// simple products API reading from data/products.json
app.get('/api/products', (req, res) => {
  const file = path.join(__dirname, 'data', 'products.json');
  fs.readFile(file, 'utf8', (err, data) => {
    if(err) {
      console.error('Failed to read products.json', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    try {
      const arr = JSON.parse(data);
      return res.json(arr);
    } catch(e) {
      console.error('Invalid JSON in products.json', e);
      return res.status(500).json({ message: 'Invalid products data' });
    }
  });
});

// simple login - admin/admin
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if(username === 'admin' && password === 'admin') {
    return res.json({ token: 'REALISTIC-FAKE-TOKEN', role: 'admin' });
  }
  return res.status(401).json({ message: 'Unauthorized' });
});

// fallback to serve index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
