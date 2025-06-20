import jwt from 'jsonwebtoken';
import  User  from '../model/user.model.js';
import mongoose from 'mongoose';

// Middleware to authenticate user via JWT token
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Middleware to authenticate user via API key
export const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const user = await User.findOne({ apiKey, isActive: true }).select('-password');
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
};

// Middleware to ensure user owns the email
export const ensureEmailOwnership = async (req, res, next) => {
  try {
    const { emailId } = req.params;
    const Email = mongoose.model('Email');
    
    const email = await Email.findOne({ emailId, userId: req.user._id });
    
    if (!email) {
      return res.status(404).json({ error: 'Email not found or access denied' });
    }

    req.email = email;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}; 