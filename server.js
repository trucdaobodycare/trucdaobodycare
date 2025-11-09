const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// K?t n?i MongoDB
const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'trucdao-cosmetics';
let db;

MongoClient.connect(mongoUrl, { useUnifiedTopology: true })
  .then(client => {
    console.log('? K?t n?i MongoDB thành công');
    db = client.db(dbName);
  })
  .catch(error => {
    console.error('? L?i k?t n?i MongoDB:', error);
  });

// Routes API s?n ph?m
app.get('/api/products', async (req, res) => {
  try {
    const products = await db.collection('products').find().toArray();
    res.json(products);
  } catch (error) {
    console.error('L?i l?y s?n ph?m:', error);
    res.status(500).json({ error: 'L?i server khi l?y s?n ph?m' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await db.collection('products').findOne({ _id: new ObjectId(req.params.id) });
    if (!product) {
      return res.status(404).json({ error: 'Không tìm th?y s?n ph?m' });
    }
    res.json(product);
  } catch (error) {
    console.error('L?i l?y s?n ph?m chi ti?t:', error);
    res.status(500).json({ error: 'L?i server khi l?y s?n ph?m' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const result = await db.collection('products').insertOne(req.body);
    res.status(201).json({ 
      message: 'Thêm s?n ph?m thành công', 
      productId: result.insertedId 
    });
  } catch (error) {
    console.error('L?i thêm s?n ph?m:', error);
    res.status(500).json({ error: 'L?i server khi thêm s?n ph?m' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const result = await db.collection('products').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Không tìm th?y s?n ph?m' });
    }
    res.json({ message: 'C?p nh?t s?n ph?m thành công' });
  } catch (error) {
    console.error('L?i c?p nh?t s?n ph?m:', error);
    res.status(500).json({ error: 'L?i server khi c?p nh?t s?n ph?m' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const result = await db.collection('products').deleteOne({ 
      _id: new ObjectId(req.params.id) 
    });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Không tìm th?y s?n ph?m' });
    }
    res.json({ message: 'Xóa s?n ph?m thành công' });
  } catch (error) {
    console.error('L?i xóa s?n ph?m:', error);
    res.status(500).json({ error: 'L?i server khi xóa s?n ph?m' });
  }
});

// Route m?c d?nh cho frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Kh?i d?ng server
app.listen(PORT, () => {
  console.log(`?? Server dang ch?y trên http://localhost:${PORT}`);
  console.log(`?? API Products: http://localhost:${PORT}/api/products`);
});

module.exports = app;