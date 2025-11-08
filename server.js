const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Atlas Connection
const MONGODB_URI = 'mongodb+srv://trucdao_admin:Thanhduy%4079@trucdao-cluster.gwrb3bd.mongodb.net/trucdaocosmetics?retryWrites=true&w=majority&appName=trucdao-cluster';

const client = new MongoClient(MONGODB_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let db;

async function connectDB() {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        db = client.db('trucdaocosmetics');
        console.log('✅ Đã kết nối MongoDB Atlas thành công!');
        
        // Tạo collections nếu chưa tồn tại
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        if (!collectionNames.includes('products')) {
            await db.createCollection('products');
            console.log('📁 Đã tạo collection products');
            
            // Thêm dữ liệu mẫu
            const sampleProducts = [
                {
                    name: "Son lì cao cấp Luxury Matte",
                    category: "Son môi",
                    originalPrice: 399000,
                    salePrice: 299000,
                    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
                    description: "Son lì cao cấp với công thức mềm mịn, lâu trôi",
                    createdAt: new Date()
                },
                {
                    name: "Bảng phấn mắt 12 màu Pro Palette",
                    category: "Trang điểm mắt",
                    originalPrice: 600000,
                    salePrice: 450000,
                    image: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
                    description: "Bảng phấn mắt đa dạng màu sắc, dễ phối màu",
                    createdAt: new Date()
                }
            ];
            
            await db.collection('products').insertMany(sampleProducts);
            console.log('📦 Đã thêm sản phẩm mẫu');
        }
        
        if (!collectionNames.includes('orders')) {
            await db.createCollection('orders');
            console.log('📁 Đã tạo collection orders');
        }
        
        if (!collectionNames.includes('messages')) {
            await db.createCollection('messages');
            console.log('📁 Đã tạo collection messages');
        }
        
        return db;
    } catch (error) {
        console.error('❌ Lỗi kết nối MongoDB:', error);
        process.exit(1);
    }
}

// API Routes

// Lấy tất cả sản phẩm
app.get('/api/products', async (req, res) => {
    try {
        const products = await db.collection('products').find().sort({ createdAt: -1 }).toArray();
        res.json(products);
    } catch (error) {
        console.error('Lỗi API /api/products:', error);
        res.status(500).json({ error: 'Lỗi khi tải sản phẩm' });
    }
});

// Thêm sản phẩm mới
app.post('/api/products', async (req, res) => {
    try {
        const product = {
            ...req.body,
            createdAt: new Date()
        };
        const result = await db.collection('products').insertOne(product);
        const savedProduct = { ...product, _id: result.insertedId };
        res.status(201).json(savedProduct);
    } catch (error) {
        console.error('Lỗi API /api/products POST:', error);
        res.status(400).json({ error: 'Lỗi khi thêm sản phẩm' });
    }
});

// Cập nhật sản phẩm
app.put('/api/products/:id', async (req, res) => {
    try {
        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { ...req.body, updatedAt: new Date() } }
        );
        res.json({ message: 'Đã cập nhật sản phẩm', modifiedCount: result.modifiedCount });
    } catch (error) {
        console.error('Lỗi API /api/products PUT:', error);
        res.status(400).json({ error: 'Lỗi khi cập nhật sản phẩm' });
    }
});

// Xóa sản phẩm
app.delete('/api/products/:id', async (req, res) => {
    try {
        const result = await db.collection('products').deleteOne(
            { _id: new ObjectId(req.params.id) }
        );
        res.json({ message: 'Đã xóa sản phẩm', deletedCount: result.deletedCount });
    } catch (error) {
        console.error('Lỗi API /api/products DELETE:', error);
        res.status(400).json({ error: 'Lỗi khi xóa sản phẩm' });
    }
});

// Lưu đơn hàng
app.post('/api/orders', async (req, res) => {
    try {
        const order = {
            ...req.body,
            status: 'pending',
            createdAt: new Date()
        };
        const result = await db.collection('orders').insertOne(order);
        const savedOrder = { ...order, _id: result.insertedId };
        res.status(201).json(savedOrder);
    } catch (error) {
        console.error('Lỗi API /api/orders:', error);
        res.status(400).json({ error: 'Lỗi khi lưu đơn hàng' });
    }
});

// Lưu tin nhắn
app.post('/api/messages', async (req, res) => {
    try {
        const message = {
            ...req.body,
            read: false,
            createdAt: new Date()
        };
        const result = await db.collection('messages').insertOne(message);
        const savedMessage = { ...message, _id: result.insertedId };
        res.status(201).json(savedMessage);
    } catch (error) {
        console.error('Lỗi API /api/messages:', error);
        res.status(400).json({ error: 'Lỗi khi lưu tin nhắn' });
    }
});

// Lấy tất cả tin nhắn
app.get('/api/messages', async (req, res) => {
    try {
        const messages = await db.collection('messages').find().sort({ createdAt: -1 }).toArray();
        res.json(messages);
    } catch (error) {
        console.error('Lỗi API /api/messages:', error);
        res.status(500).json({ error: 'Lỗi khi tải tin nhắn' });
    }
});

// Đánh dấu tin nhắn đã đọc
app.put('/api/messages/:id/read', async (req, res) => {
    try {
        const result = await db.collection('messages').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { read: true, readAt: new Date() } }
        );
        res.json({ message: 'Đã đánh dấu đã đọc', modifiedCount: result.modifiedCount });
    } catch (error) {
        console.error('Lỗi API /api/messages/read:', error);
        res.status(400).json({ error: 'Lỗi khi cập nhật tin nhắn' });
    }
});

// Test API
app.get('/api/test', async (req, res) => {
    try {
        const products = await db.collection('products').find().toArray();
        res.json({ 
            message: 'Server đang chạy!', 
            database: 'Đã kết nối',
            productsCount: products.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi database' });
    }
});

// Serve HTML file for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Khởi động server
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log('='.repeat(50));
        console.log('🚀 TRÚC ĐÀO COSMETICS SERVER');
        console.log('='.repeat(50));
        console.log(`🌐 URL: http://localhost:${PORT}`);
        console.log(`📊 Database: ${db.databaseName}`);
        console.log(`🛒 API Test: http://localhost:${PORT}/api/test`);
        console.log('='.repeat(50));
        console.log('✅ Server đã sẵn sàng!');
    });
});

// Xử lý lỗi toàn cục
process.on('unhandledRejection', (err) => {
    console.error('❌ Lỗi không xử lý được:', err);
    process.exit(1);
});
