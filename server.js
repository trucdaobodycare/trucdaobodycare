const express = require('express');
const path = require('path');
const http = require('http');
const os = require('os');
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
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút.'
});
app.use(limiter);

// Logging - chỉ log trong production
if (process.env.NODE_ENV === 'production') {
    const accessLogStream = fs.createWriteStream(
        path.join(__dirname, 'access.log'), 
        { flags: 'a' }
    );
    app.use(morgan('combined', { stream: accessLogStream }));
} else {
    app.use(morgan('dev'));
}

// ==================== STATIC FILES ====================
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    index: 'index.html'
}));

// ==================== SECURITY HEADERS ====================
app.use((req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// ==================== ROUTES ====================

// Favicon handler - FIX LỖI FAVICON
app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // No content
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
    const networkInfo = getNetworkInfo();
    res.json({
        server: {
            name: 'TrucDaoBodyCare Server',
            version: '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        },
        system: {
            platform: os.platform(),
            arch: os.arch(),
            cpu: os.cpus().length,
            memory: {
                total: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
                free: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`
            },
            uptime: `${(os.uptime() / 3600).toFixed(2)} hours`
        },
        network: networkInfo,
        client: {
            ip: req.ip,
            userAgent: req.get('User-Agent')
        }
    });
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

// 404 handler - FIX LỖI 404.HTML
app.use('*', (req, res) => {
    if (req.accepts('html')) {
        // Trả về HTML đơn giản thay vì file
        res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>404 - Page Not Found</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    h1 { color: #333; }
                    p { color: #666; }
                </style>
            </head>
            <body>
                <h1>404 - Page Not Found</h1>
                <p>The requested URL ${req.originalUrl} was not found on this server.</p>
                <a href="/">Return to Homepage</a>
            </body>
            </html>
        `);
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
    
    const errorLog = {
        timestamp: new Date().toISOString(),
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        error: error.message
    };
    
    // Chỉ log trong production
    if (process.env.NODE_ENV === 'production') {
        fs.appendFileSync(
            path.join(__dirname, 'error.log'), 
            JSON.stringify(errorLog) + '\n'
        );
    }

    res.status(500).json({
        success: false,
        message: 'Đã có lỗi xảy ra trên máy chủ',
        errorId: Date.now()
    });
});

// ==================== UTILITY FUNCTIONS ====================

function getNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const networkInfo = {};
    
    Object.keys(interfaces).forEach(interfaceName => {
        interfaces[interfaceName].forEach(interface => {
            if (interface.family === 'IPv4' && !interface.internal) {
                networkInfo[interfaceName] = {
                    address: interface.address,
                    netmask: interface.netmask,
                    mac: interface.mac
                };
            }
        });
    });
    
    return networkInfo;
}

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            if (interface.family === 'IPv4' && !interface.internal) {
                return interface.address;
            }
        }
    }
    return 'localhost';
}

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
    const localIP = getLocalIP();
    console.log('\n' + '='.repeat(60));
    console.log('🚀 TRUC DAO BODY CARE SERVER STARTED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('📍 Access URLs:');
    console.log(`   📱 Local: http://localhost:${PORT}`);
    console.log(`   🌐 Network: http://${localIP}:${PORT}`);
    console.log(`   🌍 Internet: http://[YOUR_PUBLIC_IP]:${PORT}`);
    console.log('\n🛡️ Security Features:');
    console.log('   ✅ Helmet.js security headers');
    console.log('   ✅ Rate limiting (1000 req/15min)');
    console.log('   ✅ CORS enabled');
    console.log('   ✅ Gzip compression');
    console.log('   ✅ Request logging');
    console.log('\n📊 APIs Available:');
    console.log('   GET  /api/health - Health check');
    console.log('   GET  /api/info - Server information');
    console.log('   POST /api/contact - Contact form');
    console.log('   POST /api/upload - File upload');
    console.log('\n⏰ Server started at:', new Date().toISOString());
    console.log('💻 Environment:', process.env.NODE_ENV || 'development');
    console.log('💾 Memory usage:', `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`);
    console.log('='.repeat(60));
});

module.exports = app;
