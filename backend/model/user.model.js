import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        password: {
            type: String,
            required: true
        },
        isActive: {
            type: Boolean,
            default: true
        },
        trackingEnabled: {
            type: Boolean,
            default: true
        },
        emailPreferences: {
            notifications: {
                type: Boolean,
                default: true
            },
            dailyReports: {
                type: Boolean,
                default: false
            }
        },
        apiKey: {
            type: String,
            unique: true,
            sparse: true
        },
        lastLogin: {
            type: Date
        },
        loginCount: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);

// Generate API key for user
userSchema.methods.generateApiKey = function() {
    const crypto = require('crypto');
    this.apiKey = crypto.randomBytes(32).toString('hex');
    return this.apiKey;
};

// Virtual for user's email count
userSchema.virtual('emailCount', {
    ref: 'Email',
    localField: '_id',
    foreignField: 'userId',
    count: true
});

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ apiKey: 1 });

export const User = mongoose.model("User", userSchema);