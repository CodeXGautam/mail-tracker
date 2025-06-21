import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import morgan from "morgan";
import mongoose from "mongoose";
import Email from "./model/email.model.js";
import authRoutes from "./routes/auth.js";
import { authenticateToken, authenticateApiKey } from "./middleware/auth.js";
import { User } from "./model/user.model.js";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const LOG_FILE = path.join(__dirname, "logs.json");
const MAX_LOG_SIZE = 5 * 1024 * 1024;

// Helper function for log rotation
async function checkLogRotation() {
  try {
    const stats = await fs.stat(LOG_FILE);
    if (stats.size > MAX_LOG_SIZE) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      await fs.rename(LOG_FILE, path.join(__dirname, `logs-${timestamp}.json`));
      await fs.writeFile(LOG_FILE, "[]");
    }
  } catch (err) {
    console.error("Log rotation error:", err);
  }
}

const app = express();
app.use(morgan("combined"));
app.use(express.json());
app.use((req, res, next) => {
  // More comprehensive CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
  res.setHeader("Access-Control-Max-Age", "86400");
  
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
  });
});

// Auth routes
app.use("/auth", authRoutes);

// Auto-create user endpoint for extension
app.post("/auth/auto-create", async (req, res) => {
  try {
    const { email, name } = req.body;
    
    console.log("🔧 Auto-create request received:", { email, name });
    
    if (!email) {
      console.log("❌ No email provided");
      return res.status(400).json({ error: "Email is required" });
    }

    // Check if database is connected
    if (!mongoose.connection.readyState) {
      console.log("⚠️ Database not connected, using fallback mechanism");
      
      // Generate a temporary API key for the session
      const tempApiKey = crypto.randomBytes(32).toString('hex');
      
      // Store in logs as fallback
      await checkLogRotation();
      let currentLogs = [];
      try {
        currentLogs = JSON.parse(await fs.readFile(LOG_FILE, "utf-8"));
      } catch (err) {
        currentLogs = [];
      }
      
      const tempUser = {
        id: `temp-${Date.now()}`,
        email,
        name: name || email.split('@')[0],
        apiKey: tempApiKey,
        timestamp: new Date().toISOString(),
        type: 'temp-user'
      };
      
      currentLogs.push(tempUser);
      await fs.writeFile(LOG_FILE, JSON.stringify(currentLogs, null, 2));
      
      console.log(`✅ Temporary user created (DB offline): ${email}`);
      
      return res.status(201).json({
        success: true,
        user: {
          id: tempUser.id,
          email: tempUser.email,
          name: tempUser.name,
          apiKey: tempUser.apiKey
        },
        message: "Temporary user created (database offline)"
      });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    
    if (user) {
      console.log("✅ User already exists:", user.email);
      // User exists, return their API key
      return res.json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          apiKey: user.apiKey
        },
        message: "User already exists"
      });
    }

    console.log("🆕 Creating new user...");
    
    // Create new user automatically (simplified version)
    user = new User({
      email,
      name: name || email.split('@')[0], // Use email prefix as name if not provided
      password: crypto.randomBytes(32).toString('hex'), // Random password since user won't login manually
      isActive: true,
      trackingEnabled: true
    });

    // Generate API key using the method
    user.generateApiKey();

    await user.save();

    console.log(`✅ Auto-created user: ${email}`);

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        apiKey: user.apiKey
      },
      message: "User created successfully"
    });
  } catch (error) {
    console.error("❌ Auto-create user error:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: "Failed to create user", details: error.message });
  }
});

const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

async function initLogFile() {
  try {
    await fs.access(LOG_FILE);
  } catch {
    await fs.writeFile(LOG_FILE, "[]");
  }
}

app.get("/pixel.png", async (req, res) => {
  try {
    // Decode the emailId to match DB format
    const emailId = decodeURIComponent(req.query.emailId);
    const { recipientId } = req.query;
    if (!emailId) return res.status(400).send("Missing emailId parameter");

    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    const logEntry = {
      timestamp: new Date().toISOString(),
      emailId,
      recipientId: recipientId || null,
      ip,
      userAgent,
      referer: req.headers["referer"],
      country: req.headers["cf-ipcountry"] || null,
      device: {
        mobile: /mobile/i.test(userAgent),
        browser: userAgent?.split("/")[0] || "unknown",
      },
    };

    console.log("📌 Tracking pixel accessed:", logEntry);

    // --- Update email status to 'read' using emailId ---
    try {
      if (mongoose.connection.readyState) {
        const result = await Email.findOneAndUpdate(
          { emailId },
          { 
            $set: { 
              status: "read", 
              lastUpdate: new Date(),
              readTime: new Date(),
              "trackingData.opens": { $inc: 1 },
              "trackingData.lastOpen": new Date(),
              userAgent,
              ipAddress: ip
            } 
          }
        );
        console.log("DB update for emailId:", emailId, "Result:", result);
      } else {
        console.log("⚠️ Database not connected, skipping DB update for emailId:", emailId);
      }
    } catch (err) {
      console.error("Failed to update email status to 'read' for:", emailId, err);
    }

    await checkLogRotation();
    let currentLogs = [];
    try {
      currentLogs = JSON.parse(await fs.readFile(LOG_FILE, "utf-8"));
    } catch (err) {
      console.warn("🔄 Resetting corrupted log file.");
      currentLogs = [];
    }
    currentLogs.push(logEntry);
    await fs.writeFile(LOG_FILE, JSON.stringify(currentLogs, null, 2));

    res.set({
      "Content-Type": "image/gif",
      "Content-Length": PIXEL.length,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });
    res.end(PIXEL);
  } catch (error) {
    console.error("🔥 Error in tracking endpoint:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/logs", async (req, res) => {
  try {
    let logs = JSON.parse(await fs.readFile(LOG_FILE, "utf-8"));
    if (!Array.isArray(logs)) {
      logs = [];
      await fs.writeFile(LOG_FILE, "[]");
    }
    res.json(logs);
  } catch (err) {
    console.error("Failed to read logs:", err);
    res.status(500).json({ error: "Failed to read logs" });
  }
});

app.delete("/logs", async (req, res) => {
  try {
    await fs.writeFile(LOG_FILE, "[]");
    res.json({ message: "Logs cleared" });
  } catch {
    res.status(500).json({ error: "Failed to clear logs" });
  }
});

// Store or update a sent email
app.post("/emails", authenticateApiKey, async (req, res) => {
  try {
    const email = req.body;
    
    // Check if database is connected
    if (!mongoose.connection.readyState) {
      console.log("⚠️ Database not connected, storing in logs only");
      // Store in logs as fallback
      await checkLogRotation();
      let currentLogs = [];
      try {
        currentLogs = JSON.parse(await fs.readFile(LOG_FILE, "utf-8"));
      } catch (err) {
        currentLogs = [];
      }
      currentLogs.push({ ...email, timestamp: new Date().toISOString() });
      await fs.writeFile(LOG_FILE, JSON.stringify(currentLogs, null, 2));
      return res.json({ success: true, message: "Stored in logs (DB unavailable)" });
    }
    
    // Add user ID to email data
    email.userId = req.user._id;
    
    // Allow status-only updates
    if (email && email.emailId && email.status && !email.hasTrackingPixel) {
      await Email.findOneAndUpdate(
        { emailId: email.emailId, userId: req.user._id },
        { $set: { status: email.status, lastUpdate: email.lastUpdate } }
      );
      return res.json({ success: true });
    }
    // Only store full emails with tracking pixel
    if (!email || !email.id || !email.emailId || !email.hasTrackingPixel) {
      return res.status(400).json({ error: "Missing email data, id, emailId, or tracking pixel" });
    }
    // Upsert (insert or update full doc)
    await Email.findOneAndUpdate(
      { emailId: email.emailId, userId: req.user._id },
      { $set: email },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error storing email:", err);
    res.status(500).json({ error: "Failed to store email" });
  }
});

// Fetch all stored emails for authenticated user
app.get("/emails", authenticateApiKey, async (req, res) => {
  try {
    // Check if database is connected
    if (!mongoose.connection.readyState) {
      console.log("⚠️ Database not connected, returning logs only");
      // Return logs as fallback
      let logs = [];
      try {
        logs = JSON.parse(await fs.readFile(LOG_FILE, "utf-8"));
      } catch (err) {
        logs = [];
      }
      return res.json(logs);
    }
    
    const emails = await Email.find({ userId: req.user._id }).sort({ sentTime: -1 }).lean();
    res.json(emails);
  } catch (err) {
    console.error("Error fetching emails:", err);
    res.status(500).json({ error: "Failed to read emails" });
  }
});

app.delete("/emails", async (req, res) => {
  try {
    await Email.deleteMany({});
    res.json({ message: "All emails deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete emails" });
  }
});

async function startServer() {
  await initLogFile();
  console.log(`📝 Logs stored at: ${LOG_FILE}`);
}

startServer();

export { app };
