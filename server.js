const express = require('express');
const path = require('path');
const http = require('http');
const fs = require('fs');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

// ==================== RENDER.COM CONFIGURATION ====================
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 10000;

// Get base URL for Render.com
const getBaseUrl = () => {
    if (process.env.RENDER_EXTERNAL_URL) {
        return process.env.RENDER_EXTERNAL_URL;
    }
    return `http://localhost:${PORT}`;
};

console.log('🚀 Environment:', isProduction ? 'production' : 'development');
console.log('📍 Port:', PORT);
console.log('🌍 Base URL:', getBaseUrl());

// ==================== DATABASE SETUP ====================
const DB_FILE = path.join(__dirname, 'database.json');

// Initialize default database
const defaultDatabase = {
    products: [
        {
            id: 1,
            name: "Son lì cao cấp Luxury Matte",
            category: "Son môi",
            originalPrice: 399000,
            salePrice: 299000,
            image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
            description: "Son lì cao cấp với công thức mềm mịn, lâu trôi",
            createdAt: new Date().toISOString()
        },
        {
            id: 2,
            name: "Bảng phấn mắt 12 màu Pro Palette",
            category: "Trang điểm mắt",
            originalPrice: 600000,
            salePrice: 450000,
            image: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
            description: "Bảng phấn mắt đa dạng màu sắc, dễ phối màu",
            createdAt: new Date().toISOString()
        },
        {
            id: 3,
            name: "Kem nền che khuyết điểm Full Cover",
            category: "Trang điểm mặt",
            originalPrice: 650000,
            salePrice: 520000,
            image: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
            description: "Kem nền che phủ hoàn hảo, không gây bít tắc lỗ chân lông",
            createdAt: new Date().toISOString()
        },
        {
            id: 4,
            name: "Serum dưỡng ẩm chống lão hóa",
            category: "Chăm sóc da",
            originalPrice: 850000,
            salePrice: 680000,
            image: "https://images.unsplash.com/photo-1594035910387-fea47794261f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
            description: "Serum dưỡng ẩm chuyên sâu, cải thiện nếp nhăn",
            createdAt: new Date().toISOString()
        }
    ],
    messages: [],
    orders: [],
    visitors: { 
        total: 0, 
        today: 0, 
        date: new Date().toDateString(),
        history: []
    },
    settings: {
        siteTitle: "Trúc Đào Cosmetics",
        adminEmail: "admin@trucdaocosmetics.vn",
        maintenanceMode: false
    },
    statistics: {
        totalSales: 0,
        totalRevenue: 0,
        popularProducts: []
    }
};

// Database functions
function readDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            const database = JSON.parse(data);
            
            // Update visitor date if needed
            const today = new Date().toDateString();
            if (database.visitors.date !== today) {
                database.visitors.today = 0;
                database.visitors.date = today;
            }
            
            return database;
        }
    } catch (error) {
        console.error('❌ Error reading database:', error);
    }
    
    console.log('📂 Creating new database with default data');
    return JSON.parse(JSON.stringify(defaultDatabase));
}

function writeDatabase(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        console.log('💾 Database saved successfully');
        return true;
    } catch (error) {
        console.error('❌ Error writing database:', error);
        return false;
    }
}

// Initialize database
let database = readDatabase();

// Auto-save database every 5 minutes
setInterval(() => {
    writeDatabase(database);
}, 5 * 60 * 1000);

// ==================== MIDDLEWARE SETUP ====================
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(compression());

// CORS configuration
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
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
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isProduction ? 500 : 1000, // Lower limit in production
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
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
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
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: {
            products: database.products.length,
            messages: database.messages.length,
            orders: database.orders.length,
            visitors: database.visitors.total
        }
    });
});

// ==================== API ROUTES ====================

// API info
app.get('/api/info', (req, res) => {
    res.json({
        server: {
            name: 'Trúc Đào Cosmetics API',
            version: '1.0.0',
            environment: isProduction ? 'production' : 'development',
            baseUrl: getBaseUrl()
        },
        database: {
            products: database.products.length,
            messages: database.messages.length,
            orders: database.orders.length,
            unreadMessages: database.messages.filter(m => !m.read).length,
            visitors: database.visitors.total
        },
        timestamp: new Date().toISOString()
    });
});

// Visitor tracking
app.post('/api/visitors', (req, res) => {
    const today = new Date().toDateString();
    const now = new Date();
    
    if (database.visitors.date !== today) {
        database.visitors.today = 0;
        database.visitors.date = today;
    }
    
    database.visitors.total++;
    database.visitors.today++;
    
    // Add to history
    database.visitors.history.push({
        timestamp: now.toISOString(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    
    // Keep only last 1000 records
    if (database.visitors.history.length > 1000) {
        database.visitors.history = database.visitors.history.slice(-1000);
    }
    
    writeDatabase(database);
    
    res.json({
        total: database.visitors.total,
        today: database.visitors.today,
        date: database.visitors.date
    });
});

// Products API
app.get('/api/products', (req, res) => {
    res.json(database.products);
});

app.post('/api/products', (req, res) => {
    try {
        const { name, category, originalPrice, salePrice, image, description } = req.body;
        
        if (!name || !category || !originalPrice || !salePrice || !image) {
            return res.status(400).json({
                error: 'Thiếu thông tin sản phẩm bắt buộc'
            });
        }
        
        const newProduct = {
            id: Date.now(),
            name,
            category,
            originalPrice: parseInt(originalPrice),
            salePrice: parseInt(salePrice),
            image,
            description: description || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        database.products.push(newProduct);
        writeDatabase(database);
        
        res.status(201).json(newProduct);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Lỗi server khi tạo sản phẩm' });
    }
});

app.put('/api/products/:id', (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const productIndex = database.products.findIndex(p => p.id === productId);
        
        if (productIndex === -1) {
            return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
        }
        
        const { name, category, originalPrice, salePrice, image, description } = req.body;
        
        database.products[productIndex] = {
            ...database.products[productIndex],
            ...(name && { name }),
            ...(category && { category }),
            ...(originalPrice && { originalPrice: parseInt(originalPrice) }),
            ...(salePrice && { salePrice: parseInt(salePrice) }),
            ...(image && { image }),
            ...(description && { description }),
            updatedAt: new Date().toISOString()
        };
        
        writeDatabase(database);
        res.json(database.products[productIndex]);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Lỗi server khi cập nhật sản phẩm' });
    }
});

app.delete('/api/products/:id', (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const initialLength = database.products.length;
        
        database.products = database.products.filter(p => p.id !== productId);
        
        if (database.products.length === initialLength) {
            return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
        }
        
        writeDatabase(database);
        res.json({ message: 'Đã xóa sản phẩm thành công' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Lỗi server khi xóa sản phẩm' });
    }
});

// Messages API
app.get('/api/messages', (req, res) => {
    res.json(database.messages);
});

app.post('/api/messages', async (req, res) => {
    try {
        const { text, product, isAutoResponse, isAdminReply, originalMessageId, customerInfo } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
        }
        
        const newMessage = {
            id: Date.now(),
            text: text.trim(),
            product: product || null,
            timestamp: new Date().toISOString(),
            read: false,
            isAutoResponse: isAutoResponse || false,
            isAdminReply: isAdminReply || false,
            originalMessageId: originalMessageId || null,
            customerInfo: customerInfo || null,
            replies: []
        };
        
        database.messages.push(newMessage);
        writeDatabase(database);
        
        res.status(201).json(newMessage);
    } catch (error) {
        console.error('Error creating message:', error);
        res.status(500).json({ error: 'Lỗi server khi gửi tin nhắn' });
    }
});

// Mark message as read
app.put('/api/messages/:id/read', (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const message = database.messages.find(m => m.id === messageId);
        
        if (!message) {
            return res.status(404).json({ error: 'Không tìm thấy tin nhắn' });
        }
        
        message.read = true;
        writeDatabase(database);
        
        res.json(message);
    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Reply to message
app.post('/api/messages/:id/reply', (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const { text, adminName } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Nội dung phản hồi không được để trống' });
        }
        
        const parentMessage = database.messages.find(m => m.id === messageId);
        
        if (!parentMessage) {
            return res.status(404).json({ error: 'Không tìm thấy tin nhắn' });
        }
        
        const replyMessage = {
            id: Date.now(),
            text: text.trim(),
            timestamp: new Date().toISOString(),
            isAdminReply: true,
            adminName: adminName || 'Admin'
        };
        
        if (!parentMessage.replies) {
            parentMessage.replies = [];
        }
        
        parentMessage.replies.push(replyMessage);
        parentMessage.read = true;
        
        writeDatabase(database);
        
        res.json({
            parentMessage,
            reply: replyMessage
        });
    } catch (error) {
        console.error('Error replying to message:', error);
        res.status(500).json({ error: 'Lỗi server khi gửi phản hồi' });
    }
});

// Mark all messages as read for a customer
app.put('/api/messages/customer/:phone/read-all', (req, res) => {
    try {
        const customerPhone = req.params.phone;
        let updatedCount = 0;
        
        database.messages.forEach(message => {
            if (message.customerInfo && 
                message.customerInfo.phone === customerPhone && 
                !message.read && 
                !message.isAdminReply) {
                message.read = true;
                updatedCount++;
            }
        });
        
        writeDatabase(database);
        
        res.json({
            success: true,
            message: `Đã đánh dấu ${updatedCount} tin nhắn là đã đọc`,
            updatedCount
        });
    } catch (error) {
        console.error('Error marking all messages as read:', error);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// Orders API
app.get('/api/orders', (req, res) => {
    res.json(database.orders || []);
});

app.post('/api/orders', (req, res) => {
    try {
        const { customerName, customerPhone, customerAddress, products, totalAmount, paymentScreenshot } = req.body;
        
        if (!customerName || !customerPhone || !customerAddress || !products || !totalAmount) {
            return res.status(400).json({
                error: 'Thiếu thông tin đơn hàng bắt buộc'
            });
        }
        
        const newOrder = {
            id: Date.now(),
            customerName,
            customerPhone,
            customerAddress,
            products: Array.isArray(products) ? products : [],
            totalAmount: parseInt(totalAmount),
            status: 'pending',
            paymentMethod: 'bank_transfer',
            paymentScreenshot: paymentScreenshot || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        if (!database.orders) {
            database.orders = [];
        }
        
        database.orders.push(newOrder);
        writeDatabase(database);
        
        // Update statistics
        updateOrderStatistics();
        
        res.status(201).json(newOrder);
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Lỗi server khi tạo đơn hàng' });
    }
});

app.put('/api/orders/:id/status', (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const { status } = req.body;
        
        if (!database.orders) {
            return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
        }
        
        const orderIndex = database.orders.findIndex(o => o.id === orderId);
        
        if (orderIndex === -1) {
            return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
        }
        
        const validStatuses = ['pending', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
        }
        
        database.orders[orderIndex].status = status;
        database.orders[orderIndex].updatedAt = new Date().toISOString();
        
        writeDatabase(database);
        
        // Update statistics
        updateOrderStatistics();
        
        res.json(database.orders[orderIndex]);
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Lỗi server khi cập nhật trạng thái đơn hàng' });
    }
});

// Get order statistics
app.get('/api/orders/statistics', (req, res) => {
    try {
        if (!database.orders) {
            database.orders = [];
        }
        
        const totalOrders = database.orders.length;
        const pendingOrders = database.orders.filter(o => o.status === 'pending').length;
        const completedOrders = database.orders.filter(o => o.status === 'completed').length;
        const cancelledOrders = database.orders.filter(o => o.status === 'cancelled').length;
        const totalRevenue = database.orders
            .filter(o => o.status === 'completed')
            .reduce((sum, order) => sum + order.totalAmount, 0);
        
        const uniqueCustomers = new Set(database.orders.map(o => o.customerPhone)).size;
        
        res.json({
            totalOrders,
            pendingOrders,
            completedOrders,
            cancelledOrders,
            totalRevenue,
            uniqueCustomers,
            averageOrderValue: completedOrders > 0 ? Math.round(totalRevenue / completedOrders) : 0
        });
    } catch (error) {
        console.error('Error getting order statistics:', error);
        res.status(500).json({ error: 'Lỗi server khi lấy thống kê đơn hàng' });
    }
});

// Contact form
app.post('/api/contact', (req, res) => {
    try {
        const { name, email, message, phone } = req.body;
        
        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
            });
        }
        
        const contactMessage = {
            id: Date.now(),
            text: `Liên hệ từ: ${name} (${email}${phone ? ` - ${phone}` : ''}) - ${message}`,
            timestamp: new Date().toISOString(),
            read: false,
            type: 'contact_form',
            customerInfo: { name, email, phone }
        };
        
        database.messages.push(contactMessage);
        writeDatabase(database);
        
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
app.get('/api/settings', (req, res) => {
    res.json(database.settings);
});

app.put('/api/settings', (req, res) => {
    try {
        database.settings = { ...database.settings, ...req.body };
        writeDatabase(database);
        res.json(database.settings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Lỗi server khi cập nhật cài đặt' });
    }
});

// Statistics API
app.get('/api/statistics', (req, res) => {
    const statistics = {
        ...database.statistics,
        totalProducts: database.products.length,
        totalMessages: database.messages.length,
        unreadMessages: database.messages.filter(m => !m.read).length,
        totalVisitors: database.visitors.total,
        todayVisitors: database.visitors.today,
        totalOrders: database.orders ? database.orders.length : 0,
        completedOrders: database.orders ? database.orders.filter(o => o.status === 'completed').length : 0,
        totalRevenue: database.orders ? 
            database.orders.filter(o => o.status === 'completed').reduce((sum, order) => sum + order.totalAmount, 0) : 0
    };
    
    res.json(statistics);
});

// Dashboard API - Tổng hợp tất cả thông tin cho dashboard
app.get('/api/dashboard', (req, res) => {
    try {
        // Order statistics
        const totalOrders = database.orders ? database.orders.length : 0;
        const pendingOrders = database.orders ? database.orders.filter(o => o.status === 'pending').length : 0;
        const completedOrders = database.orders ? database.orders.filter(o => o.status === 'completed').length : 0;
        const totalRevenue = database.orders ? 
            database.orders.filter(o => o.status === 'completed').reduce((sum, order) => sum + order.totalAmount, 0) : 0;
        
        // Customer statistics
        const uniqueCustomers = database.orders ? new Set(database.orders.map(o => o.customerPhone)).size : 0;
        
        // Message statistics
        const unreadMessages = database.messages.filter(m => !m.read && !m.isAdminReply).length;
        
        // Recent orders (last 5)
        const recentOrders = database.orders ? 
            database.orders
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5)
                .map(order => ({
                    id: order.id,
                    customerName: order.customerName,
                    customerPhone: order.customerPhone,
                    totalAmount: order.totalAmount,
                    status: order.status,
                    createdAt: order.createdAt
                })) : [];
        
        // Recent messages (last 5)
        const recentMessages = database.messages
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 5)
            .map(message => ({
                id: message.id,
                customerName: message.customerInfo ? message.customerInfo.name : 'Khách hàng',
                text: message.text.length > 50 ? message.text.substring(0, 50) + '...' : message.text,
                timestamp: message.timestamp,
                read: message.read
            }));
        
        // Popular products (based on orders)
        const productSales = {};
        if (database.orders) {
            database.orders.forEach(order => {
                if (order.status === 'completed') {
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
                }
            });
        }
        
        const popularProducts = Object.values(productSales)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);
        
        res.json({
            overview: {
                totalOrders,
                pendingOrders,
                completedOrders,
                totalRevenue,
                uniqueCustomers,
                unreadMessages,
                totalProducts: database.products.length,
                totalVisitors: database.visitors.total
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

// Update order statistics
function updateOrderStatistics() {
    if (!database.orders) return;
    
    const completedOrders = database.orders.filter(o => o.status === 'completed');
    
    database.statistics.totalSales = completedOrders.length;
    database.statistics.totalRevenue = completedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    
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
    
    database.statistics.popularProducts = Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);
    
    writeDatabase(database);
}

// ==================== ERROR HANDLING ====================

// 404 for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint không tồn tại',
        path: req.originalUrl,
        availableEndpoints: [
            'GET /api/info',
            'GET /api/products',
            'POST /api/products',
            'PUT /api/products/:id',
            'DELETE /api/products/:id',
            'GET /api/messages',
            'POST /api/messages',
            'PUT /api/messages/:id/read',
            'POST /api/messages/:id/reply',
            'PUT /api/messages/customer/:phone/read-all',
            'GET /api/orders',
            'POST /api/orders',
            'PUT /api/orders/:id/status',
            'GET /api/orders/statistics',
            'POST /api/contact',
            'GET /api/settings',
            'PUT /api/settings',
            'GET /api/statistics',
            'GET /api/dashboard',
            'POST /api/visitors'
        ]
    });
});

// SPA fallback - serve index.html for all other routes
app.use('*', (req, res) => {
    if (req.accepts('html')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else if (req.accepts('json')) {
        res.status(404).json({
            success: false,
            message: 'Route không tồn tại',
            path: req.originalUrl
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

// ==================== SERVER STARTUP ====================

const server = http.createServer(app);

// Graceful shutdown
function gracefulShutdown(signal) {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    
    // Save database before shutdown
    writeDatabase(database);
    
    server.close((err) => {
        if (err) {
            console.error('❌ Error during shutdown:', err);
            process.exit(1);
        }
        
        console.log('✅ HTTP server closed');
        console.log('💾 Database saved');
        console.log('🔄 Process exited');
        process.exit(0);
    });

    // Force close after 8 seconds
    setTimeout(() => {
        console.log('⚠️ Forcing shutdown after timeout');
        process.exit(1);
    }, 8000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 TRÚC ĐÀO COSMETICS SERVER STARTED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log('📍 Access URLs:');
    console.log(`   📱 Local: http://localhost:${PORT}`);
    console.log(`   🌐 Network: http://[YOUR_IP]:${PORT}`);
    console.log(`   🌍 Production: https://trucdaobodycare.onrender.com`);
    console.log('\n💾 Database Status:');
    console.log(`   📦 Products: ${database.products.length}`);
    console.log(`   💬 Messages: ${database.messages.length}`);
    console.log(`   📋 Orders: ${database.orders ? database.orders.length : 0}`);
    console.log(`   👥 Total Visitors: ${database.visitors.total}`);
    console.log(`   📊 Today Visitors: ${database.visitors.today}`);
    console.log('\n🛡️ Security Features:');
    console.log('   ✅ Helmet.js security headers');
    console.log('   ✅ Rate limiting enabled');
    console.log('   ✅ CORS configured');
    console.log('   ✅ Gzip compression');
    console.log('   ✅ Request logging');
    console.log('\n⏰ Server started at:', new Date().toISOString());
    console.log('💻 Environment:', isProduction ? 'production' : 'development');
    console.log('💾 Memory usage:', `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`);
    console.log('='.repeat(70));
});

module.exports = app;
