// Server.js - Updated with new password
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
    description: "Son lì cao cấp với công thức mềm mịn, lâu trôi"
  },
  {
    id: "2",
    name: "Bảng phấn mắt 12 màu Pro Palette",
    category: "Trang điểm mắt", 
    originalPrice: 600000,
    salePrice: 450000,
    image: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
    description: "Bảng phấn mắt đa dạng màu sắc, dễ phối màu"
  },
  {
    id: "3",
    name: "Kem nền che khuyết điểm Full Cover",
    category: "Trang điểm mặt",
    originalPrice: 650000,
    salePrice: 520000,
    image: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
    description: "Kem nền che phủ hoàn hảo, không gây bít tắc lỗ chân lông"
  }
];

// Biến toàn cục
let db = null;
let isDatabaseConnected = false;

// Hàm kết nối database
async function connectDatabase() {
  try {
    console.log('🔄 Đang kết nối đến MongoDB Atlas...');
    
    // Sử dụng connection string từ environment variable
    const mongoUrl = process.env.MONGODB_URI;
    
    if (!mongoUrl) {
      console.log('⚠️ MONGODB_URI không được set');
      isDatabaseConnected = false;
      return null;
    }
    
    // Log connection string (ẩn password)
    const safeLogUrl = mongoUrl.replace(/(mongodb\+srv:\/\/[^:]+:)([^@]+)(@.*)/, '$1***$3');
    console.log('📊 Connection string:', safeLogUrl);
    
    // Validate connection string format
    if (!mongoUrl.startsWith('mongodb+srv://')) {
      console.error('❌ Lỗi: Connection string phải bắt đầu với mongodb+srv://');
      isDatabaseConnected = false;
      return null;
    }
    
    const client = new MongoClient(mongoUrl, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    await client.connect();
    
    const dbName = 'trucdao-cosmetics';
    db = client.db(dbName);
    isDatabaseConnected = true;
    
    console.log('✅ Kết nối MongoDB thành công!');
    console.log('🗄️ Database:', dbName);
    
    // Test connection
    await db.command({ ping: 1 });
    console.log('🎯 Ping MongoDB thành công');
    
    // Khởi tạo dữ liệu mẫu
    await initializeSampleData();
    
    return db;
    
  } catch (error) {
    console.error('❌ Lỗi kết nối MongoDB:', error.message);
    isDatabaseConnected = false;
    
    // Retry sau 10 giây
    console.log('🔄 Thử kết nối lại sau 10 giây...');
    setTimeout(connectDatabase, 10000);
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
  const mongoUrl = process.env.MONGODB_URI;
  const hasMongoUrl = !!mongoUrl;
  const isMongoUrlValid = hasMongoUrl && mongoUrl.startsWith('mongodb+srv://');
  
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: {
      connected: isDatabaseConnected,
      hasConnectionString: hasMongoUrl,
      connectionStringValid: isMongoUrlValid,
      status: isDatabaseConnected ? 'Connected to MongoDB Atlas' : 'Disconnected - Using Fallback Data'
    },
    service: 'Trúc Đào Cosmetics API',
    version: '1.0.0'
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
      
      console.log(`📦 Lấy ${products.length} sản phẩm từ MongoDB Atlas`);
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

// Các API khác...
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
      
      res.status(201).json({ 
        message: 'Tin nhắn đã được lưu', 
        messageId: result.insertedId
      });
    } else {
      res.status(201).json({ 
        message: 'Tin nhắn đã được ghi nhận', 
        messageId: 'temp-' + Date.now()
      });
    }
  } catch (error) {
    console.error('Lỗi lưu tin nhắn:', error);
    res.status(500).json({ error: 'Lỗi server khi lưu tin nhắn' });
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
            Database: ${isDatabaseConnected ? '✅ Đã kết nối MongoDB Atlas' : '🔄 Đang kết nối...'}
          </p>
        </div>
        <div>
          <h3>📋 Các API có sẵn:</h3>
          <ul style="list-style: none; padding: 0;">
            <li><a href="/api/products">/api/products</a> - Danh sách sản phẩm</li>
            <li><a href="/health">/health</a> - Health Check</li>
            <li><a href="/api/messages">/api/messages</a> - Tin nhắn</li>
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
  // Kết nối database
  connectDatabase();
  
  app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy trên http://localhost:${PORT}`);
    console.log(`🌐 Public URL: https://trucdaobodycare.onrender.com`);
    console.log(`📊 Database Status: ${isDatabaseConnected ? '✅ Connected' : '🔄 Connecting...'}`);
    console.log(`❤️ Health Check: https://trucdaobodycare.onrender.com/health`);
  });
}

// Xử lý shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Nhận tín hiệu SIGTERM, đóng ứng dụng...');
  process.exit(0);
});

// Bắt đầu server
startServer();

module.exports = app;
