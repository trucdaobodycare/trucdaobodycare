const express = require('express');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

// ==================== RENDER.COM CONFIGURATION ====================
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 10000;

// MongoDB Connection String - THAY THẾ BẰNG URL CỦA BẠN
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/trucdao-cosmetics?retryWrites=true&w=majority';

console.log('🚀 Environment:', isProduction ? 'production' : 'development');
console.log('📍 Port:', PORT);

// ==================== MONGODB MODELS ====================

// Product Model
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    originalPrice: { type: Number, required: true },
    salePrice: { type: Number, required: true },
    image: { type: String, required: true },
    description: { type: String, default: '' },
    views: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

// Message Model
const messageSchema = new mongoose.Schema({
    text: { type: String, required: true },
    product: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false },
    isAutoResponse: { type: Boolean, default: false },
    isAdminReply: { type: Boolean, default: false },
    originalMessageId: { type: String, default: null },
    customerInfo: {
        name: String,
        phone: String,
        email: String
    },
    replies: [{
        text: String,
        timestamp: { type: Date, default: Date.now },
        isAdminReply: { type: Boolean, default: true },
        adminName: { type: String, default: 'Admin' }
    }]
});

const Message = mongoose.model('Message', messageSchema);

// Order Model
const orderSchema = new mongoose.Schema({
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    customerAddress: { type: String, required: true },
    products: [{
        id: String,
        name: String,
        price: Number,
        quantity: Number,
        image: String
    }],
    totalAmount: { type: Number, required: true },
    status: { type: String, default: 'pending' },
    paymentMethod: { type: String, default: 'bank_transfer' },
    paymentScreenshot: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

// Visitor Model
const visitorSchema = new mongoose.Schema({
    total: { type: Number, default: 0 },
    today: { type: Number, default: 0 },
    date: { type: String, default: new Date().toDateString() },
    history: [{
        timestamp: Date,
        ip: String,
        userAgent: String
    }]
});

const Visitor = mongoose.model('Visitor', visitorSchema);

// Settings Model
const settingsSchema = new mongoose.Schema({
    siteTitle: { type: String, default: 'Trúc Đào Cosmetics' },
    adminEmail: { type: String, default: 'admin@trucdaocosmetics.vn' },
    maintenanceMode: { type: Boolean, default: false }
});

const Settings = mongoose.model('Settings', settingsSchema);

// Statistics Model
const statisticsSchema = new mongoose.Schema({
    totalSales: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    popularProducts: [{
        name: String,
        quantity: Number,
        revenue: Number
    }]
});

const Statistics = mongoose.model('Statistics', statisticsSchema);

// ==================== DATABASE INITIALIZATION ====================

async function initializeDatabase() {
    try {
        console.log('🔄 Initializing database...');
        
        // Kiểm tra và tạo dữ liệu mặc định nếu cần
        const visitorCount = await Visitor.countDocuments();
        if (visitorCount === 0) {
            await Visitor.create({});
            console.log('✅ Default visitor record created');
        }
        
        const settingsCount = await Settings.countDocuments();
        if (settingsCount === 0) {
            await Settings.create({});
            console.log('✅ Default settings created');
        }
        
        const statisticsCount = await Statistics.countDocuments();
        if (statisticsCount === 0) {
            await Statistics.create({});
            console.log('✅ Default statistics created');
        }
        
        const productCount = await Product.countDocuments();
        if (productCount === 0) {
            await Product.insertMany([
                {
                    name: "Son lì cao cấp Luxury Matte",
                    category: "Son môi",
                    originalPrice: 399000,
                    salePrice: 299000,
                    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
                    description: "Son lì cao cấp với công thức mềm mịn, lâu trôi"
                },
                {
                    name: "Bảng phấn mắt 12 màu Pro Palette",
                    category: "Trang điểm mắt",
                    originalPrice: 600000,
                    salePrice: 450000,
                    image: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
                    description: "Bảng phấn mắt đa dạng màu sắc, dễ phối màu"
                },
                {
                    name: "Kem nền che khuyết điểm Full Cover",
                    category: "Trang điểm mặt",
                    originalPrice: 650000,
                    salePrice: 520000,
                    image: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
                    description: "Kem nền che phủ hoàn hảo, không gây bít tắc lỗ chân lông"
                },
                {
                    name: "Serum dưỡng ẩm chống lão hóa",
                    category: "Chăm sóc da",
                    originalPrice: 850000,
                    salePrice: 680000,
                    image: "https://images.unsplash.com/photo-1594035910387-fea47794261f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
                    description: "Serum dưỡng ẩm chuyên sâu, cải thiện nếp nhăn"
                }
            ]);
            console.log('✅ Default products created');
        }
        
        console.log('✅ Database initialization completed');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

// ==================== MIDDLEWARE SETUP ====================
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(compression());

// CORS configuration
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'https://trucdaobodycare.onrender.com',
            'http://localhost:10000',
            'http://localhost:3000',
            'http://127.0.0.1:10000',
            'http://127.0.0.1:3000'
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('render.com')) {
            callback(null, true);
        } else {
            console.log('🔒 Blocked by CORS:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 500 : 1000,
    message: {
        error: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút.',
        retryAfter: 900
    },
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);

// Logging
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Security headers
app.use((req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type', 'Authorization', 'X-Requested-With');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

// ==================== STATIC FILES ====================
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: isProduction ? '1d' : '0',
    etag: true,
    lastModified: true,
    index: 'index.html',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// ==================== ROUTES ====================

// Favicon
app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});

// Home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const productCount = await Product.countDocuments();
        const messageCount = await Message.countDocuments();
        const orderCount = await Order.countDocuments();
        const visitorData = await Visitor.findOne();
        
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            database: {
                status: 'connected',
                products: productCount,
                messages: messageCount,
                orders: orderCount,
                visitors: visitorData?.total || 0
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            error: error.message
        });
    }
});

// ==================== API ROUTES ====================

// API info
app.get('/api/info', async (req, res) => {
    try {
        const productCount = await Product.countDocuments();
        const messageCount = await Message.countDocuments();
        const orderCount = await Order.countDocuments();
        const unreadMessages = await Message.countDocuments({ read: false });
        const visitorData = await Visitor.findOne();
        
        res.json({
            server: {
                name: 'Trúc Đào Cosmetics API',
                version: '2.0.0',
                environment: isProduction ? 'production' : 'development',
                database: 'MongoDB'
            },
            database: {
                products: productCount,
                messages: messageCount,
                orders: orderCount,
                unreadMessages: unreadMessages,
                visitors: visitorData?.total || 0
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Visitor tracking
app.post('/api/visitors', async (req, res) => {
    try {
        let visitorData = await Visitor.findOne();
        if (!visitorData) {
            visitorData = new Visitor();
        }
        
        const today = new Date().toDateString();
        const now = new Date();
        
        if (visitorData.date !== today) {
            visitorData.today = 0;
            visitorData.date = today;
        }
        
        visitorData.total++;
        visitorData.today++;
        
        visitorData.history.push({
            timestamp: now.toISOString(),
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        
        // Keep only last 1000 records
        if (visitorData.history.length > 1000) {
            visitorData.history = visitorData.history.slice(-1000);
        }
        
        await visitorData.save();
        
        res.json({
            total: visitorData.total,
            today: visitorData.today,
            date: visitorData.date
        });
    } catch (error) {
        console.error('Error tracking visitor:', error);
        res.status(500).json({ error: 'Lỗi server khi tracking visitor' });
    }
});

// Products API - FIXED: Hỗ trợ cả ID số và ObjectId
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        // Chuyển đổi _id thành id để tương thích với frontend
        const formattedProducts = products.map(product => ({
            id: product._id.toString(),
            name: product.name,
            category: product.category,
            originalPrice: product.originalPrice,
            salePrice: product.salePrice,
            image: product.image,
            description: product.description,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt
        }));
        res.json(formattedProducts);
    } catch (error) {
        console.error('Error getting products:', error);
        res.status(500).json({ error: 'Lỗi server khi lấy sản phẩm' });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const { name, category, originalPrice, salePrice, image, description } = req.body;
        
        console.log('📦 Creating new product:', { name, category, originalPrice, salePrice });
        
        if (!name || !category || !originalPrice || !salePrice || !image) {
            return res.status(400).json({
                success: false,
                error: 'Thiếu thông tin sản phẩm bắt buộc'
            });
        }
        
        const newProduct = new Product({
            name: name.trim(),
            category: category.trim(),
            originalPrice: parseInt(originalPrice),
            salePrice: parseInt(salePrice),
            image: image.trim(),
            description: (description || '').trim()
        });
        
        await newProduct.save();
        
        console.log('✅ New product created:', newProduct.name);
        
        // Trả về sản phẩm với id thay vì _id
        const responseProduct = {
            id: newProduct._id.toString(),
            name: newProduct.name,
            category: newProduct.category,
            originalPrice: newProduct.originalPrice,
            salePrice: newProduct.salePrice,
            image: newProduct.image,
            description: newProduct.description,
            createdAt: newProduct.createdAt,
            updatedAt: newProduct.updatedAt
        };
        
        res.status(201).json({
            success: true,
            message: 'Tạo sản phẩm thành công',
            product: responseProduct
        });
    } catch (error) {
        console.error('❌ Error creating product:', error);
        res.status(500).json({ 
            success: false,
            error: 'Lỗi server khi tạo sản phẩm: ' + error.message 
        });
    }
});

// FIXED: Cập nhật sản phẩm - Hỗ trợ cả ID số và ObjectId
app.put('/api/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const { name, category, originalPrice, salePrice, image, description } = req.body;
        
        console.log('🔄 Updating product:', { 
            productId, 
            name, 
            category, 
            originalPrice, 
            salePrice 
        });
        
        let product;
        
        // THỬ 1: Tìm bằng ObjectId (cho sản phẩm mới)
        if (mongoose.Types.ObjectId.isValid(productId)) {
            product = await Product.findById(productId);
            if (product) {
                console.log('✅ Found product by ObjectId:', product.name);
            }
        }
        
        // THỬ 2: Nếu không tìm thấy, tìm bằng ID số (cho sản phẩm cũ)
        if (!product) {
            console.log('🔍 Trying to find product by numeric ID:', productId);
            
            // Lấy tất cả sản phẩm và tìm theo index
            const allProducts = await Product.find().sort({ createdAt: 1 });
            const productIndex = parseInt(productId) - 1; // Giả sử ID bắt đầu từ 1
            
            if (productIndex >= 0 && productIndex < allProducts.length) {
                product = allProducts[productIndex];
                console.log('✅ Found product by index:', product.name);
            }
        }
        
        // THỬ 3: Tìm bằng tên sản phẩm (fallback)
        if (!product && name) {
            console.log('🔍 Trying to find product by name:', name);
            product = await Product.findOne({ name: new RegExp(name, 'i') });
            if (product) {
                console.log('✅ Found product by name:', product.name);
            }
        }
        
        if (!product) {
            console.log('❌ Product not found with ID:', productId);
            return res.status(404).json({ 
                success: false,
                error: 'Không tìm thấy sản phẩm với ID: ' + productId 
            });
        }
        
        console.log('✅ Found product:', product.name);
        
        // Cập nhật thông tin sản phẩm
        const updateData = {
            updatedAt: new Date()
        };
        
        if (name) updateData.name = name.trim();
        if (category) updateData.category = category.trim();
        if (originalPrice) updateData.originalPrice = parseInt(originalPrice);
        if (salePrice) updateData.salePrice = parseInt(salePrice);
        if (image) updateData.image = image.trim();
        if (description !== undefined) updateData.description = description.trim();
        
        const updatedProduct = await Product.findByIdAndUpdate(
            product._id, // Sử dụng ObjectId thực tế
            updateData,
            { new: true, runValidators: true }
        );
        
        console.log('✅ Product updated successfully:', updatedProduct.name);
        
        // Trả về sản phẩm với id thay vì _id
        const responseProduct = {
            id: updatedProduct._id.toString(),
            name: updatedProduct.name,
            category: updatedProduct.category,
            originalPrice: updatedProduct.originalPrice,
            salePrice: updatedProduct.salePrice,
            image: updatedProduct.image,
            description: updatedProduct.description,
            createdAt: updatedProduct.createdAt,
            updatedAt: updatedProduct.updatedAt
        };
        
        res.json({
            success: true,
            message: 'Cập nhật sản phẩm thành công',
            product: responseProduct
        });
    } catch (error) {
        console.error('❌ Error updating product:', error);
        res.status(500).json({ 
            success: false,
            error: 'Lỗi server khi cập nhật sản phẩm: ' + error.message 
        });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        
        console.log('🗑️ Deleting product:', productId);
        
        let product;
        
        // Tìm sản phẩm bằng ObjectId hoặc ID số
        if (mongoose.Types.ObjectId.isValid(productId)) {
            product = await Product.findById(productId);
        }
        
        if (!product) {
            // Tìm bằng ID số
            const allProducts = await Product.find().sort({ createdAt: 1 });
            const productIndex = parseInt(productId) - 1;
            
            if (productIndex >= 0 && productIndex < allProducts.length) {
                product = allProducts[productIndex];
            }
        }
        
        if (!product) {
            console.log('❌ Product not found for deletion:', productId);
            return res.status(404).json({ 
                success: false,
                error: 'Không tìm thấy sản phẩm để xóa' 
            });
        }
        
        const deletedProduct = await Product.findByIdAndDelete(product._id);
        
        console.log('✅ Product deleted:', deletedProduct.name);
        
        res.json({ 
            success: true,
            message: 'Đã xóa sản phẩm thành công',
            deletedProduct: {
                id: deletedProduct._id.toString(),
                name: deletedProduct.name
            }
        });
    } catch (error) {
        console.error('❌ Error deleting product:', error);
        res.status(500).json({ 
            success: false,
            error: 'Lỗi server khi xóa sản phẩm: ' + error.message 
        });
    }
});

// Reset products endpoint - ĐỂ FIX LỖI ID
app.delete('/api/products-reset', async (req, res) => {
    try {
        console.log('🔄 Resetting all products...');
        
        // Xóa tất cả sản phẩm
        const deleteResult = await Product.deleteMany({});
        console.log(`✅ Deleted ${deleteResult.deletedCount} products`);
        
        // Tạo lại sản phẩm mặc định với ObjectId
        await Product.insertMany([
            {
                name: "Son lì cao cấp Luxury Matte",
                category: "Son môi",
                originalPrice: 399000,
                salePrice: 299000,
                image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
                description: "Son lì cao cấp với công thức mềm mịn, lâu trôi"
            },
            {
                name: "Bảng phấn mắt 12 màu Pro Palette",
                category: "Trang điểm mắt",
                originalPrice: 600000,
                salePrice: 450000,
                image: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
                description: "Bảng phấn mắt đa dạng màu sắc, dễ phối màu"
            },
            {
                name: "Kem nền che khuyết điểm Full Cover",
                category: "Trang điểm mặt",
                originalPrice: 650000,
                salePrice: 520000,
                image: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
                description: "Kem nền che phủ hoàn hảo, không gây bít tắc lỗ chân lông"
            },
            {
                name: "Serum dưỡng ẩm chống lão hóa",
                category: "Chăm sóc da",
                originalPrice: 850000,
                salePrice: 680000,
                image: "https://images.unsplash.com/photo-1594035910387-fea47794261f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
                description: "Serum dưỡng ẩm chuyên sâu, cải thiện nếp nhăn"
            }
        ]);
        
        console.log('✅ Created new products with ObjectId');
        
        const newProducts = await Product.find();
        const productsWithIds = newProducts.map(product => ({
            id: product._id.toString(),
            name: product.name
        }));
        
        res.json({
            success: true,
            message: 'Đã xóa và tạo lại tất cả sản phẩm với ObjectId mới',
            products: productsWithIds
        });
    } catch (error) {
        console.error('❌ Error resetting products:', error);
        res.status(500).json({ 
            success: false,
            error: 'Lỗi khi reset sản phẩm: ' + error.message 
        });
    }
});

// Messages API
app.get('/api/messages', async (req, res) => {
    try {
        const messages = await Message.find().sort({ timestamp: -1 });
        // Chuyển đổi _id thành id để tương thích với frontend
        const formattedMessages = messages.map(message => ({
            id: message._id.toString(),
            text: message.text,
            product: message.product,
            timestamp: message.timestamp,
            read: message.read,
            isAutoResponse: message.isAutoResponse,
            isAdminReply: message.isAdminReply,
            originalMessageId: message.originalMessageId,
            customerInfo: message.customerInfo,
            replies: message.replies
        }));
        res.json(formattedMessages);
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({ error: 'Lỗi server khi lấy tin nhắn' });
    }
});

app.post('/api/messages', async (req, res) => {
    try {
        const { text, product, isAutoResponse, isAdminReply, originalMessageId, customerInfo } = req.body;
        
        if (!text || text.trim() === '') {
            return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
        }
        
        const newMessage = new Message({
            text: text.trim(),
            product: product || null,
            isAutoResponse: isAutoResponse || false,
            isAdminReply: isAdminReply || false,
            originalMessageId: originalMessageId || null,
            customerInfo: customerInfo || null
        });
        
        await newMessage.save();
        
        console.log('💬 New message received from:', customerInfo?.name || 'Unknown');
        
        // Trả về message với id thay vì _id
        const responseMessage = {
            id: newMessage._id.toString(),
            text: newMessage.text,
            product: newMessage.product,
            timestamp: newMessage.timestamp,
            read: newMessage.read,
            isAutoResponse: newMessage.isAutoResponse,
            isAdminReply: newMessage.isAdminReply,
            originalMessageId: newMessage.originalMessageId,
            customerInfo: newMessage.customerInfo,
            replies: newMessage.replies
        };
        
        res.status(201).json(responseMessage);
    } catch (error) {
        console.error('Error creating message:', error);
        res.status(500).json({ error: 'Lỗi server khi gửi tin nhắn' });
    }
});

// Mark message as read
app.put('/api/messages/:id/read', async (req, res) => {
    try {
        const messageId = req.params.id;
        
        // FIX: Sử dụng ObjectId để tìm kiếm
        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ error: 'ID tin nhắn không hợp lệ' });
        }
        
        const message = await Message.findByIdAndUpdate(
            messageId,
            { read: true },
            { new: true }
        );
        
        if (!message) {
            return res.status(404).json({ error: 'Không tìm thấy tin nhắn' });
        }
        
        res.json({
            id: message._id.toString(),
            text: message.text,
            timestamp: message.timestamp,
            read: message.read,
            customerInfo: message.customerInfo
        });
    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Reply to message
app.post('/api/messages/:id/reply', async (req, res) => {
    try {
        const messageId = req.params.id;
        const { text, adminName } = req.body;
        
        if (!text || text.trim() === '') {
            return res.status(400).json({ error: 'Nội dung phản hồi không được để trống' });
        }
        
        // FIX: Sử dụng ObjectId để tìm kiếm
        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ error: 'ID tin nhắn không hợp lệ' });
        }
        
        const parentMessage = await Message.findById(messageId);
        
        if (!parentMessage) {
            return res.status(404).json({ error: 'Không tìm thấy tin nhắn' });
        }
        
        const replyMessage = {
            text: text.trim(),
            adminName: adminName || 'Admin'
        };
        
        if (!parentMessage.replies) {
            parentMessage.replies = [];
        }
        
        parentMessage.replies.push(replyMessage);
        parentMessage.read = true;
        
        await parentMessage.save();
        
        console.log('📤 Admin replied to message:', messageId);
        
        res.json({
            parentMessage: {
                id: parentMessage._id.toString(),
                text: parentMessage.text,
                timestamp: parentMessage.timestamp,
                read: parentMessage.read,
                customerInfo: parentMessage.customerInfo,
                replies: parentMessage.replies
            },
            reply: replyMessage
        });
    } catch (error) {
        console.error('Error replying to message:', error);
        res.status(500).json({ error: 'Lỗi server khi gửi phản hồi' });
    }
});

// Mark all messages as read for a customer
app.put('/api/messages/customer/:phone/read-all', async (req, res) => {
    try {
        const customerPhone = req.params.phone;
        
        const result = await Message.updateMany(
            { 
                'customerInfo.phone': customerPhone,
                read: false,
                isAdminReply: false
            },
            { read: true }
        );
        
        console.log(`✅ Marked ${result.modifiedCount} messages as read for customer: ${customerPhone}`);
        
        res.json({
            success: true,
            message: `Đã đánh dấu ${result.modifiedCount} tin nhắn là đã đọc`,
            updatedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Error marking all messages as read:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Orders API
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        // Chuyển đổi _id thành id để tương thích với frontend
        const formattedOrders = orders.map(order => ({
            id: order._id.toString(),
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            customerAddress: order.customerAddress,
            products: order.products,
            totalAmount: order.totalAmount,
            status: order.status,
            paymentMethod: order.paymentMethod,
            paymentScreenshot: order.paymentScreenshot,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
        }));
        res.json(formattedOrders);
    } catch (error) {
        console.error('Error getting orders:', error);
        res.status(500).json({ error: 'Lỗi server khi lấy đơn hàng' });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { customerName, customerPhone, customerAddress, products, totalAmount, paymentScreenshot } = req.body;
        
        if (!customerName || !customerPhone || !customerAddress || !products || !totalAmount) {
            return res.status(400).json({
                error: 'Thiếu thông tin đơn hàng bắt buộc'
            });
        }
        
        const newOrder = new Order({
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            customerAddress: customerAddress.trim(),
            products: Array.isArray(products) ? products : [],
            totalAmount: parseInt(totalAmount),
            paymentScreenshot: paymentScreenshot || ''
        });
        
        await newOrder.save();
        
        // Update statistics
        await updateOrderStatistics();
        
        console.log('🛒 New order created:', `${customerName} - ${formatPrice(totalAmount)}`);
        
        // Trả về order với id thay vì _id
        const responseOrder = {
            id: newOrder._id.toString(),
            customerName: newOrder.customerName,
            customerPhone: newOrder.customerPhone,
            customerAddress: newOrder.customerAddress,
            products: newOrder.products,
            totalAmount: newOrder.totalAmount,
            status: newOrder.status,
            paymentMethod: newOrder.paymentMethod,
            paymentScreenshot: newOrder.paymentScreenshot,
            createdAt: newOrder.createdAt,
            updatedAt: newOrder.updatedAt
        };
        
        res.status(201).json(responseOrder);
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Lỗi server khi tạo đơn hàng' });
    }
});

app.put('/api/orders/:id/status', async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status } = req.body;
        
        const validStatuses = ['pending', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
        }
        
        // FIX: Sử dụng ObjectId để tìm kiếm
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ error: 'ID đơn hàng không hợp lệ' });
        }
        
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { 
                status: status,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        if (!updatedOrder) {
            return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
        }
        
        // Update statistics
        await updateOrderStatistics();
        
        console.log(`✅ Order ${orderId} status changed to: ${status}`);
        
        res.json({
            id: updatedOrder._id.toString(),
            customerName: updatedOrder.customerName,
            customerPhone: updatedOrder.customerPhone,
            totalAmount: updatedOrder.totalAmount,
            status: updatedOrder.status,
            updatedAt: updatedOrder.updatedAt
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Lỗi server khi cập nhật trạng thái đơn hàng' });
    }
});

// Get order statistics
app.get('/api/orders/statistics', async (req, res) => {
    try {
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ status: 'pending' });
        const completedOrders = await Order.countDocuments({ status: 'completed' });
        const cancelledOrders = await Order.countDocuments({ status: 'cancelled' });
        
        const completedOrdersData = await Order.find({ status: 'completed' });
        const totalRevenue = completedOrdersData.reduce((sum, order) => sum + order.totalAmount, 0);
        
        const uniqueCustomers = await Order.distinct('customerPhone');
        
        res.json({
            totalOrders,
            pendingOrders,
            completedOrders,
            cancelledOrders,
            totalRevenue,
            uniqueCustomers: uniqueCustomers.length,
            averageOrderValue: completedOrders > 0 ? Math.round(totalRevenue / completedOrders) : 0
        });
    } catch (error) {
        console.error('Error getting order statistics:', error);
        res.status(500).json({ error: 'Lỗi server khi lấy thống kê đơn hàng' });
    }
});

// Contact form
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, message, phone } = req.body;
        
        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
            });
        }
        
        const contactMessage = new Message({
            text: `Liên hệ từ: ${name} (${email}${phone ? ` - ${phone}` : ''}) - ${message}`,
            type: 'contact_form',
            customerInfo: { 
                name: name.trim(), 
                email: email.trim(), 
                phone: phone ? phone.trim() : '' 
            }
        });
        
        await contactMessage.save();
        
        console.log('📧 Contact form submission:', { name, email, phone });
        
        res.json({
            success: true,
            message: 'Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi sớm nhất.',
            data: { name, email, phone }
        });
    } catch (error) {
        console.error('Error processing contact form:', error);
        res.status(500).json({
            success: false,
            message: 'Đã có lỗi xảy ra khi gửi liên hệ'
        });
    }
});

// Settings API
app.get('/api/settings', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({});
        }
        res.json(settings);
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({ error: 'Lỗi server khi lấy cài đặt' });
    }
});

app.put('/api/settings', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings(req.body);
        } else {
            settings = Object.assign(settings, req.body);
        }
        
        await settings.save();
        
        console.log('⚙️ Settings updated');
        
        res.json(settings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Lỗi server khi cập nhật cài đặt' });
    }
});

// Statistics API
app.get('/api/statistics', async (req, res) => {
    try {
        const productCount = await Product.countDocuments();
        const messageCount = await Message.countDocuments();
        const unreadMessages = await Message.countDocuments({ read: false });
        const visitorData = await Visitor.findOne();
        const orderCount = await Order.countDocuments();
        const completedOrders = await Order.countDocuments({ status: 'completed' });
        
        const completedOrdersData = await Order.find({ status: 'completed' });
        const totalRevenue = completedOrdersData.reduce((sum, order) => sum + order.totalAmount, 0);
        
        let statistics = await Statistics.findOne();
        if (!statistics) {
            statistics = await Statistics.create({});
        }
        
        const result = {
            ...statistics.toObject(),
            totalProducts: productCount,
            totalMessages: messageCount,
            unreadMessages: unreadMessages,
            totalVisitors: visitorData?.total || 0,
            todayVisitors: visitorData?.today || 0,
            totalOrders: orderCount,
            completedOrders: completedOrders,
            totalRevenue: totalRevenue
        };
        
        res.json(result);
    } catch (error) {
        console.error('Error getting statistics:', error);
        res.status(500).json({ error: 'Lỗi server khi lấy thống kê' });
    }
});

// Dashboard API
app.get('/api/dashboard', async (req, res) => {
    try {
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ status: 'pending' });
        const completedOrders = await Order.countDocuments({ status: 'completed' });
        
        const completedOrdersData = await Order.find({ status: 'completed' });
        const totalRevenue = completedOrdersData.reduce((sum, order) => sum + order.totalAmount, 0);
        
        const uniqueCustomers = await Order.distinct('customerPhone');
        const unreadMessages = await Message.countDocuments({ read: false, isAdminReply: false });
        const productCount = await Product.countDocuments();
        const visitorData = await Visitor.findOne();
        
        // Recent orders (last 5)
        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('id customerName customerPhone totalAmount status createdAt');
        
        // Recent messages (last 5)
        const recentMessages = await Message.find()
            .sort({ timestamp: -1 })
            .limit(5)
            .select('id customerInfo text timestamp read');
        
        // Popular products (based on orders)
        const completedOrdersForProducts = await Order.find({ status: 'completed' });
        const productSales = {};
        
        completedOrdersForProducts.forEach(order => {
            order.products.forEach(product => {
                const productId = product.id || product.name;
                if (!productSales[productId]) {
                    productSales[productId] = {
                        name: product.name,
                        quantity: 0,
                        revenue: 0
                    };
                }
                productSales[productId].quantity += product.quantity || 1;
                productSales[productId].revenue += (product.price || 0) * (product.quantity || 1);
            });
        });
        
        const popularProducts = Object.values(productSales)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);
        
        res.json({
            overview: {
                totalOrders,
                pendingOrders,
                completedOrders,
                totalRevenue,
                uniqueCustomers: uniqueCustomers.length,
                unreadMessages,
                totalProducts: productCount,
                totalVisitors: visitorData?.total || 0
            },
            recentOrders,
            recentMessages,
            popularProducts
        });
    } catch (error) {
        console.error('Error getting dashboard data:', error);
        res.status(500).json({ error: 'Lỗi server khi lấy dữ liệu dashboard' });
    }
});

// ==================== HELPER FUNCTIONS ====================

// Format price helper function
function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

// Update order statistics
async function updateOrderStatistics() {
    try {
        const completedOrders = await Order.find({ status: 'completed' });
        
        const totalSales = completedOrders.length;
        const totalRevenue = completedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        
        // Update popular products
        const productSales = {};
        completedOrders.forEach(order => {
            order.products.forEach(product => {
                const productId = product.id || product.name;
                if (!productSales[productId]) {
                    productSales[productId] = {
                        name: product.name,
                        quantity: 0,
                        revenue: 0
                    };
                }
                productSales[productId].quantity += product.quantity || 1;
                productSales[productId].revenue += (product.price || 0) * (product.quantity || 1);
            });
        });
        
        const popularProducts = Object.values(productSales)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
        
        let statistics = await Statistics.findOne();
        if (!statistics) {
            statistics = new Statistics({
                totalSales,
                totalRevenue,
                popularProducts
            });
        } else {
            statistics.totalSales = totalSales;
            statistics.totalRevenue = totalRevenue;
            statistics.popularProducts = popularProducts;
        }
        
        await statistics.save();
    } catch (error) {
        console.error('Error updating statistics:', error);
    }
}

// ==================== ERROR HANDLING ====================

// 404 for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint không tồn tại'
    });
});

// SPA fallback
app.use('*', (req, res) => {
    if (req.accepts('html')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else if (req.accepts('json')) {
        res.status(404).json({
            success: false,
            message: 'Route không tồn tại'
        });
    } else {
        res.status(404).type('txt').send('404 Not Found');
    }
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('🚨 Server Error:', error);
    
    res.status(500).json({
        success: false,
        message: 'Đã có lỗi xảy ra trên máy chủ',
        errorId: Date.now(),
        ...(isProduction ? {} : { stack: error.stack })
    });
});

// ==================== DATABASE CONNECTION & SERVER STARTUP ====================

async function startServer() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('✅ Connected to MongoDB successfully');
        
        // Khởi tạo database
        await initializeDatabase();
        
        const server = http.createServer(app);
        
        server.listen(PORT, '0.0.0.0', () => {
            console.log('\n' + '='.repeat(70));
            console.log('🚀 TRÚC ĐÀO COSMETICS SERVER STARTED SUCCESSFULLY!');
            console.log('='.repeat(70));
            console.log('📍 Port:', PORT);
            console.log('🌍 Environment:', isProduction ? 'production' : 'development');
            console.log('💾 Database: MongoDB Atlas');
            console.log('⏰ Server started at:', new Date().toISOString());
            console.log('='.repeat(70));
        });
        
        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down gracefully...');
            await mongoose.connection.close();
            console.log('✅ MongoDB connection closed');
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;
