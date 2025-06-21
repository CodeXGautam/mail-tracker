import jwt from 'jsonwebtoken';
import { User } from '../model/user.model.js';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.join(__dirname, "..", "logs.json");

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

    // First try to find user in database
    let user = await User.findOne({ apiKey, isActive: true }).select('-password');
    
    // If not found in database and database is offline, check logs for temporary users
    if (!user && !mongoose.connection.readyState) {
      try {
        const logs = JSON.parse(await fs.readFile(LOG_FILE, "utf-8"));
        const tempUser = logs.find(log => log.type === 'temp-user' && log.apiKey === apiKey);
        
        if (tempUser) {
          // Create a mock user object for temporary users
          user = {
            _id: tempUser.id,
            email: tempUser.email,
            name: tempUser.name,
            apiKey: tempUser.apiKey,
            isActive: true
          };
        }
      } catch (err) {
        console.error("Error reading logs for temp user:", err);
      }
    }
    
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