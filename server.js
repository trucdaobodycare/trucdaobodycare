const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - ĐẶT CORS ĐẦU TIÊN
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (nếu có frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Biến kết nối MongoDB
let db;
let mongoClient;

// Kết nối MongoDB - SỬA LẠI PHẦN NÀY
async function connectDB() {
  try {
    const mongoUrl = 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl, {
      useUnifiedTopology: true,
      useNewUrlParser: true
    });
    
    await mongoClient.connect();
    db = mongoClient.db('trucdao-cosmetics');
    console.log('✅ Kết nối MongoDB thành công');
  } catch (error) {
    console.error('❌ Lỗi kết nối MongoDB:', error);
  }
}

// Routes API sản phẩm - ĐẢM BẢO CÓ DẤU / Ở ĐẦU
app.get('/api/products', async (req, res) => {
  try {
    console.log('📦 API /api/products được gọi');
    
    if (!db) {
      return res.status(500).json({ error: 'Database chưa kết nối' });
    }
    
    const products = await db.collection('products').find().toArray();
    console.log(`✅ Trả về ${products.length} sản phẩm`);
    res.json(products);
  } catch (error) {
    console.error('❌ Lỗi lấy sản phẩm:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy sản phẩm: ' + error.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database chưa kết nối' });
    }
    
    const product = await db.collection('products').findOne({ 
      _id: new ObjectId(req.params.id) 
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Lỗi lấy sản phẩm chi tiết:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy sản phẩm' });
  }
});

// Route test đơn giản (tạm thời)
app.get('/api/test', (req, res) => {
  res.json({ 
    message: '✅ API đang hoạt động!',
    timestamp: new Date().toISOString()
  });
});

// Route mặc định
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Trúc Đào Cosmetics Server',
    endpoints: {
      products: '/api/products',
      test: '/api/test'
    }
  });
});

// Khởi động server
async function startServer() {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy trên http://localhost:${PORT}`);
    console.log(`📊 API Products: http://localhost:${PORT}/api/products`);
    console.log(`🧪 API Test: http://localhost:${PORT}/api/test`);
  });
}

startServer().catch(console.error);

module.exports = app;
