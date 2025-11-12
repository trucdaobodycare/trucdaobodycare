require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001', 'https://trucdaobodycare.onrender.com'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname)); // Serve static files from current directory

// Kết nối MongoDB với URI từ environment variable
const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'trucdao-cosmetics';
let db;

console.log('🔄 Đang kết nối đến MongoDB...');
console.log('📊 MongoDB URI:', mongoUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')); // Ẩn thông tin nhạy cảm

MongoClient.connect(mongoUrl)
  .then(client => {
    console.log('✅ Kết nối MongoDB thành công');
    db = client.db(dbName);
    
    // Khởi tạo dữ liệu mẫu
    initializeSampleData();
  })
  .catch(error => {
    console.error('❌ Lỗi kết nối MongoDB:', error.message);
    console.log('💡 Lưu ý: Ứng dụng vẫn chạy nhưng không có kết nối database');
  });

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
        }
      ];
      
      await db.collection('products').insertMany(sampleProducts);
      console.log('✅ Đã thêm dữ liệu sản phẩm mẫu');
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
    database: db ? 'Connected' : 'Disconnected'
  });
});

// Routes API sản phẩm
app.get('/api/products', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database chưa kết nối' });
    }
    
    const products = await db.collection('products').find().toArray();
    console.log(`📦 Lấy ${products.length} sản phẩm từ database`);
    
    const formattedProducts = products.map(product => ({
      ...product,
      id: product._id.toString()
    }));
    
    res.json(formattedProducts);
  } catch (error) {
    console.error('Lỗi lấy sản phẩm:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy sản phẩm' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database chưa kết nối' });
    }
    
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

app.post('/api/products', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database chưa kết nối' });
    }
    
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
app.get('/api/messages', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database chưa kết nối' });
    }
    
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

app.post('/api/messages', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database chưa kết nối' });
    }
    
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
app.get('/api/settings', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database chưa kết nối' });
    }
    
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

app.post('/api/settings', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database chưa kết nối' });
    }
    
    const settings = req.body;
    const operations = Object.keys(settings).map(key => ({
      updateOne: {
        filter: { key: key },
        update: { $set: { value: settings[key] } },
        upsert: true
      }
    }));
    
    await db.collection('settings').bulkWrite(operations);
    res.json({ message: 'Cài đặt đã được lưu' });
  } catch (error) {
    console.error('Lỗi lưu cài đặt:', error);
    res.status(500).json({ error: 'Lỗi server khi lưu cài đặt' });
  }
});

// API Analytics
app.post('/api/analytics/visit', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database chưa kết nối' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    await db.collection('analytics').updateOne(
      { date: today },
      { $inc: { visits: 1 } },
      { upsert: true }
    );
    
    await db.collection('settings').updateOne(
      { key: 'totalVisits' },
      { $inc: { value: 1 } },
      { upsert: true }
    );
    
    res.json({ message: 'Visit recorded' });
  } catch (error) {
    console.error('Lỗi ghi visit:', error);
    res.status(500).json({ error: 'Lỗi server khi ghi visit' });
  }
});

// Route cho trang chủ - sửa đường dẫn chính xác
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Route mặc định cho frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Xử lý lỗi 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint không tồn tại' });
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy trên http://localhost:${PORT}`);
  console.log(`🌐 Public URL: https://trucdaobodycare.onrender.com`);
  console.log(`📦 API Products: https://trucdaobodycare.onrender.com/api/products`);
  console.log(`💬 API Messages: https://trucdaobodycare.onrender.com/api/messages`);
  console.log(`⚙️ API Settings: https://trucdaobodycare.onrender.com/api/settings`);
  console.log(`❤️ Health Check: https://trucdaobodycare.onrender.com/health`);
});

module.exports = app;
