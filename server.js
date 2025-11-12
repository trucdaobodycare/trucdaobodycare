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
const PORT = process.env.PORT || 10000;

// ==================== SIMPLE DATABASE ====================
const DB_FILE = path.join(__dirname, 'database.json');

// Hàm đọc database
function readDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading database:', error);
    }
    
    // Database mặc định nếu file không tồn tại
    return {
        products: [
            {
                id: 1,
                name: "Son lì cao cấp Luxury Matte",
                category: "Son môi",
                originalPrice: 399000,
                salePrice: 299000,
                image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
                description: "Son lì cao cấp với công thức mềm mịn, lâu trôi"
            },
            {
                id: 2,
                name: "Bảng phấn mắt 12 màu Pro Palette",
                category: "Trang điểm mắt",
                originalPrice: 600000,
                salePrice: 450000,
                image: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
                description: "Bảng phấn mắt đa dạng màu sắc, dễ phối màu"
            },
            {
                id: 3,
                name: "Kem nền che khuyết điểm Full Cover",
                category: "Trang điểm mặt",
                originalPrice: 650000,
                salePrice: 520000,
                image: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
                description: "Kem nền che phủ hoàn hảo, không gây bít tắc lỗ chân lông"
            },
            {
                id: 4,
                name: "Serum dưỡng ẩm chống lão hóa",
                category: "Chăm sóc da",
                originalPrice: 850000,
                salePrice: 680000,
                image: "https://images.unsplash.com/photo-1594035910387-fea47794261f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1180&q=80",
                description: "Serum dưỡng ẩm chuyên sâu, cải thiện nếp nhăn"
            }
        ],
        messages: [],
        visitors: { total: 0, today: 0, date: new Date().toDateString() },
        settings: {
            siteTitle: "Trúc Đào Cosmetics",
            adminEmail: "admin@trucdaocosmetics.vn"
        }
    };
}

// Hàm ghi database
function writeDatabase(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing database:', error);
        return false;
    }
}

// Khởi tạo database
let database = readDatabase();

// ==================== MIDDLEWARE ====================
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(compression());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút.'
});
app.use(limiter);

// Logging
app.use(morgan('combined'));

// ==================== STATIC FILES ====================
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    index: 'index.html',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
    }
}));

// ==================== SECURITY HEADERS ====================
app.use((req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// ==================== ROUTES ====================

// Favicon handler
app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});

// Home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check API
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Server is running smoothly',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0'
    });
});

// Server info API
app.get('/api/info', (req, res) => {
    res.json({
        server: {
            name: 'Trúc Đào Cosmetics Server',
            version: '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        },
        database: {
            products: database.products.length,
            messages: database.messages.length,
            unreadMessages: database.messages.filter(m => !m.read).length
        },
        timestamp: new Date().toISOString()
    });
});

// Visitor count API
app.post('/api/visitors', (req, res) => {
    const today = new Date().toDateString();
    if (database.visitors.date !== today) {
        database.visitors.today = 0;
        database.visitors.date = today;
    }
    database.visitors.total++;
    database.visitors.today++;
    
    writeDatabase(database);
    
    res.json(database.visitors);
});

// Products API Routes
app.get('/api/products', (req, res) => {
    res.json(database.products);
});

app.post('/api/products', (req, res) => {
    const newProduct = {
        id: Date.now(), // Sử dụng timestamp làm ID
        ...req.body,
        createdAt: new Date().toISOString()
    };
    database.products.push(newProduct);
    
    if (writeDatabase(database)) {
        res.json(newProduct);
    } else {
        res.status(500).json({ error: 'Failed to save product' });
    }
});

app.put('/api/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const productIndex = database.products.findIndex(p => p.id === productId);
    
    if (productIndex !== -1) {
        database.products[productIndex] = { 
            ...database.products[productIndex], 
            ...req.body,
            updatedAt: new Date().toISOString()
        };
        
        if (writeDatabase(database)) {
            res.json(database.products[productIndex]);
        } else {
            res.status(500).json({ error: 'Failed to update product' });
        }
    } else {
        res.status(404).json({ error: 'Product not found' });
    }
});

app.delete('/api/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    database.products = database.products.filter(p => p.id !== productId);
    
    if (writeDatabase(database)) {
        res.json({ message: 'Product deleted successfully' });
    } else {
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// Messages API với tính năng TRẢ LỜI
app.get('/api/messages', (req, res) => {
    res.json(database.messages);
});

app.post('/api/messages', (req, res) => {
    const newMessage = {
        id: Date.now(),
        text: req.body.text,
        product: req.body.product || null,
        timestamp: new Date().toISOString(),
        read: false,
        isAutoResponse: req.body.isAutoResponse || false,
        isAdminReply: req.body.isAdminReply || false,
        originalMessageId: req.body.originalMessageId || null,
        replies: [] // Thêm mảng replies để lưu các phản hồi
    };
    
    database.messages.push(newMessage);
    
    if (writeDatabase(database)) {
        res.json(newMessage);
    } else {
        res.status(500).json({ error: 'Failed to save message' });
    }
});

// API để trả lời tin nhắn
app.post('/api/messages/:id/reply', (req, res) => {
    const messageId = parseInt(req.params.id);
    const parentMessage = database.messages.find(m => m.id === messageId);
    
    if (!parentMessage) {
        return res.status(404).json({ error: 'Message not found' });
    }
    
    const replyMessage = {
        id: Date.now(),
        text: req.body.text,
        timestamp: new Date().toISOString(),
        isAdminReply: true,
        adminName: req.body.adminName || 'Admin'
    };
    
    // Thêm reply vào tin nhắn gốc
    if (!parentMessage.replies) {
        parentMessage.replies = [];
    }
    parentMessage.replies.push(replyMessage);
    
    // Đánh dấu tin nhắn gốc đã đọc
    parentMessage.read = true;
    
    if (writeDatabase(database)) {
        res.json({
            parentMessage,
            reply: replyMessage
        });
    } else {
        res.status(500).json({ error: 'Failed to save reply' });
    }
});

app.put('/api/messages/:id/read', (req, res) => {
    const messageId = parseInt(req.params.id);
    const message = database.messages.find(m => m.id === messageId);
    
    if (message) {
        message.read = true;
        
        if (writeDatabase(database)) {
            res.json(message);
        } else {
            res.status(500).json({ error: 'Failed to update message' });
        }
    } else {
        res.status(404).json({ error: 'Message not found' });
    }
});

// Settings API
app.get('/api/settings', (req, res) => {
    res.json(database.settings);
});

app.put('/api/settings', (req, res) => {
    database.settings = { ...database.settings, ...req.body };
    
    if (writeDatabase(database)) {
        res.json(database.settings);
    } else {
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// Contact form endpoint
app.post('/api/contact', (req, res) => {
    const { name, email, message, phone } = req.body;
    
    if (!name || !email || !message) {
        return res.status(400).json({
            success: false,
            message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
        });
    }

    // Lưu tin nhắn liên hệ
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

    console.log('Contact form submission:', { name, email, phone, message });
    
    res.json({
        success: true,
        message: 'Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi sớm nhất.',
        data: { name, email, phone }
    });
});

// ==================== ERROR HANDLING ====================

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API route not found',
        path: req.originalUrl
    });
});

// 404 handler for frontend routes
app.use('*', (req, res) => {
    if (req.accepts('html')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else if (req.accepts('json')) {
        res.status(404).json({
            success: false,
            message: 'Route not found',
            path: req.originalUrl
        });
    } else {
        res.status(404).type('txt').send('404 Not Found');
    }
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Server Error:', error);
    
    res.status(500).json({
        success: false,
        message: 'Đã có lỗi xảy ra trên máy chủ',
        errorId: Date.now()
    });
});

// ==================== SERVER STARTUP ====================

const server = http.createServer(app);

// Graceful shutdown
function gracefulShutdown(signal) {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    
    server.close((err) => {
        if (err) {
            console.error('Error during shutdown:', err);
            process.exit(1);
        }
        
        console.log('✅ HTTP server closed');
        process.exit(0);
    });

    setTimeout(() => {
        console.log('⚠️ Forcing shutdown after timeout');
        process.exit(1);
    }, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 TRÚC ĐÀO COSMETICS SERVER STARTED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('📍 Access URLs:');
    console.log(`   📱 Local: http://localhost:${PORT}`);
    console.log(`   🌍 Production: https://trucdaobodycare.onrender.com`);
    console.log('\n💾 Database Features:');
    console.log('   ✅ Persistent data storage');
    console.log('   ✅ Real-time message replies');
    console.log('   ✅ Product management');
    console.log('   ✅ Visitor tracking');
    console.log('\n📊 Current Stats:');
    console.log(`   📦 Products: ${database.products.length}`);
    console.log(`   💬 Messages: ${database.messages.length}`);
    console.log(`   👥 Total Visitors: ${database.visitors.total}`);
    console.log('\n⏰ Server started at:', new Date().toISOString());
    console.log('💻 Environment:', process.env.NODE_ENV || 'development');
    console.log('='.repeat(60));
});

module.exports = app;
