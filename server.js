require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_replace_me_in_production';

// --- Database Connection ---
let db = null;
const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/trigardening';
    const client = new MongoClient(uri);
    await client.connect();
    console.log('MongoDB Connected successfully');
    const dbName = uri.split('/').pop().split('?')[0] || 'trigardening';
    db = client.db(dbName);
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const getDB = () => db;

// --- Middleware ---
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const protect = (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// --- Auth Controllers ---

// @route   POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const usersCollection = getDB().collection('users');
    const { name, phone, email, password, photoURL } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const existingUser = await usersCollection.findOne({ $or: [{ phone }, { email }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      name, phone, email, photoURL,
      role: 'customer',
      password: hashedPassword,
      createdAt: new Date(),
      status: 'active'
    };

    const result = await usersCollection.insertOne(newUser);
    const token = jwt.sign({ id: result.insertedId, role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: result.insertedId, name, phone, photoURL, role: 'customer' }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// @route   POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const usersCollection = getDB().collection('users');
    const { phone, password } = req.body;

    if (!phone || !password) return res.status(400).json({ message: 'Please provide phone and password' });

    const user = await usersCollection.findOne({ phone });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, role: user.role || 'customer' }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Logged in successfully',
      token,
      user: { id: user._id, name: user.name, phone: user.phone, photoURL: user.photoURL, role: user.role || 'customer' }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login' });
  }
});

// @route   GET /api/auth/me
app.get('/api/auth/me', protect, async (req, res) => {
  try {
    const user = await getDB().collection('users').findOne({ _id: new ObjectId(req.user.id) });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Start Server ---
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => console.log(`Server running on port ${PORT} (Simplified Mode)`));
  } catch (error) {
    console.error('Failed to start server:', error);
  }
};

startServer();
