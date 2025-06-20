import mongoose from "mongoose";

const emailSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  subject: String,
  to: String,
  status: String,
  sentTime: Date,
  lastUpdate: Date,
  trackingData: Object,
  // Add any other fields you want to store
}, { timestamps: true });

export default mongoose.model("Email", emailSchema);