const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../config/db');

// @route   POST /api/auth/register
// @desc    Register a new user
const register = async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection('users');

    const { name, phone, password } = req.body;

    // Simple validation
    if (!name || !phone || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this phone number' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user document
    const newUser = {
      name,
      phone,
      password: hashedPassword,
      createdAt: new Date(),
      status: 'active' // For now, we skip OTP validation and just mark them active
    };

    // Insert into DB
    const result = await usersCollection.insertOne(newUser);

    // OPTIONAL: Later we will send OTP here instead of activating immediately
    console.log(`[MOCK OTP] Send to ${phone}: 1234`); // Mocking OTP for the future

    // Generate JWT token
    const token = jwt.sign(
      { id: result.insertedId, role: 'customer' },
      process.env.JWT_SECRET || 'supersecretjwtkey_replace_me_in_production',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: result.insertedId,
        name: newUser.name,
        phone: newUser.phone
      }
    });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
const login = async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection('users');

    const { phone, password } = req.body;

    // Simple validation
    if (!phone || !password) {
      return res.status(400).json({ message: 'Please provide phone and password' });
    }

    // Check for user
    const user = await usersCollection.findOne({ phone });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role || 'customer' },
      process.env.JWT_SECRET || 'supersecretjwtkey_replace_me_in_production',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// @route   GET /api/auth/me
// @desc    Get current user profile (protected)
const getMe = async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection('users');
    
    // Convert string ID back to ObjectId if necessary
    // Native MongoDB requires ObjectId for _id matches
    const { ObjectId } = require('mongodb');
    
    const user = await usersCollection.findOne({ _id: new ObjectId(req.user.id) });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Don't send the password back
    const { password, ...userWithoutPassword } = user;

    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Get Me Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  register,
  login,
  getMe
};
