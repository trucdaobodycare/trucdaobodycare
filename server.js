const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:3002'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.')); // Serve static files from current directory

// Kết nối MongoDB
const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'trucdao-cosmetics';
let db;

MongoClient.connect(mongoUrl, { 
  useUnifiedTopology: true,
  useNewUrlParser: true 
})
  .then(client => {
    console.log('✅ Kết nối MongoDB thành công');
    db = client.db(dbName);
    
    // Khởi tạo dữ liệu mẫu nếu cần
    initializeSampleData();
  })
  .catch(error => {
    console.error('❌ Lỗi kết nối MongoDB:', error);
  });

// Hàm khởi tạo dữ liệu mẫu
async function initializeSampleData() {
  try {
    // Kiểm tra xem đã có sản phẩm chưa
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
    
    // Khởi tạo cài đặt mặc định
    const settingsCount = await db.collection('settings').countDocuments();
    if (settingsCount === 0) {
      const defaultSettings = [
        { key: 'siteTitle', value: 'Trúc Đào Cosmetics' },
        { key: 'adminEmail', value: 'admin@trucdaocosmetics.vn' },
        { key: 'maintenanceMode', value: 'false' },
        { key: 'totalVisits', value: 0 }
      ];
      
      await db.collection('settings').insertMany(defaultSettings);
      console.log('✅ Đã khởi tạo cài đặt mặc định');
    }
  } catch (error) {
    console.error('❌ Lỗi khởi tạo dữ liệu mẫu:', error);
  }
}

// Routes API sản phẩm
app.get('/api/products', async (req, res) => {
  try {
    const products = await db.collection('products').find().toArray();
    console.log(`📦 Lấy ${products.length} sản phẩm từ database`);
    
    // Format lại ID để frontend có thể sử dụng
    const formattedProducts = products.map(product => ({
      ...product,
      id: product._id.toString() // Thêm trường id tương thích với frontend
    }));
    
    res.json(formattedProducts);
  } catch (error) {
    console.error('Lỗi lấy sản phẩm:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy sản phẩm' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    let product;
    
    // Kiểm tra xem id có phải là ObjectId hợp lệ không
    if (ObjectId.isValid(req.params.id)) {
      product = await db.collection('products').findOne({ _id: new ObjectId(req.params.id) });
    } else {
      // Nếu không phải ObjectId, tìm theo id số (cho tương thích với dữ liệu cũ)
      product = await db.collection('products').findOne({ id: parseInt(req.params.id) });
    }
    
    if (!product) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
    }
    
    // Thêm trường id cho tương thích
    product.id = product._id.toString();
    
    res.json(product);
  } catch (error) {
    console.error('Lỗi lấy sản phẩm chi tiết:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy sản phẩm' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const productData = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Đảm bảo giá trị số
    productData.originalPrice = parseInt(productData.originalPrice);
    productData.salePrice = parseInt(productData.salePrice);
    
    const result = await db.collection('products').insertOne(productData);
    console.log('✅ Thêm sản phẩm mới:', productData.name);
    
    const newProduct = {
      _id: result.insertedId,
      ...productData,
      id: result.insertedId.toString() // Thêm id cho frontend
    };
    
    res.status(201).json({ 
      message: 'Thêm sản phẩm thành công', 
      productId: result.insertedId,
      product: newProduct
    });
  } catch (error) {
    console.error('Lỗi thêm sản phẩm:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Sản phẩm đã tồn tại' });
    }
    
    res.status(500).json({ error: 'Lỗi server khi thêm sản phẩm' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    
    // Đảm bảo giá trị số
    if (updateData.originalPrice) updateData.originalPrice = parseInt(updateData.originalPrice);
    if (updateData.salePrice) updateData.salePrice = parseInt(updateData.salePrice);
    
    let result;
    
    // Xử lý cả ID dạng ObjectId và ID số
    if (ObjectId.isValid(req.params.id)) {
      result = await db.collection('products').updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: updateData }
      );
    } else {
      result = await db.collection('products').updateOne(
        { id: parseInt(req.params.id) },
        { $set: updateData }
      );
    }
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
    }
    
    console.log('✅ Cập nhật sản phẩm:', req.params.id);
    res.json({ message: 'Cập nhật sản phẩm thành công', productId: req.params.id });
  } catch (error) {
    console.error('Lỗi cập nhật sản phẩm:', error);
    res.status(500).json({ error: 'Lỗi server khi cập nhật sản phẩm' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    let result;
    
    // Xử lý cả ID dạng ObjectId và ID số
    if (ObjectId.isValid(req.params.id)) {
      result = await db.collection('products').deleteOne({ 
        _id: new ObjectId(req.params.id) 
      });
    } else {
      result = await db.collection('products').deleteOne({ 
        id: parseInt(req.params.id) 
      });
    }
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
    }
    
    console.log('✅ Xóa sản phẩm:', req.params.id);
    res.json({ message: 'Xóa sản phẩm thành công' });
  } catch (error) {
    console.error('Lỗi xóa sản phẩm:', error);
    res.status(500).json({ error: 'Lỗi server khi xóa sản phẩm' });
  }
});

// API Messages
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await db.collection('messages').find().sort({ timestamp: -1 }).toArray();
    
    // Format lại ID để frontend có thể sử dụng
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

app.put('/api/messages/:id/read', async (req, res) => {
  try {
    const result = await db.collection('messages').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { read: true } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy tin nhắn' });
    }
    
    res.json({ message: 'Đã đánh dấu đã đọc' });
  } catch (error) {
    console.error('Lỗi cập nhật tin nhắn:', error);
    res.status(500).json({ error: 'Lỗi server khi cập nhật tin nhắn' });
  }
});

// API để trả lời tin nhắn
app.post('/api/messages/:id/reply', async (req, res) => {
  try {
    const { replyText } = req.body;
    
    if (!replyText) {
      return res.status(400).json({ error: 'Nội dung phản hồi không được để trống' });
    }
    
    const messageData = {
      text: `[Phản hồi từ Admin]: ${replyText}`,
      timestamp: new Date(),
      read: false,
      isAdminReply: true,
      originalMessageId: req.params.id
    };
    
    const result = await db.collection('messages').insertOne(messageData);
    
    res.status(201).json({ 
      message: 'Phản hồi đã được gửi', 
      messageId: result.insertedId
    });
  } catch (error) {
    console.error('Lỗi gửi phản hồi:', error);
    res.status(500).json({ error: 'Lỗi server khi gửi phản hồi' });
  }
});

// API Settings
app.get('/api/settings', async (req, res) => {
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

app.post('/api/settings', async (req, res) => {
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
    res.json({ message: 'Cài đặt đã được lưu' });
  } catch (error) {
    console.error('Lỗi lưu cài đặt:', error);
    res.status(500).json({ error: 'Lỗi server khi lưu cài đặt' });
  }
});

// API Analytics
app.post('/api/analytics/visit', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    await db.collection('analytics').updateOne(
      { date: today },
      { $inc: { visits: 1 } },
      { upsert: true }
    );
    
    // Update total visits
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

// API Orders (cho tính năng thanh toán)
app.post('/api/orders', async (req, res) => {
  try {
    const orderData = {
      ...req.body,
      orderDate: new Date(),
      status: 'pending'
    };
    
    const result = await db.collection('orders').insertOne(orderData);
    
    res.status(201).json({ 
      message: 'Đơn hàng đã được tạo', 
      orderId: result.insertedId
    });
  } catch (error) {
    console.error('Lỗi tạo đơn hàng:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo đơn hàng' });
  }
});

// Route cho trang chủ
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

// Xử lý lỗi server
app.use((error, req, res, next) => {
  console.error('Lỗi server:', error);
  res.status(500).json({ error: 'Lỗi server nội bộ' });
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy trên http://localhost:${PORT}`);
  console.log(`📦 API Products: http://localhost:${PORT}/api/products`);
  console.log(`💬 API Messages: http://localhost:${PORT}/api/messages`);
  console.log(`⚙️ API Settings: http://localhost:${PORT}/api/settings`);
  console.log(`🛒 API Orders: http://localhost:${PORT}/api/orders`);
});

module.exports = app;
