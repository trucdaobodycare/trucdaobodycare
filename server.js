// Server.js - Fixed MongoDB Connection
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001', 'https://trucdaobodycare.onrender.com'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Fallback data
const fallbackProducts = [
  {
    id: "1",
    name: "Son lì cao cấp Luxury Matte",
    category: "Son môi",
    originalPrice: 399000,
    salePrice: 299000,
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
    description: "Son lì cao cấp với công thức mềm mịn, lâu trôi",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "2", 
    name: "Bảng phấn mắt 12 màu Pro Palette",
    category: "Trang điểm mắt",
    originalPrice: 600000,
    salePrice: 450000,
    image: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
    description: "Bảng phấn mắt đa dạng màu sắc, dễ phối màu",
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Biến toàn cục
let db = null;
let isDatabaseConnected = false;
let mongoClient = null;

// Hàm kết nối database với connection string cố định
async function connectDatabase() {
  try {
    console.log('🔄 Đang kết nối đến MongoDB Atlas...');
    
    // Sử dụng connection string cố định với thông tin đã cung cấp
    const mongoUrl = process.env.MONGODB_URI || "mongodb+srv://Trucdaoadminlogin:Thanhduy%40222@trucdao-cluster.gwrb3bd.mongodb.net/trucdao-cosmetics?retryWrites=true&w=majority";
    
    console.log('📊 Đang kết nối đến:', 'trucdao-cluster.gwrb3bd.mongodb.net');
    
    // Tạo MongoClient với options đơn giản
    mongoClient = new MongoClient(mongoUrl, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    await mongoClient.connect();
    
    const dbName = 'trucdao-cosmetics';
    db = mongoClient.db(dbName);
    isDatabaseConnected = true;
    
    console.log('✅ Kết nối MongoDB thành công!');
    console.log('📊 Database:', dbName);
    
    // Test connection
    await db.command({ ping: 1 });
    console.log('🎯 Ping MongoDB thành công');
    
    // Khởi tạo dữ liệu mẫu
    await initializeSampleData();
    
    return db;
    
  } catch (error) {
    console.error('❌ Lỗi kết nối MongoDB:', error.message);
    isDatabaseConnected = false;
    
    // Đóng client nếu có lỗi
    if (mongoClient) {
      await mongoClient.close();
    }
    
    // Retry sau 15 giây
    console.log('🔄 Thử kết nối lại sau 15 giây...');
    setTimeout(connectDatabase, 15000);
    return null;
  }
}

// Hàm khởi tạo dữ liệu mẫu
async function initializeSampleData() {
  if (!db) return;
  
  try {
    const productCount = await db.collection('products').countDocuments();
    
    if (productCount === 0) {
      console.log('🔄 Đang khởi tạo dữ liệu mẫu...');
      await db.collection('products').insertMany(fallbackProducts);
      console.log('✅ Đã thêm dữ liệu sản phẩm mẫu');
    } else {
      console.log(`📦 Đã có ${productCount} sản phẩm trong database`);
    }
  } catch (error) {
    console.error('❌ Lỗi khởi tạo dữ liệu:', error.message);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: isDatabaseConnected ? 'Connected' : 'Disconnected - Using Fallback Data',
    environment: process.env.NODE_ENV || 'development',
    service: 'Trúc Đào Cosmetics API'
  });
});

// API Routes
app.get('/api/products', async (req, res) => {
  try {
    if (isDatabaseConnected && db) {
      const products = await db.collection('products').find().toArray();
      const formattedProducts = products.map(product => ({
        ...product,
        id: product._id.toString()
      }));
      
      console.log(`📦 Lấy ${products.length} sản phẩm từ MongoDB`);
      res.json(formattedProducts);
    } else {
      console.log('📦 Sử dụng fallback data');
      res.json(fallbackProducts);
    }
  } catch (error) {
    console.error('Lỗi lấy sản phẩm, sử dụng fallback:', error.message);
    res.json(fallbackProducts);
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    if (isDatabaseConnected && db) {
      let product;
      
      if (ObjectId.isValid(req.params.id)) {
        product = await db.collection('products').findOne({ _id: new ObjectId(req.params.id) });
      } else {
        product = await db.collection('products').findOne({ id: req.params.id });
      }
      
      if (product) {
        product.id = product._id.toString();
        res.json(product);
      } else {
        res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
      }
    } else {
      const product = fallbackProducts.find(p => p.id === req.params.id);
      if (product) {
        res.json(product);
      } else {
        res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
      }
    }
  } catch (error) {
    console.error('Lỗi lấy sản phẩm chi tiết:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy sản phẩm' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    if (isDatabaseConnected && db) {
      const productData = {
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.collection('products').insertOne(productData);
      
      const newProduct = {
        _id: result.insertedId,
        ...productData,
        id: result.insertedId.toString()
      };
      
      console.log('✅ Thêm sản phẩm mới:', productData.name);
      res.status(201).json({ 
        message: 'Thêm sản phẩm thành công', 
        productId: result.insertedId,
        product: newProduct
      });
    } else {
      res.status(503).json({ error: 'Database đang gián đoạn' });
    }
  } catch (error) {
    console.error('Lỗi thêm sản phẩm:', error);
    res.status(500).json({ error: 'Lỗi server khi thêm sản phẩm' });
  }
});

// Messages API
app.get('/api/messages', async (req, res) => {
  try {
    if (isDatabaseConnected && db) {
      const messages = await db.collection('messages').find().sort({ timestamp: -1 }).toArray();
      const formattedMessages = messages.map(message => ({
        ...message,
        id: message._id.toString()
      }));
      res.json(formattedMessages);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Lỗi lấy tin nhắn:', error);
    res.json([]);
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    if (isDatabaseConnected && db) {
      const messageData = {
        ...req.body,
        timestamp: new Date(),
        read: false
      };
      
      const result = await db.collection('messages').insertOne(messageData);
      console.log('💬 Tin nhắn mới từ:', messageData.name || 'Ẩn danh');
      
      res.status(201).json({ 
        message: 'Tin nhắn đã được lưu', 
        messageId: result.insertedId
      });
    } else {
      res.status(201).json({ 
        message: 'Tin nhắn đã được ghi nhận (Database đang gián đoạn)', 
        messageId: 'temp-' + Date.now()
      });
    }
  } catch (error) {
    console.error('Lỗi lưu tin nhắn:', error);
    res.status(500).json({ error: 'Lỗi server khi lưu tin nhắn' });
  }
});

// Settings API
app.get('/api/settings', async (req, res) => {
  try {
    if (isDatabaseConnected && db) {
      const settings = await db.collection('settings').find().toArray();
      const settingsObj = {};
      settings.forEach(setting => {
        settingsObj[setting.key] = setting.value;
      });
      res.json(settingsObj);
    } else {
      res.json({});
    }
  } catch (error) {
    console.error('Lỗi lấy cài đặt:', error);
    res.json({});
  }
});

// Route cho trang chủ
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Trúc Đào Cosmetics</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #e83e8c; }
          .status { background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
          .success { color: green; }
          .warning { color: orange; }
        </style>
      </head>
      <body>
        <h1>✨ Trúc Đào Cosmetics</h1>
        <div class="status">
          <h2>🚀 Ứng dụng đang chạy</h2>
          <p>Backend API đã sẵn sàng!</p>
          <p class="${isDatabaseConnected ? 'success' : 'warning'}">
            Database: ${isDatabaseConnected ? '✅ Đã kết nối MongoDB Atlas' : '⚠️ Đang sử dụng dữ liệu tạm'}
          </p>
        </div>
        <div>
          <h3>📋 Các API có sẵn:</h3>
          <ul style="list-style: none; padding: 0;">
            <li><a href="/api/products">/api/products</a> - Danh sách sản phẩm</li>
            <li><a href="/health">/health</a> - Health Check</li>
          </ul>
        </div>
      </body>
      </html>
    `);
  }
});

// Route mặc định cho SPA
app.get('*', (req, res) => {
  const requestedPath = path.join(__dirname, req.path);
  
  if (fs.existsSync(requestedPath)) {
    res.sendFile(requestedPath);
  } else {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: 'Endpoint không tồn tại' });
    }
  }
});

// Khởi động server
async function startServer() {
  // Kết nối database (async - không chặn server startup)
  connectDatabase();
  
  app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy trên http://localhost:${PORT}`);
    console.log(`🌐 Public URL: https://trucdaobodycare.onrender.com`);
    console.log(`📦 MongoDB Cluster: trucdao-cluster.gwrb3bd.mongodb.net`);
    console.log(`📊 Database Status: ${isDatabaseConnected ? '✅ Connected' : '🔄 Connecting...'}`);
  });
}

// Xử lý shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Nhận tín hiệu SIGTERM, đóng ứng dụng...');
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});

// Bắt đầu server
startServer();

module.exports = app;
