import mongoose from "mongoose";

const emailSchema = new mongoose.Schema({
  // User reference - required for user isolation
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Email identification
  id: { type: String, required: true }, // Gmail thread ID
  emailId: { type: String, unique: true }, // Custom tracking ID
  
  // Email content
  subject: String,
  to: String,
  toName: String,
  body: String,
  
  // Status and tracking
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'clicked', 'failed'],
    default: 'sent'
  },
  
  // Timestamps
  sentTime: Date,
  lastUpdate: Date,
  readTime: Date,
  
  // Tracking data
  trackingData: {
    opens: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    lastOpen: Date,
    lastClick: Date,
    deviceInfo: Object,
    locationInfo: Object
  },
  
  // Metadata
  hasTrackingPixel: { type: Boolean, default: false },
  folder: String,
  isSent: Boolean,
  deliveryStatus: String,
  
  // User agent and IP for tracking
  userAgent: String,
  ipAddress: String,
  
  // Campaign tracking (optional)
  campaignId: String,
  campaignName: String
}, { 
  timestamps: true,
  // Compound index for efficient user-based queries
  indexes: [
    { userId: 1, sentTime: -1 },
    { userId: 1, status: 1 },
    { emailId: 1, userId: 1 }
  ]
});

// Virtual for email age
emailSchema.virtual('age').get(function() {
  return Date.now() - this.sentTime;
});

// Method to update read status
emailSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readTime = new Date();
  this.trackingData.opens += 1;
  this.trackingData.lastOpen = new Date();
  this.lastUpdate = new Date();
};

// Method to update click status
emailSchema.methods.markAsClicked = function() {
  this.status = 'clicked';
  this.trackingData.clicks += 1;
  this.trackingData.lastClick = new Date();
  this.lastUpdate = new Date();
};

export default mongoose.model("Email", emailSchema);