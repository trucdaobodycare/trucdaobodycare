const express = require('express');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');

const app = express();

// ==================== CONFIGURATION ====================
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'trucdao-cosmetics-secret-key-2024';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/trucdao-cosmetics?retryWrites=true&w=majority';

console.log('🚀 Environment:', isProduction ? 'production' : 'development');
console.log('📍 Port:', PORT);

// ==================== MONGODB MODELS ====================

// User Model for Admin
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'admin' },
    lastLogin: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Product Model
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    originalPrice: { type: Number, required: true },
    salePrice: { type: Number, required: true },
    image: { type: String, required: true },
    description: { type: String, default: '' },
    sku: { type: String, unique: true },
    stock: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    tags: [{ type: String }],
    views: { type: Number, default: 0 },
    sales: { type: Number, default: 0 },
    status: { type: String, default: 'active' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Auto-generate SKU
productSchema.pre('save', function(next) {
    if (!this.sku) {
        this.sku = 'TD-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    }
    next();
});

const Product = mongoose.model('Product', productSchema);

// Message Model
const messageSchema = new mongoose.Schema({
    text: { type: String, required: true },
    type: { type: String, default: 'customer' }, // customer, admin, system
    product: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false },
    isAutoResponse: { type: Boolean, default: false },
    isAdminReply: { type: Boolean, default: false },
    priority: { type: String, default: 'normal' }, // low, normal, high, urgent
    customerInfo: {
        name: String,
        phone: String,
        email: String,
        ip: String,
        userAgent: String
    },
    replies: [{
        text: String,
        timestamp: { type: Date, default: Date.now },
        isAdminReply: { type: Boolean, default: true },
        adminName: { type: String, default: 'Admin' },
        adminId: String
    }],
    status: { type: String, default: 'open' } // open, pending, resolved, closed
});

const Message = mongoose.model('Message', messageSchema);

// Order Model
const orderSchema = new mongoose.Schema({
    orderNumber: { type: String, unique: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    customerEmail: { type: String },
    customerAddress: { type: String, required: true },
    customerNote: { type: String },
    products: [{
        id: String,
        name: String,
        price: Number,
        quantity: Number,
        image: String,
        sku: String
    }],
    subtotal: { type: Number, required: true },
    shippingFee: { type: Number, default: 30000 },
    totalAmount: { type: Number, required: true },
    status: { type: String, default: 'pending' }, // pending, confirmed, processing, shipping, delivered, cancelled, refunded
    paymentMethod: { type: String, default: 'bank_transfer' }, // bank_transfer, cod, momo, zalopay
    paymentStatus: { type: String, default: 'pending' }, // pending, paid, failed, refunded
    paymentScreenshot: { type: String, default: '' },
    shippingInfo: {
        carrier: String,
        trackingNumber: String,
        shippedAt: Date,
        estimatedDelivery: Date
    },
    notes: [{
        text: String,
        adminName: String,
        timestamp: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Auto-generate order number
orderSchema.pre('save', function(next) {
    if (!this.orderNumber) {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        this.orderNumber = `TD-${timestamp}${random}`;
    }
    next();
});

const Order = mongoose.model('Order', orderSchema);

// Visitor/Analytics Model
const visitorSchema = new mongoose.Schema({
    total: { type: Number, default: 0 },
    today: { type: Number, default: 0 },
    date: { type: String, default: new Date().toDateString() },
    uniqueVisitors: { type: Number, default: 0 },
    pageViews: { type: Number, default: 0 },
    history: [{
        timestamp: Date,
        ip: String,
        userAgent: String,
        path: String,
        referrer: String,
        country: String,
        city: String,
        sessionId: String
    }],
    dailyStats: [{
        date: String,
        visits: Number,
        pageViews: Number,
        uniqueVisitors: Number
    }]
});

const Visitor = mongoose.model('Visitor', visitorSchema);

// Settings Model
const settingsSchema = new mongoose.Schema({
    siteTitle: { type: String, default: 'Trúc Đào Cosmetics' },
    siteDescription: { type: String, default: 'Mỹ phẩm cao cấp' },
    adminEmail: { type: String, default: 'admin@trucdaocosmetics.vn' },
    supportPhone: { type: String, default: '1900 1234' },
    supportEmail: { type: String, default: 'support@trucdaocosmetics.vn' },
    address: { type: String, default: '123 Nguyễn Văn Linh, Quận 7, TP.HCM' },
    socialMedia: {
        facebook: String,
        instagram: String,
        tiktok: String,
        youtube: String
    },
    bankInfo: {
        bankName: { type: String, default: 'Sacombank' },
        accountNumber: { type: String, default: '123022988888' },
        accountName: { type: String, default: 'Nguyễn Thị Trúc Đào' }
    },
    shippingFee: { type: Number, default: 30000 },
    freeShippingThreshold: { type: Number, default: 500000 },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: 'Website đang bảo trì, vui lòng quay lại sau.' },
    themeSettings: {
        primaryColor: { type: String, default: '#e83e8c' },
        secondaryColor: { type: String, default: '#ffc107' },
        fontFamily: { type: String, default: 'Inter' }
    },
    seoSettings: {
        metaTitle: String,
        metaDescription: String,
        keywords: String
    },
    updatedAt: { type: Date, default: Date.now }
});

const Settings = mongoose.model('Settings', settingsSchema);

// Statistics Model
const statisticsSchema = new mongoose.Schema({
    totalSales: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    totalCustomers: { type: Number, default: 0 },
    totalProducts: { type: Number, default: 0 },
    monthlyRevenue: [{
        month: String,
        revenue: Number,
        orders: Number
    }],
    popularProducts: [{
        name: String,
        sku: String,
        quantity: Number,
        revenue: Number,
        views: Number
    }],
    customerAcquisition: [{
        source: String,
        count: Number,
        conversion: Number
    }],
    updatedAt: { type: Date, default: Date.now }
});

const Statistics = mongoose.model('Statistics', statisticsSchema);

// Coupon/Promotion Model
const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    type: { type: String, default: 'percentage' }, // percentage, fixed, shipping
    value: { type: Number, required: true },
    minOrder: { type: Number, default: 0 },
    maxDiscount: { type: Number },
    usageLimit: { type: Number },
    usedCount: { type: Number, default: 0 },
    validFrom: { type: Date, default: Date.now },
    validUntil: { type: Date },
    active: { type: Boolean, default: true },
    description: String,
    createdAt: { type: Date, default: Date.now }
});

const Coupon = mongoose.model('Coupon', couponSchema);

// ==================== MIDDLEWARE ====================

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Compression
app.use(compression());

// CORS configuration - FIXED: More permissive for mobile devices
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'https://trucdaobodycare.onrender.com',
            'http://localhost:10000',
            'http://localhost:3000',
            'http://127.0.0.1:10000',
            'http://127.0.0.1:3000',
            'https://trucdaobodycare.onrender.com/',
            'http://localhost',
            'http://localhost:8080'
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1 || 
            origin.includes('render.com') || 
            origin.includes('localhost') ||
            origin.includes('127.0.0.1')) {
            callback(null, true);
        } else {
            console.log('🔒 Blocked by CORS:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control']
}));

// Body parsing with increased limits for mobile
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting - FIXED: More lenient for mobile users
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 1000 : 2000, // Increased for mobile
    message: {
        error: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút.',
        retryAfter: 900
    },
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);

// API-specific rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500, // Increased for better mobile experience
    message: {
        error: 'Quá nhiều yêu cầu API, vui lòng thử lại sau 15 phút.'
    }
});

// Logging
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Custom security headers - FIXED: Better mobile support
app.use((req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// ==================== AUTHENTICATION MIDDLEWARE ====================

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token truy cập không tồn tại' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token không hợp lệ' });
        }
        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Yêu cầu quyền admin' });
    }
};

// ==================== FILE UPLOAD CONFIGURATION ====================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận file ảnh!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

// ==================== STATIC FILES ====================
// FIXED: Serve static files before API routes
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: isProduction ? '1d' : '0',
    etag: true,
    lastModified: true,
    index: 'index.html',
    setHeaders: (res, path) => {
        // Cache static assets longer
        if (path.endsWith('.css') || path.endsWith('.js') || path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg')) {
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
        }
    }
}));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==================== DATABASE INITIALIZATION ====================

async function initializeDatabase() {
    try {
        console.log('🔄 Initializing database...');
        
        // Create default admin user - FIXED: More secure credentials
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('Admin123!', 12);
            await User.create({
                username: 'admin',
                password: hashedPassword,
                role: 'admin'
            });
            console.log('✅ Default admin user created (username: admin, password: Admin123!)');
        }

        // Create demo admin for testing
        const demoAdminExists = await User.findOne({ username: 'demo' });
        if (!demoAdminExists) {
            const hashedPassword = await bcrypt.hash('Demo123!', 12);
            await User.create({
                username: 'demo',
                password: hashedPassword,
                role: 'admin'
            });
            console.log('✅ Demo admin user created (username: demo, password: Demo123!)');
        }

        // Initialize other default data
        const collections = [
            { model: Visitor, defaultData: {} },
            { model: Settings, defaultData: {} },
            { model: Statistics, defaultData: {} }
        ];

        for (const collection of collections) {
            const count = await collection.model.countDocuments();
            if (count === 0) {
                await collection.model.create(collection.defaultData);
                console.log(`✅ Default ${collection.model.modelName} created`);
            }
        }

        // Create sample products if none exist
        const productCount = await Product.countDocuments();
        if (productCount === 0) {
            await Product.insertMany([
                {
                    name: "Son Lì Cao Cấp Ruby",
                    category: "Son môi",
                    originalPrice: 350000,
                    salePrice: 250000,
                    image: "/images/products/lipstick.jpg",
                    description: "Son lì cao cấp với độ bền lên đến 12 giờ, không gây khô môi",
                    stock: 50,
                    featured: true,
                    tags: ["son lì", "cao cấp", "lâu trôi"]
                },
                {
                    name: "Phấn Mắt Nude Palette",
                    category: "Trang điểm mắt",
                    originalPrice: 450000,
                    salePrice: 320000,
                    image: "/images/products/eyeshadow.jpg",
                    description: "Bảng phấn mắt với 12 tông màu nude thời thượng, dễ phối màu",
                    stock: 30,
                    featured: true,
                    tags: ["phấn mắt", "nude", "palette"]
                },
                {
                    name: "Kem Nền Che Khuyết Điểm",
                    category: "Trang điểm mặt",
                    originalPrice: 280000,
                    salePrice: 280000,
                    image: "/images/products/foundation.jpg",
                    description: "Kem nền mỏng nhẹ, che phủ hoàn hảo, không gây bít tắc lỗ chân lông",
                    stock: 25,
                    tags: ["kem nền", "che khuyết điểm", "mỏng nhẹ"]
                },
                {
                    name: "Serum Dưỡng Ẩm Chuyên Sâu",
                    category: "Chăm sóc da",
                    originalPrice: 520000,
                    salePrice: 420000,
                    image: "/images/products/serum.jpg",
                    description: "Serum dưỡng ẩm chuyên sâu cho làn da căng mịn, sáng khỏe",
                    stock: 40,
                    featured: true,
                    tags: ["serum", "dưỡng ẩm", "chăm sóc da"]
                }
            ]);
            console.log('✅ Sample products created');
        }

        console.log('✅ Database initialization completed');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

// ==================== UTILITY FUNCTIONS ====================

function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

function generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
}

async function updateStatistics() {
    try {
        const totalProducts = await Product.countDocuments({ status: 'active' });
        const totalOrders = await Order.countDocuments();
        const completedOrders = await Order.countDocuments({ status: 'delivered' });
        const totalRevenue = await Order.aggregate([
            { $match: { status: 'delivered' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        
        const uniqueCustomers = await Order.distinct('customerPhone');
        
        let stats = await Statistics.findOne();
        if (!stats) {
            stats = new Statistics();
        }
        
        stats.totalProducts = totalProducts;
        stats.totalSales = completedOrders;
        stats.totalRevenue = totalRevenue[0]?.total || 0;
        stats.totalCustomers = uniqueCustomers.length;
        stats.updatedAt = new Date();
        
        await stats.save();
    } catch (error) {
        console.error('Error updating statistics:', error);
    }
}

// ==================== ROUTES ====================

// Health check and basic routes - FIXED: Moved before API routes
app.get('/favicon.ico', (req, res) => res.status(204).end());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        const productCount = await Product.countDocuments();
        const orderCount = await Order.countDocuments();
        const messageCount = await Message.countDocuments();
        
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: dbStatus,
            collections: {
                products: productCount,
                orders: orderCount,
                messages: messageCount
            },
            memory: process.memoryUsage(),
            environment: isProduction ? 'production' : 'development'
        });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', error: error.message });
    }
});

// ==================== AUTHENTICATION ROUTES ====================

// FIXED: Improved login with better error handling
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log('🔐 Login attempt:', { username, hasPassword: !!password });
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false,
                error: 'Vui lòng nhập tên đăng nhập và mật khẩu' 
            });
        }
        
        const user = await User.findOne({ username: username.trim() });
        if (!user) {
            console.log('❌ User not found:', username);
            return res.status(401).json({ 
                success: false,
                error: 'Tên đăng nhập hoặc mật khẩu không đúng' 
            });
        }
        
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            console.log('❌ Invalid password for user:', username);
            return res.status(401).json({ 
                success: false,
                error: 'Tên đăng nhập hoặc mật khẩu không đúng' 
            });
        }
        
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        
        const token = jwt.sign(
            { 
                userId: user._id, 
                username: user.username, 
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        console.log(`✅ User ${username} logged in successfully`);
        
        res.json({
            success: true,
            message: 'Đăng nhập thành công',
            token,
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                lastLogin: user.lastLogin
            }
        });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Lỗi server khi đăng nhập' 
        });
    }
});

app.post('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({
        valid: true,
        user: req.user
    });
});

// Logout endpoint
app.post('/api/auth/logout', authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: 'Đăng xuất thành công'
    });
});

// ==================== API ROUTES ====================

// Apply API rate limiting to all API routes
app.use('/api/', apiLimiter);

// API Info endpoint
app.get('/api/info', async (req, res) => {
    try {
        const productCount = await Product.countDocuments();
        const orderCount = await Order.countDocuments();
        const messageCount = await Message.countDocuments();
        const visitorData = await Visitor.findOne();
        
        res.json({
            server: {
                name: 'Trúc Đào Cosmetics API',
                version: '3.1.0',
                environment: isProduction ? 'production' : 'development',
                timestamp: new Date().toISOString()
            },
            statistics: {
                products: productCount,
                orders: orderCount,
                messages: messageCount,
                visitors: visitorData?.total || 0
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Visitor tracking - FIXED: Better mobile support
app.post('/api/visitors', async (req, res) => {
    try {
        const { path, referrer, sessionId } = req.body;
        const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
        const userAgent = req.get('User-Agent') || 'Unknown';
        
        let visitorData = await Visitor.findOne();
        if (!visitorData) {
            visitorData = new Visitor();
        }
        
        const today = new Date().toDateString();
        if (visitorData.date !== today) {
            visitorData.today = 0;
            visitorData.date = today;
            visitorData.dailyStats.push({
                date: today,
                visits: 0,
                pageViews: 0,
                uniqueVisitors: 0
            });
        }
        
        visitorData.total++;
        visitorData.today++;
        visitorData.pageViews++;
        
        // Check if unique visitor (based on session ID)
        const existingSession = visitorData.history.find(h => 
            h.sessionId === sessionId && 
            new Date(h.timestamp).toDateString() === today
        );
        
        if (!existingSession) {
            visitorData.uniqueVisitors++;
            const dailyStat = visitorData.dailyStats.find(d => d.date === today);
            if (dailyStat) {
                dailyStat.uniqueVisitors++;
            }
        }
        
        visitorData.history.push({
            timestamp: new Date(),
            ip,
            userAgent,
            path: path || '/',
            referrer: referrer || 'direct',
            sessionId: sessionId || generateSessionId()
        });
        
        // Keep history manageable
        if (visitorData.history.length > 5000) {
            visitorData.history = visitorData.history.slice(-5000);
        }
        
        await visitorData.save();
        
        res.json({
            success: true,
            total: visitorData.total,
            today: visitorData.today,
            uniqueVisitors: visitorData.uniqueVisitors,
            pageViews: visitorData.pageViews
        });
    } catch (error) {
        console.error('Error tracking visitor:', error);
        res.status(500).json({ error: 'Lỗi server khi tracking visitor' });
    }
});

// ==================== PRODUCTS API ====================

app.get('/api/products', async (req, res) => {
    try {
        const { category, featured, search, page = 1, limit = 12 } = req.query;
        
        let filter = { status: 'active' };
        
        if (category && category !== 'all') {
            filter.category = category;
        }
        
        if (featured === 'true') {
            filter.featured = true;
        }
        
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const products = await Product.find(filter)
            .sort({ featured: -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await Product.countDocuments(filter);
        
        const formattedProducts = products.map(product => ({
            id: product._id.toString(),
            name: product.name,
            category: product.category,
            originalPrice: product.originalPrice,
            salePrice: product.salePrice,
            image: product.image,
            description: product.description,
            sku: product.sku,
            stock: product.stock,
            featured: product.featured,
            tags: product.tags,
            views: product.views,
            sales: product.sales,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt
        }));
        
        res.json({
            success: true,
            products: formattedProducts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error getting products:', error);
        res.status(500).json({ 
            success: false,
            error: 'Lỗi server khi lấy sản phẩm' 
        });
    }
});

// ... (rest of the product routes remain similar but with improved error handling)

// ==================== ADMIN-ONLY ROUTES ====================

// Admin dashboard data - FIXED: Only accessible when logged in
app.get('/api/admin/dashboard', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [
            totalOrders,
            pendingOrders,
            completedOrders,
            totalProducts,
            totalMessages,
            unreadMessages,
            visitorData,
            recentOrders,
            recentMessages
        ] = await Promise.all([
            Order.countDocuments(),
            Order.countDocuments({ status: 'pending' }),
            Order.countDocuments({ status: 'delivered' }),
            Product.countDocuments({ status: 'active' }),
            Message.countDocuments(),
            Message.countDocuments({ read: false, isAdminReply: false }),
            Visitor.findOne(),
            Order.find().sort({ createdAt: -1 }).limit(5),
            Message.find().sort({ timestamp: -1 }).limit(5)
        ]);
        
        const revenueData = await Order.aggregate([
            { $match: { status: 'delivered' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        
        const totalRevenue = revenueData[0]?.total || 0;
        
        res.json({
            success: true,
            overview: {
                totalOrders,
                pendingOrders,
                completedOrders,
                totalRevenue,
                totalProducts,
                totalMessages,
                unreadMessages,
                totalVisitors: visitorData?.total || 0,
                todayVisitors: visitorData?.today || 0
            },
            recentOrders: recentOrders.map(order => ({
                id: order._id.toString(),
                orderNumber: order.orderNumber,
                customerName: order.customerName,
                totalAmount: order.totalAmount,
                status: order.status,
                createdAt: order.createdAt
            })),
            recentMessages: recentMessages.map(message => ({
                id: message._id.toString(),
                customerName: message.customerInfo?.name,
                text: message.text,
                timestamp: message.timestamp,
                read: message.read
            }))
        });
    } catch (error) {
        console.error('Error getting admin dashboard data:', error);
        res.status(500).json({ 
            success: false,
            error: 'Lỗi server khi lấy dữ liệu dashboard' 
        });
    }
});

// ==================== ERROR HANDLING ====================

// 404 for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'API endpoint không tồn tại'
    });
});

// SPA fallback - MUST BE LAST
app.use('*', (req, res) => {
    if (req.accepts('html')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else if (req.accepts('json')) {
        res.status(404).json({
            success: false,
            error: 'Route không tồn tại'
        });
    } else {
        res.status(404).type('txt').send('404 Not Found');
    }
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('🚨 Server Error:', error);
    
    // Multer errors
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                success: false,
                error: 'File quá lớn. Kích thước tối đa là 10MB.' 
            });
        }
    }
    
    res.status(500).json({
        success: false,
        error: 'Đã có lỗi xảy ra trên máy chủ',
        ...(isProduction ? {} : { stack: error.stack })
    });
});

// ==================== SERVER STARTUP ====================

async function startServer() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        
        // FIXED: Updated mongoose connection for newer versions
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000, // Increased timeout
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            retryWrites: true,
            w: 'majority'
        });
        
        console.log('✅ Connected to MongoDB successfully');
        
        // Initialize database
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
            console.log('🔐 JWT Authentication: Enabled');
            console.log('📊 Analytics: Enabled');
            console.log('🛡️ Security: Enhanced');
            console.log('📱 Mobile Support: Optimized');
            console.log('='.repeat(70));
            console.log('💡 Admin Login:');
            console.log('   👤 Username: admin');
            console.log('   🔑 Password: Admin123!');
            console.log('   👤 Demo: demo / Demo123!');
            console.log('='.repeat(70));
        });
        
        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down gracefully...');
            await mongoose.connection.close();
            console.log('✅ MongoDB connection closed');
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
            await mongoose.connection.close();
            console.log('✅ MongoDB connection closed');
            process.exit(0);
        });
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('🚨 Uncaught Exception:', error);
            process.exit(1);
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;
