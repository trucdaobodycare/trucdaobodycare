const express = require('express');
const path = require('path');
// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
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

// Trust the first proxy hop (e.g., from Render's load balancer)
// This is crucial for rate limiting and getting the correct client IP.
app.set('trust proxy', 1);

// ==================== CONFIGURATION ====================
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'trucdao-cosmetics-secret-key-2024';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/trucdao-cosmetics?retryWrites=true&w=majority';

console.log('🚀 Environment:', isProduction ? 'production' : 'development');
console.log('📍 Port:', PORT);

if (isProduction && JWT_SECRET === 'trucdao-cosmetics-secret-key-2024') {
    console.warn('🚨 WARNING: Using default JWT_SECRET in production. Please set a strong, unique secret in your environment variables.');
}


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

// Constants for Order statuses
const ORDER_STATUSES = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    SHIPPING: 'shipping',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded'
};
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
    status: { type: String, default: ORDER_STATUSES.PENDING, enum: Object.values(ORDER_STATUSES) },
    paymentMethod: { type: String, default: 'bank_transfer' },
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

// Debug middleware - log all API requests
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        console.log(`🌐 ${req.method} ${req.path}`, {
            ip: req.ip,
            origin: req.headers.origin,
            'user-agent': req.headers['user-agent']?.substring(0, 50),
            body: req.method === 'POST' ? req.body : undefined
        });
    }
    next();
});

// CORS configuration - FIXED: More permissive
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        const allowedOrigins = [
            'https://trucdaobodycare.onrender.com', // Your production frontend
            'http://localhost:3000', // Local frontend dev
            'http://localhost:5500', // Live Server for static files
            'http://127.0.0.1:5500',
        ];

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('🔒 Blocked by CORS:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting - FIXED: More lenient for mobile
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 1000 : 2000,
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
    max: 500,
    message: {
        error: 'Quá nhiều yêu cầu API, vui lòng thử lại sau 15 phút.'
    }
});

// Logging
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Custom security headers
app.use((req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    // The `cors` middleware already handles Access-Control-Allow-Origin
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

// ==================== AUTHENTICATION MIDDLEWARE ====================

// Middleware to verify JWT token
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

// Middleware to ensure user is an admin
const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Yêu cầu quyền admin' });
    }
};

// ==================== FILE UPLOAD CONFIGURATION ====================

// Multer disk storage configuration
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

// Filter to allow only image files
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận file ảnh!'), false);
    }
};

// Multer instance with configuration
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

// ==================== STATIC FILES ====================
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: isProduction ? '1d' : '0',
    etag: true,
    lastModified: true,
    index: 'index.html'
}));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==================== DATABASE INITIALIZATION ====================

async function initializeDatabase() {
    try {
        console.log('🔄 Initializing database...');
        
        // Create default admin user - FIXED: Better credentials
        const adminExists = await User.findOne({ username: 'Trucdaoadminlogin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('Thanhduy@060596', 12);
            await User.create({
                username: 'Trucdaoadminlogin',
                password: hashedPassword,
                role: 'admin'
            });
            console.log('✅ Default admin user created');
        }

        // Create demo admin for testing
        const demoAdminExists = await User.findOne({ username: 'demo' });
        if (!demoAdminExists) {
            const hashedPassword = await bcrypt.hash('demo123', 12);
            await User.create({
                username: 'demo',
                password: hashedPassword,
                role: 'admin'
            });
            console.log('✅ Demo admin user created');
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
                    image: "https://images.unsplash.com/photo-1586495777744-4413f21062fa?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1315&q=80",
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
                    image: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80",
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
                    image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1187&q=80",
                    description: "Kem nền mỏng nhẹ, che phủ hoàn hảo, không gây bít tắc lỗ chân lông",
                    stock: 25,
                    tags: ["kem nền", "che khuyết điểm", "mỏng nhẹ"]
                },
                {
                    name: "Serum Dưỡng Ẩm Chuyên Sâu",
                    category: "Chăm sóc da",
                    originalPrice: 520000,
                    salePrice: 420000,
                    image: "https://images.unsplash.com/photo-1556228577-135c319f45c8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80",
                    description: "Serum dưỡng ẩm chuyên sâu cho làn da căng mịn, sáng khỏe",
                    stock: 40,
                    featured: true,
                    tags: ["serum", "dưỡng ẩm", "chăm sóc da"]
                },
                {
                    name: "Nước Hoa Hương Hoa Nhài",
                    category: "Nước hoa",
                    originalPrice: 680000,
                    salePrice: 550000,
                    image: "https://images.unsplash.com/photo-1541643600914-78b084683601?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1044&q=80",
                    description: "Nước hoa hương hoa nhài tinh tế, lưu hương lâu",
                    stock: 20,
                    featured: true,
                    tags: ["nước hoa", "hoa nhài", "lưu hương lâu"]
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
        const [totalProducts, completedOrders, revenueResult] = await Promise.all([
            Product.countDocuments({ status: 'active' }),
            Order.countDocuments({ status: ORDER_STATUSES.DELIVERED }),
            Order.aggregate([
                { $match: { status: ORDER_STATUSES.DELIVERED } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ])
        ]);
        
        const uniqueCustomers = await Order.distinct('customerPhone');
        
        let stats = await Statistics.findOne();
        if (!stats) {
            stats = new Statistics();
        }
        
        stats.totalProducts = totalProducts;
        stats.totalSales = completedOrders;
        stats.totalRevenue = revenueResult[0]?.total || 0;
        stats.totalCustomers = uniqueCustomers.length;
        stats.updatedAt = new Date();
        
        await stats.save();
    } catch (error) {
        console.error('Error updating statistics:', error);
    }
}

// ==================== ROUTES ====================

// Basic routes
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Health check
app.get('/health', async (req, res) => {
    try {
        const [productCount, orderCount, messageCount] = await Promise.all([
            Product.countDocuments(),
            Order.countDocuments(),
            Message.countDocuments()
        ]);
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        
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
            memory: process.memoryUsage()
        });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', error: error.message });
    }
});

// Simple API test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API is working!',
        timestamp: new Date().toISOString(),
        server: 'Trúc Đào Cosmetics Server'
    });
});

// Test database connection
app.get('/api/db-status', async (req, res) => {
    try {
        const dbStatus = mongoose.connection.readyState;
        const statusText = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };
        
        res.json({
            database: statusText[dbStatus] || 'unknown',
            readyState: dbStatus,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test authentication endpoint
app.post('/api/auth/test', async (req, res) => {
    try {
        console.log('🔐 Test auth endpoint called:', req.body);
        res.json({
            success: true,
            message: 'Auth endpoint is working!',
            received: req.body,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Auth test error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Serve main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== AUTHENTICATION ROUTES ====================

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log('🔐 Login attempt for user:', username);
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false,
                error: 'Vui lòng nhập tên đăng nhập và mật khẩu' 
            });
        }
        
        const user = await User.findOne({ username });
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
            { userId: user._id, username: user.username, role: user.role },
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
        console.error('Login error:', error);
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

// ==================== API ROUTES ====================

// Apply API rate limiting to all API routes
app.use('/api/', apiLimiter);

// API Info
app.get('/api/info', async (req, res) => {
    try {
        const productCount = await Product.countDocuments();
        const orderCount = await Order.countDocuments();
        const messageCount = await Message.countDocuments();
        const visitorData = await Visitor.findOne();
        
        res.json({
            server: {
                name: 'Trúc Đào Cosmetics API',
                version: '3.0.0',
                environment: isProduction ? 'production' : 'development'
            },
            statistics: {
                products: productCount,
                orders: orderCount,
                messages: messageCount,
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
        const { path: reqPath, referrer, sessionId } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');
        
        const newSessionId = sessionId || generateSessionId();

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
            h.sessionId === newSessionId && 
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
            path: reqPath || '/',
            referrer: referrer || 'direct',
            sessionId: newSessionId
        });
        
        // Keep history manageable
        if (visitorData.history.length > 5000) {
            visitorData.history = visitorData.history.slice(-5000);
        }
        
        await visitorData.save();
        
        res.json({
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
        res.status(500).json({ error: 'Lỗi server khi lấy sản phẩm' });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ error: 'ID sản phẩm không hợp lệ' });
        }
        
        const product = await Product.findById(productId);
        
        if (!product) {
            return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
        }
        
        // Increment views
        product.views += 1;
        await product.save();
        
        const formattedProduct = {
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
        };
        
        res.json(formattedProduct);
    } catch (error) {
        console.error('Error getting product:', error);
        res.status(500).json({ error: 'Lỗi server khi lấy sản phẩm' });
    }
});

app.post('/api/products', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, category, originalPrice, salePrice, image, description, stock, featured, tags } = req.body;
        
        if (!name || !category || !originalPrice || !salePrice || !image) {
            return res.status(400).json({ error: 'Thiếu thông tin sản phẩm bắt buộc' });
        }
        
        const newProduct = new Product({
            name: name.trim(),
            category: category.trim(),
            originalPrice: parseInt(originalPrice),
            salePrice: parseInt(salePrice),
            image: image.trim(),
            description: (description || '').trim(),
            stock: parseInt(stock) || 0,
            featured: featured || false,
            tags: tags || []
        });
        
        await newProduct.save();
        
        console.log('✅ New product created:', newProduct.name);
        
        const responseProduct = {
            id: newProduct._id.toString(),
            name: newProduct.name,
            category: newProduct.category,
            originalPrice: newProduct.originalPrice,
            salePrice: newProduct.salePrice,
            image: newProduct.image,
            description: newProduct.description,
            sku: newProduct.sku,
            stock: newProduct.stock,
            featured: newProduct.featured,
            tags: newProduct.tags,
            createdAt: newProduct.createdAt,
            updatedAt: newProduct.updatedAt
        };
        
        res.status(201).json({
            success: true,
            message: 'Tạo sản phẩm thành công',
            product: responseProduct
        });
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Lỗi server khi tạo sản phẩm' });
    }
});

app.put('/api/products/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const productId = req.params.id;
        const updateData = { ...req.body, updatedAt: new Date() };

        // Prevent overwriting sku with null/undefined and remove id field if present
        if (updateData.sku === undefined || updateData.sku === null) delete updateData.sku;
        if (updateData.originalPrice !== undefined) {
            updateData.originalPrice = parseInt(updateData.originalPrice, 10);
        }
        if (updateData.salePrice !== undefined) {
            updateData.salePrice = parseInt(updateData.salePrice, 10);
        }
        if (updateData.stock !== undefined) {
            updateData.stock = parseInt(updateData.stock, 10);
        }
        // Handle tags: if it's an empty string, convert to empty array
        if (updateData.tags !== undefined) {
            if (typeof updateData.tags === 'string') {
                updateData.tags = updateData.tags.split(',').map(tag => tag.trim()).filter(Boolean);
            }
        }
        delete updateData.id; // This field should not be in the body, but good to be safe
        
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ error: 'ID sản phẩm không hợp lệ' });
        }
        
        const product = await Product.findByIdAndUpdate(
            productId,
            updateData,
            { new: true, runValidators: true }
        );
        
        if (!product) {
            return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
        }
        
        const responseProduct = {
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
        };
        
        res.json({
            success: true,
            message: 'Cập nhật sản phẩm thành công',
            product: responseProduct
        });
    } catch (error) {
        console.error('❌ Error updating product:', {
            productId: req.params.id,
            updateData: req.body,
            error: error
        });
        res.status(500).json({ error: 'Lỗi server khi cập nhật sản phẩm' });
    }
});

app.delete('/api/products/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const productId = req.params.id;
        
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ error: 'ID sản phẩm không hợp lệ' });
        }
        
        const product = await Product.findByIdAndDelete(productId);
        if (!product) {
            return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
        }
        
        res.json({
            success: true,
            message: 'Đã xóa sản phẩm thành công',
            deletedProduct: {
                id: product._id.toString(),
                name: product.name
            }
        });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Lỗi server khi xóa sản phẩm' });
    }
});

// ==================== ORDERS API ====================

app.get('/api/orders', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        
        let filter = {};
        if (status && status !== 'all') {
            filter.status = status;
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const orders = await Order.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await Order.countDocuments(filter);
        
        const formattedOrders = orders.map(order => ({
            id: order._id.toString(),
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            customerEmail: order.customerEmail,
            customerAddress: order.customerAddress,
            products: order.products,
            subtotal: order.subtotal,
            shippingFee: order.shippingFee,
            totalAmount: order.totalAmount,
            status: order.status,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            paymentScreenshot: order.paymentScreenshot,
            shippingInfo: order.shippingInfo,
            notes: order.notes,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
        }));
        
        res.json({
            orders: formattedOrders,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error getting orders:', error);
        res.status(500).json({ error: 'Lỗi server khi lấy đơn hàng' });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { 
            customerName, 
            customerPhone, 
            customerEmail, 
            customerAddress, 
            customerNote,
            products, 
            subtotal,
            shippingFee = 30000,
            totalAmount, 
            paymentScreenshot 
        } = req.body;
        
        if (!customerName || !customerPhone || !customerAddress || !products || !totalAmount) {
            return res.status(400).json({ error: 'Thiếu thông tin đơn hàng bắt buộc' });
        }
        
        // Calculate subtotal if not provided
        const calculatedSubtotal = subtotal || products.reduce((sum, product) => 
            sum + (product.price * (product.quantity || 1)), 0
        );
        
        const calculatedTotal = totalAmount || calculatedSubtotal + shippingFee;
        
        const newOrder = new Order({
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            customerEmail: customerEmail?.trim(),
            customerAddress: customerAddress.trim(),
            customerNote: customerNote?.trim(),
            products: products.map(p => ({
                id: p.id,
                name: p.name,
                price: p.price,
                quantity: p.quantity || 1,
                image: p.image,
                sku: p.sku
            })),
            subtotal: calculatedSubtotal,
            shippingFee: shippingFee,
            totalAmount: calculatedTotal,
            paymentScreenshot: paymentScreenshot || ''
        });
        
        await newOrder.save();
        
        // Update product sales and stock
        for (const item of products) {
            if (item.id && mongoose.Types.ObjectId.isValid(item.id)) {
                await Product.findByIdAndUpdate(item.id, {
                    $inc: { 
                        sales: item.quantity || 1,
                        stock: -(item.quantity || 1)
                    }
                });
            }
        }
        
        // Update statistics
        await updateStatistics();
        
        console.log(`🛒 New order created: ${newOrder.orderNumber} - ${customerName}`);
        
        const responseOrder = {
            id: newOrder._id.toString(),
            orderNumber: newOrder.orderNumber,
            customerName: newOrder.customerName,
            customerPhone: newOrder.customerPhone,
            customerEmail: newOrder.customerEmail,
            customerAddress: newOrder.customerAddress,
            products: newOrder.products,
            subtotal: newOrder.subtotal,
            shippingFee: newOrder.shippingFee,
            totalAmount: newOrder.totalAmount,
            status: newOrder.status,
            paymentMethod: newOrder.paymentMethod,
            paymentStatus: newOrder.paymentStatus,
            paymentScreenshot: newOrder.paymentScreenshot,
            createdAt: newOrder.createdAt,
            updatedAt: newOrder.updatedAt
        };
        
        res.status(201).json({
            success: true,
            message: 'Đơn hàng đã được tạo thành công',
            order: responseOrder
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Lỗi server khi tạo đơn hàng' });
    }
});

app.put('/api/orders/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status, note } = req.body;
        
        if (!Object.values(ORDER_STATUSES).includes(status)) {
            return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
        }
        
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ error: 'ID đơn hàng không hợp lệ' });
        }
        
        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
        }
        const updateData = {
            status: status,
            updatedAt: new Date()
        };
        
        // Add shipping info if status is shipping
        if (status === 'shipping') {
            order.shippingInfo = {
                shippedAt: new Date(),
                estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
            };
        }
        
        // Add note if provided
        if (note) {
            if (!order.notes) order.notes = [];
            order.notes.push({
                text: note,
                adminName: req.user.username,
                timestamp: new Date()
            });
        }

        order.status = status;
        order.updatedAt = new Date();
        const updatedOrder = await order.save();
        
        // Update statistics
        await updateStatistics();
        
        console.log(`✅ Order ${order.orderNumber} status changed to: ${status}`);
        
        res.json({
            success: true,
            message: 'Cập nhật trạng thái đơn hàng thành công',
            order: {
                id: updatedOrder._id.toString(),
                orderNumber: updatedOrder.orderNumber,
                status: updatedOrder.status,
                updatedAt: updatedOrder.updatedAt
            }
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Lỗi server khi cập nhật trạng thái đơn hàng' });
    }
});

// ==================== MESSAGES API ====================

app.get('/api/messages', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { status, unread, page = 1, limit = 20 } = req.query;
        
        let filter = {};
        
        if (status && status !== 'all') {
            filter.status = status;
        }
        
        if (unread === 'true') {
            filter.read = false;
            filter.isAdminReply = false;
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const messages = await Message.find(filter)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await Message.countDocuments(filter);
        const unreadCount = await Message.countDocuments({ read: false, isAdminReply: false });
        
        const formattedMessages = messages.map(message => ({
            id: message._id.toString(),
            text: message.text,
            type: message.type,
            product: message.product,
            timestamp: message.timestamp,
            read: message.read,
            isAutoResponse: message.isAutoResponse,
            isAdminReply: message.isAdminReply,
            priority: message.priority,
            customerInfo: message.customerInfo,
            replies: message.replies,
            status: message.status
        }));
        
        res.json({
            messages: formattedMessages,
            unreadCount,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({ error: 'Lỗi server khi lấy tin nhắn' });
    }
});

app.post('/api/messages', async (req, res) => {
    try {
        const { text, product, customerInfo } = req.body;
        
        if (!text || text.trim() === '') {
            return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
        }
        
        const newMessage = new Message({
            text: text.trim(),
            product: product || null,
            customerInfo: {
                ...customerInfo,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            }
        });
        
        await newMessage.save();
        
        console.log('💬 New message received from:', customerInfo?.name || 'Unknown');
        
        const responseMessage = {
            id: newMessage._id.toString(),
            text: newMessage.text,
            product: newMessage.product,
            timestamp: newMessage.timestamp,
            read: newMessage.read,
            isAutoResponse: newMessage.isAutoResponse,
            customerInfo: newMessage.customerInfo,
            replies: newMessage.replies,
            status: newMessage.status
        };
        
        res.status(201).json({
            success: true,
            message: 'Tin nhắn đã được gửi thành công',
            data: responseMessage
        });
    } catch (error) {
        console.error('Error creating message:', error);
        res.status(500).json({ error: 'Lỗi server khi gửi tin nhắn' });
    }
});

app.put('/api/messages/:id/read', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const messageId = req.params.id;
        
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
            success: true,
            message: 'Đã đánh dấu tin nhắn là đã đọc',
            data: {
                id: message._id.toString(),
                read: message.read
            }
        });
    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

app.post('/api/messages/:id/reply', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const messageId = req.params.id;
        const { text } = req.body;
        
        if (!text || text.trim() === '') {
            return res.status(400).json({ error: 'Nội dung phản hồi không được để trống' });
        }
        
        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ error: 'ID tin nhắn không hợp lệ' });
        }
        
        const message = await Message.findById(messageId);
        
        if (!message) {
            return res.status(404).json({ error: 'Không tìm thấy tin nhắn' });
        }
        
        if (!message.replies) {
            message.replies = [];
        }
        
        message.replies.push({
            text: text.trim(),
            adminName: req.user.username,
            adminId: req.user.userId
        });
        
        message.read = true;
        message.status = 'pending';
        
        await message.save();
        
        console.log(`📤 Admin ${req.user.username} replied to message: ${messageId}`);
        
        res.json({
            success: true,
            message: 'Phản hồi đã được gửi thành công',
            data: {
                id: message._id.toString(),
                replies: message.replies
            }
        });
    } catch (error) {
        console.error('Error replying to message:', error);
        res.status(500).json({ error: 'Lỗi server khi gửi phản hồi' });
    }
});

app.put('/api/messages/customer/:phone/read-all', authenticateToken, requireAdmin, async (req, res) => {
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

// ==================== SETTINGS API ====================

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

app.put('/api/settings', authenticateToken, requireAdmin, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings(req.body);
        } else {
            Object.assign(settings, req.body, { updatedAt: new Date() });
        }
        
        await settings.save();
        
        console.log('⚙️ Settings updated by admin:', req.user.username);
        
        res.json({
            success: true,
            message: 'Cài đặt đã được cập nhật',
            data: settings
        });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Lỗi server khi cập nhật cài đặt' });
    }
});

// ==================== STATISTICS & DASHBOARD API ====================

app.get('/api/statistics', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [
            productCount, messageCount, unreadMessages, visitorData,
            orderCount, pendingOrders, completedOrders, revenueData,
            recentOrders, recentMessages, monthlyRevenue
        ] = await Promise.all([
            Product.countDocuments({ status: 'active' }),
            Message.countDocuments(),
            Message.countDocuments({ read: false, isAdminReply: false }),
            Visitor.findOne(),
            Order.countDocuments(),
            Order.countDocuments({ status: ORDER_STATUSES.PENDING }),
            Order.countDocuments({ status: ORDER_STATUSES.DELIVERED }),
            Order.aggregate([{ $match: { status: ORDER_STATUSES.DELIVERED } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
            Order.find().sort({ createdAt: -1 }).limit(5).select('orderNumber customerName totalAmount status createdAt'),
            Message.find().sort({ timestamp: -1 }).limit(5).select('customerInfo text timestamp read'),
            Order.aggregate([
                { $match: { status: ORDER_STATUSES.DELIVERED } },
                { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
                { $sort: { '_id.year': -1, '_id.month': -1 } },
                { $limit: 6 }
            ])
        ]);
        
        const totalRevenue = revenueData[0]?.total || 0;
        
        const formattedMonthlyRevenue = monthlyRevenue.map(item => ({
            month: `${item._id.month}/${item._id.year}`,
            revenue: item.revenue,
            orders: item.orders
        })).reverse();
        
        res.json({
            overview: {
                totalProducts: productCount,
                totalOrders: orderCount,
                pendingOrders,
                completedOrders,
                totalRevenue,
                totalMessages: messageCount,
                unreadMessages,
                totalVisitors: visitorData?.total || 0,
                todayVisitors: visitorData?.today || 0
            },
            recentOrders,
            recentMessages,
            monthlyRevenue: formattedMonthlyRevenue
        });
    } catch (error) {
        console.error('Error getting statistics:', error);
        res.status(500).json({ error: 'Lỗi server khi lấy thống kê' });
    }
});

app.get('/api/dashboard', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [
            totalOrders,
            pendingOrders,
            completedOrders,
            totalProducts, totalMessages, unreadMessages,
            visitorData, recentOrders, recentMessages,
            revenueData
        ] = await Promise.all([
            Order.countDocuments(),
            Order.countDocuments({ status: ORDER_STATUSES.PENDING }),
            Order.countDocuments({ status: ORDER_STATUSES.DELIVERED }),
            Product.countDocuments({ status: 'active' }),
            Message.countDocuments(),
            Message.countDocuments({ read: false, isAdminReply: false }),
            Visitor.findOne(),
            Order.find().sort({ createdAt: -1 }).limit(5),
            Message.find().sort({ timestamp: -1 }).limit(5)
        ]);
        
        const revenueResult = await Order.aggregate([
            { $match: { status: ORDER_STATUSES.DELIVERED } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        
        const totalRevenue = revenueData[0]?.total || 0;
        
        res.json({
            overview: {
                totalOrders,
                pendingOrders,
                completedOrders,
                totalRevenue: revenueResult[0]?.total || 0,
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
        console.error('Error getting dashboard data:', error);
        res.status(500).json({ error: 'Lỗi server khi lấy dữ liệu dashboard' });
    }
});

// ==================== FILE UPLOAD API ====================

app.post('/api/upload', authenticateToken, requireAdmin, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Không có file được tải lên' });
        }
        
        const fileUrl = `/uploads/${req.file.filename}`;
        
        res.json({
            success: true,
            message: 'File uploaded successfully',
            file: {
                filename: req.file.filename,
                originalname: req.file.originalname,
                size: req.file.size,
                url: fileUrl
            }
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: 'Lỗi server khi tải file lên' });
    }
});

// ==================== CONTACT FORM API ====================

app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, phone, message, subject } = req.body;
        
        if (!name || !email || !message) {
            return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
        }
        
        const contactMessage = new Message({
            text: `[CONTACT] ${subject || 'Liên hệ từ website'}: ${message}`,
            type: 'contact',
            customerInfo: {
                name: name.trim(),
                email: email.trim(),
                phone: phone?.trim(),
                ip: req.ip,
                userAgent: req.get('User-Agent')
            },
            priority: 'high'
        });
        
        await contactMessage.save();
        
        console.log('📧 Contact form submission:', { name, email, phone });
        
        res.json({
            success: true,
            message: 'Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi sớm nhất có thể.'
        });
    } catch (error) {
        console.error('Error processing contact form:', error);
        res.status(500).json({ error: 'Đã có lỗi xảy ra khi gửi liên hệ' });
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

// SPA fallback
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
            return res.status(400).json({ error: 'File quá lớn. Kích thước tối đa là 10MB.' });
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
        
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true, // This option is deprecated but doesn't harm
            serverSelectionTimeoutMS: 10000, // Increased timeout for Render
            socketTimeoutMS: 45000,
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
            console.log('💡 Admin Login Credentials:');
            console.log('   👤 Username: Trucdaoadminlogin');
            console.log('   🔑 Password: Thanhduy@060596');
            console.log('   👤 Demo: demo / demo123');
            console.log('='.repeat(70));
            console.log('🔗 Available at: https://trucdaobodycare.onrender.com');
            console.log('🔗 Health check: https://trucdaobodycare.onrender.com/health');
            console.log('🔗 API Test: https://trucdaobodycare.onrender.com/api/test');
            console.log('='.repeat(70));
        });
        
        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Received SIGINT, shutting down gracefully...');
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
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;
