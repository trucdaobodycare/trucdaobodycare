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
        console.log('? Ðã k?t n?i MongoDB Atlas thành công!');
        
        // T?o collections n?u chua t?n t?i
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        if (!collectionNames.includes('products')) {
            await db.createCollection('products');
            console.log('?? Ðã t?o collection products');
        }
        
        if (!collectionNames.includes('orders')) {
            await db.createCollection('orders');
            console.log('?? Ðã t?o collection orders');
        }
        
        if (!collectionNames.includes('messages')) {
            await db.createCollection('messages');
            console.log('?? Ðã t?o collection messages');
        }
        
        return db;
    } catch (error) {
        console.error('? L?i k?t n?i MongoDB:', error);
        process.exit(1);
    }
}

// API Routes

// L?y t?t c? s?n ph?m
app.get('/api/products', async (req, res) => {
    try {
        const products = await db.collection('products').find().toArray();
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'L?i khi t?i s?n ph?m' });
    }
});

// Thêm s?n ph?m m?i
app.post('/api/products', async (req, res) => {
    try {
        const product = {
            ...req.body,
            createdAt: new Date()
        };
        const result = await db.collection('products').insertOne(product);
        res.status(201).json({ ...product, _id: result.insertedId });
    } catch (error) {
        res.status(400).json({ error: 'L?i khi thêm s?n ph?m' });
    }
});

// C?p nh?t s?n ph?m
app.put('/api/products/:id', async (req, res) => {
    try {
        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: req.body }
        );
        res.json({ message: 'Ðã c?p nh?t s?n ph?m', modifiedCount: result.modifiedCount });
    } catch (error) {
        res.status(400).json({ error: 'L?i khi c?p nh?t s?n ph?m' });
    }
});

// Xóa s?n ph?m
app.delete('/api/products/:id', async (req, res) => {
    try {
        const result = await db.collection('products').deleteOne(
            { _id: new ObjectId(req.params.id) }
        );
        res.json({ message: 'Ðã xóa s?n ph?m', deletedCount: result.deletedCount });
    } catch (error) {
        res.status(400).json({ error: 'L?i khi xóa s?n ph?m' });
    }
});

// Luu don hàng
app.post('/api/orders', async (req, res) => {
    try {
        const order = {
            ...req.body,
            status: 'pending',
            createdAt: new Date()
        };
        const result = await db.collection('orders').insertOne(order);
        res.status(201).json({ ...order, _id: result.insertedId });
    } catch (error) {
        res.status(400).json({ error: 'L?i khi luu don hàng' });
    }
});

// L?y t?t c? don hàng
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await db.collection('orders').find().sort({ createdAt: -1 }).toArray();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'L?i khi t?i don hàng' });
    }
});

// Luu tin nh?n
app.post('/api/messages', async (req, res) => {
    try {
        const message = {
            ...req.body,
            read: false,
            createdAt: new Date()
        };
        const result = await db.collection('messages').insertOne(message);
        res.status(201).json({ ...message, _id: result.insertedId });
    } catch (error) {
        res.status(400).json({ error: 'L?i khi luu tin nh?n' });
    }
});

// L?y t?t c? tin nh?n
app.get('/api/messages', async (req, res) => {
    try {
        const messages = await db.collection('messages').find().sort({ createdAt: -1 }).toArray();
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'L?i khi t?i tin nh?n' });
    }
});

// Ðánh d?u tin nh?n dã d?c
app.put('/api/messages/:id/read', async (req, res) => {
    try {
        const result = await db.collection('messages').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { read: true } }
        );
        res.json({ message: 'Ðã dánh d?u dã d?c', modifiedCount: result.modifiedCount });
    } catch (error) {
        res.status(400).json({ error: 'L?i khi c?p nh?t tin nh?n' });
    }
});

// Test API
app.get('/api/test', async (req, res) => {
    try {
        const products = await db.collection('products').find().toArray();
        res.json({ 
            message: 'Server dang ch?y!', 
            database: 'Ðã k?t n?i',
            productsCount: products.length 
        });
    } catch (error) {
        res.status(500).json({ error: 'L?i database' });
    }
});

// Kh?i d?ng server
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`?? Server dang ch?y: http://localhost:${PORT}`);
        console.log(`?? Database: trucdaocosmetics`);
        console.log(`?? Truy c?p website: http://localhost:${PORT}`);
    });
});