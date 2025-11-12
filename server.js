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

// ==================== MIDDLEWARE ====================
app.use(helmet({
    contentSecurityPolicy: false, // Tắt CSP để tránh block resources
    crossOriginEmbedderPolicy: false
}));

app.use(compression());
app.use(cors({
    origin: '*', // Cho phép tất cả domains
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

// ==================== STATIC FILES - QUAN TRỌNG ====================
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    index: 'index.html',
    setHeaders: (res, filePath) => {
        // Set proper content type for HTML files
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

// Home page - QUAN TRỌNG: Phục vụ index.html
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
        timestamp: new Date().toISOString()
    });
});

// Mock Products API - THÊM API MỚI
let products = [
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
    }
];

// Products API Routes
app.get('/api/products', (req, res) => {
    res.json(products);
});

app.post('/api/products', (req, res) => {
    const newProduct = {
        id: products.length + 1,
        ...req.body,
        createdAt: new Date().toISOString()
    };
    products.push(newProduct);
    res.json(newProduct);
});

app.put('/api/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const productIndex = products.findIndex(p => p.id === productId);
    
    if (productIndex !== -1) {
        products[productIndex] = { ...products[productIndex], ...req.body };
        res.json(products[productIndex]);
    } else {
        res.status(404).json({ error: 'Product not found' });
    }
});

app.delete('/api/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    products = products.filter(p => p.id !== productId);
    res.json({ message: 'Product deleted successfully' });
});

// Messages API - THÊM API MỚI
let messages = [];

app.get('/api/messages', (req, res) => {
    res.json(messages);
});

app.post('/api/messages', (req, res) => {
    const newMessage = {
        id: messages.length + 1,
        ...req.body,
        timestamp: new Date().toISOString(),
        read: false
    };
    messages.push(newMessage);
    res.json(newMessage);
});

app.put('/api/messages/:id/read', (req, res) => {
    const messageId = parseInt(req.params.id);
    const message = messages.find(m => m.id === messageId);
    
    if (message) {
        message.read = true;
        res.json(message);
    } else {
        res.status(404).json({ error: 'Message not found' });
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

// 404 handler for frontend routes - QUAN TRỌNG
app.use('*', (req, res) => {
    if (req.accepts('html')) {
        // Serve index.html for all other routes (SPA behavior)
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
    console.log(`   🌐 Network: http://[YOUR_IP]:${PORT}`);
    console.log(`   🌍 Render: https://trucdaobodycare.onrender.com`);
    console.log('\n🛡️ Security Features:');
    console.log('   ✅ Helmet.js security headers');
    console.log('   ✅ Rate limiting (1000 req/15min)');
    console.log('   ✅ CORS enabled');
    console.log('   ✅ Gzip compression');
    console.log('   ✅ Request logging');
    console.log('\n📊 APIs Available:');
    console.log('   GET  /api/health - Health check');
    console.log('   GET  /api/info - Server information');
    console.log('   GET  /api/products - Get all products');
    console.log('   POST /api/products - Create product');
    console.log('   PUT  /api/products/:id - Update product');
    console.log('   DELETE /api/products/:id - Delete product');
    console.log('   GET  /api/messages - Get all messages');
    console.log('   POST /api/messages - Create message');
    console.log('   POST /api/contact - Contact form');
    console.log('\n⏰ Server started at:', new Date().toISOString());
    console.log('💻 Environment:', process.env.NODE_ENV || 'development');
    console.log('💾 Memory usage:', `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`);
    console.log('='.repeat(60));
});

module.exports = app;
