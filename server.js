const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Route đơn giản không cần database
app.get('/api/products', (req, res) => {
  console.log('✅ API /api/products được gọi');
  res.json([
    { id: 1, name: 'Son môi Trúc Đào', price: 150000 },
    { id: 2, name: 'Kem dưỡng da', price: 250000 },
    { id: 3, name: 'Sữa rửa mặt', price: 120000 }
  ]);
});

app.get('/api/test', (req, res) => {
  res.json({ message: '✅ Server đang hoạt động!' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy trên http://localhost:${PORT}`);
});
