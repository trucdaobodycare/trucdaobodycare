const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3002;  // 🎯 ĐỔI THÀNH 3002

// Middleware
app.use(cors());
app.use(express.json());

// Log tất cả requests
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  next();
});

// Route test đơn giản
app.get('/api/test', (req, res) => {
  console.log('✅ /api/test được gọi');
  res.json({ 
    message: '✅ API Test đang hoạt động!',
    timestamp: new Date().toISOString()
  });
});

// Route products đơn giản
app.get('/api/products', (req, res) => {
  console.log('✅ /api/products được gọi');
  res.json([
    { 
      id: 1, 
      name: 'Son môi Trúc Đào', 
      price: 150000,
      category: 'son'
    },
    { 
      id: 2, 
      name: 'Kem dưỡng da cao cấp', 
      price: 250000,
      category: 'kem'
    }
  ]);
});

// Route gốc
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Trúc Đào Cosmetics Server',
    endpoints: [
      'GET /api/test',
      'GET /api/products',
      'GET /'
    ]
  });
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 Server đang chạy!`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Truy cập: http://localhost:${PORT}`);
  console.log(`🧪 Test API: http://localhost:${PORT}/api/test`);
  console.log(`📦 Products: http://localhost:${PORT}/api/products`);
  console.log(`=================================`);
});