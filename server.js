// Server.js - Fixed version for Render.com
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

// Serve static files từ thư mục hiện tại
app.use(express.static(__dirname));

// Biến toàn cục cho database
let db = null;
let isDatabaseConnected = false;

// Hàm kết nối database với retry logic
async function connectDatabase() {
  try {
    console.log('🔄 Đang kết nối đến MongoDB...');
    
    // Sử dụng MongoDB URI từ environment variable hoặc local fallback
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.DB_NAME || 'trucdao-cosmetics';
    
    console.log('📊 Database URL:', mongoUrl.includes('@') ? '***[hidden]***' : mongoUrl);
    
    const client = new MongoClient(mongoUrl);
    await client.connect();
    
    db = client.db(dbName);
    isDatabaseConnected = true;
    
    console.log('✅ Kết nối MongoDB thành công');
    
    // Khởi tạo dữ liệu mẫu
    await initializeSampleData();
    
    return db;
  } catch (error) {
    console.error('❌ Lỗi kết nối MongoDB:', error.message);
    isDatabaseConnected = false;
    
    // Retry sau 5 giây
    setTimeout(connectDatabase, 5000);
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
      
      const sampleProducts = [
        {
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
          name: "Bảng phấn mắt 12 màu Pro Palette",
          category: "Trang điểm mắt",
          originalPrice: 600000,
          salePrice: 450000,
          image: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
          description: "Bảng phấn mắt đa dạng màu sắc, dễ phối màu",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: "Kem nền che khuyết điểm Full Cover",
          category: "Trang điểm mặt",
          originalPrice: 650000,
          salePrice: 520000,
          image: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
          description: "Kem nền che phủ hoàn hảo, không gây bít tắc lỗ chân lông",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: "Serum dưỡng ẩm chống lão hóa",
          category: "Chăm sóc da",
          originalPrice: 850000,
          salePrice: 680000,
          image: "https://images.unsplash.com/photo-1594035910387-fea47794261f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
          description: "Serum dưỡng ẩm chuyên sâu, cải thiện nếp nhăn",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      await db.collection('products').insertMany(sampleProducts);
      console.log('✅ Đã thêm dữ liệu sản phẩm mẫu');
    }
  } catch (error) {
    console.error('❌ Lỗi khởi tạo dữ liệu:', error.message);
  }
}

// Middleware kiểm tra database connection
function checkDatabase(req, res, next) {
  if (!isDatabaseConnected) {
    return res.status(503).json({ 
      error: 'Database đang tạm thời gián đoạn. Vui lòng thử lại sau.' 
    });
  }
  next();
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: isDatabaseConnected ? 'Connected' : 'Disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes với database check
app.get('/api/products', checkDatabase, async (req, res) => {
  try {
    const products = await db.collection('products').find().toArray();
    
    const formattedProducts = products.map(product => ({
      ...product,
      id: product._id.toString()
    }));
    
    console.log(`📦 Lấy ${products.length} sản phẩm từ database`);
    res.json(formattedProducts);
  } catch (error) {
    console.error('Lỗi lấy sản phẩm:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy sản phẩm' });
  }
});

app.get('/api/products/:id', checkDatabase, async (req, res) => {
  try {
    let product;
    
    if (ObjectId.isValid(req.params.id)) {
      product = await db.collection('products').findOne({ _id: new ObjectId(req.params.id) });
    } else {
      product = await db.collection('products').findOne({ id: parseInt(req.params.id) });
    }
    
    if (!product) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
    }
    
    product.id = product._id.toString();
    res.json(product);
  } catch (error) {
    console.error('Lỗi lấy sản phẩm chi tiết:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy sản phẩm' });
  }
});

app.post('/api/products', checkDatabase, async (req, res) => {
  try {
    const productData = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    productData.originalPrice = parseInt(productData.originalPrice);
    productData.salePrice = parseInt(productData.salePrice);
    
    const result = await db.collection('products').insertOne(productData);
    console.log('✅ Thêm sản phẩm mới:', productData.name);
    
    const newProduct = {
      _id: result.insertedId,
      ...productData,
      id: result.insertedId.toString()
    };
    
    res.status(201).json({ 
      message: 'Thêm sản phẩm thành công', 
      productId: result.insertedId,
      product: newProduct
    });
  } catch (error) {
    console.error('Lỗi thêm sản phẩm:', error);
    res.status(500).json({ error: 'Lỗi server khi thêm sản phẩm' });
  }
});

// API Messages
app.get('/api/messages', checkDatabase, async (req, res) => {
  try {
    const messages = await db.collection('messages').find().sort({ timestamp: -1 }).toArray();
    
    const formattedMessages = messages.map(message => ({
      ...message,
      id: message._id.toString()
    }));
    
    res.json(formattedMessages);
  } catch (error) {
    console.error('Lỗi lấy tin nhắn:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy tin nhắn' });
  }
});

app.post('/api/messages', checkDatabase, async (req, res) => {
  try {
    const messageData = {
      ...req.body,
      timestamp: new Date(),
      read: false
    };
    
    const result = await db.collection('messages').insertOne(messageData);
    
    const newMessage = {
      _id: result.insertedId,
      ...messageData,
      id: result.insertedId.toString()
    };
    
    console.log('💬 Tin nhắn mới từ:', messageData.name || 'Ẩn danh');
    
    res.status(201).json({ 
      message: 'Tin nhắn đã được lưu', 
      messageId: result.insertedId,
      message: newMessage
    });
  } catch (error) {
    console.error('Lỗi lưu tin nhắn:', error);
    res.status(500).json({ error: 'Lỗi server khi lưu tin nhắn' });
  }
});

// API Settings
app.get('/api/settings', checkDatabase, async (req, res) => {
  try {
    const settings = await db.collection('settings').find().toArray();
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    res.json(settingsObj);
  } catch (error) {
    console.error('Lỗi lấy cài đặt:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy cài đặt' });
  }
});

app.post('/api/settings', checkDatabase, async (req, res) => {
  try {
    const settings = req.body;
    const operations = Object.keys(settings).map(key => ({
      updateOne: {
        filter: { key: key },
        update: { $set: { value: settings[key] } },
        upsert: true
      }
    }));
    
    await db.collection('settings').bulkWrite(operations);
    console.log('⚙️ Cài đặt đã được cập nhật');
    res.json({ message: 'Cài đặt đã được lưu' });
  } catch (error) {
    console.error('Lỗi lưu cài đặt:', error);
    res.status(500).json({ error: 'Lỗi server khi lưu cài đặt' });
  }
});

// Route cho trang chủ - với fallback nếu file không tồn tại
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  
  // Kiểm tra file có tồn tại không
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Fallback: trả về HTML cơ bản nếu file không tồn tại
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Trúc Đào Cosmetics</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #e83e8c; }
          .status { background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>Trúc Đào Cosmetics</h1>
        <div class="status">
          <h2>🚀 Ứng dụng đang chạy</h2>
          <p>Backend API đã sẵn sàng!</p>
          <p>Database: ${isDatabaseConnected ? '✅ Đã kết nối' : '❌ Đang kết nối...'}</p>
        </div>
        <div>
          <h3>📋 Các API có sẵn:</h3>
          <ul style="list-style: none; padding: 0;">
            <li><a href="/api/products">/api/products</a> - Danh sách sản phẩm</li>
            <li><a href="/api/messages">/api/messages</a> - Tin nhắn</li>
            <li><a href="/api/settings">/api/settings</a> - Cài đặt</li>
            <li><a href="/health">/health</a> - Health Check</li>
          </ul>
        </div>
      </body>
      </html>
    `);
  }
});

// Route mặc định cho frontend
app.get('*', (req, res) => {
  const requestedPath = path.join(__dirname, req.path);
  
  // Kiểm tra file có tồn tại không
  if (fs.existsSync(requestedPath)) {
    res.sendFile(requestedPath);
  } else {
    // Fallback về trang chủ cho SPA routing
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: 'Endpoint không tồn tại' });
    }
  }
});

// Khởi động server và kết nối database
async function startServer() {
  try {
    // Kết nối database
    await connectDatabase();
    
    // Khởi động server
    app.listen(PORT, () => {
      console.log(`🚀 Server đang chạy trên http://localhost:${PORT}`);
      console.log(`🌐 Public URL: https://trucdaobodycare.onrender.com`);
      console.log(`📦 API Products: https://trucdaobodycare.onrender.com/api/products`);
      console.log(`💬 API Messages: https://trucdaobodycare.onrender.com/api/messages`);
      console.log(`⚙️ API Settings: https://trucdaobodycare.onrender.com/api/settings`);
      console.log(`❤️ Health Check: https://trucdaobodycare.onrender.com/health`);
      console.log(`📊 Database Status: ${isDatabaseConnected ? '✅ Connected' : '❌ Disconnected'}`);
    });
  } catch (error) {
    console.error('❌ Không thể khởi động server:', error);
    process.exit(1);
  }
}

// Xử lý shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Nhận tín hiệu SIGINT, đóng ứng dụng...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Nhận tín hiệu SIGTERM, đóng ứng dụng...');
  process.exit(0);
});

// Bắt đầu server
startServer();

module.exports = app;
