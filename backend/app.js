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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key");
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

// Test pixel endpoint (for debugging)
app.get("/test-pixel", (req, res) => {
  console.log("Test pixel endpoint accessed");
  res.json({ 
    message: "Test pixel endpoint working",
    timestamp: new Date().toISOString(),
    query: req.query
  });
});

// Auth routes
app.use("/auth", authRoutes);

// Auto-create user endpoint for extension
app.post("/auth/auto-create", async (req, res) => {
  try {
    const { email, name } = req.body;
    
    console.log("Auto-create request received:", { email, name });
    
    if (!email) {
      console.log("No email provided");
      return res.status(400).json({ error: "Email is required" });
    }

    // Check if database is connected
    if (!mongoose.connection.readyState) {
      console.log("Database not connected, using fallback mechanism");
      
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
      
      console.log(`Temporary user created (DB offline): ${email}`);
      
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
      console.log("User already exists:", user.email);
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

    console.log("Creating new user...");
    
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

    console.log(`Auto-created user: ${email}`);

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
    console.error("Auto-create user error:", error);
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
    console.log("Pixel endpoint accessed with query:", req.query);
    
    // Decode the emailId to match DB format
    const emailId = decodeURIComponent(req.query.emailId);
    const { recipientId } = req.query;
    
    if (!emailId) {
      console.error("Missing emailId parameter");
      return res.status(400).send("Missing emailId parameter");
    }

    console.log("Processing pixel for emailId:", emailId);

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

    console.log("Tracking pixel accessed:", logEntry);

    // --- Check if this is the sender accessing their own email ---
    let isSenderAccess = false;
    try {
      if (mongoose.connection.readyState) {
        // Find the email to get sender information
        const email = await Email.findOne({ emailId });
        if (email) {
          // Check if the IP matches the sender's IP (from when email was sent)
          if (email.senderIpAddress && email.senderIpAddress === ip) {
            console.log("Sender accessing their own email - IP match");
            isSenderAccess = true;
          }
          
          // Check if user agent matches (sender likely uses same browser)
          if (!isSenderAccess && email.userAgent && email.userAgent === userAgent) {
            console.log("Sender accessing their own email - User agent match");
            isSenderAccess = true;
          }
          
          // Additional check: if it's a local/development IP
          if (!isSenderAccess && (ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1")) {
            console.log("Local/development access detected - not marking as read");
            isSenderAccess = true;
          }
          
          // Additional check: if referer contains Gmail (sender viewing their own sent email)
          const referer = req.headers["referer"];
          if (!isSenderAccess && referer && referer.includes("mail.google.com")) {
            console.log("Gmail referer detected - likely sender viewing own email");
            isSenderAccess = true;
          }
        }
      }
    } catch (err) {
      console.error("Error checking sender access:", err);
      // If we can't determine, assume it's not the sender to be safe
      isSenderAccess = false;
    }

    // --- Update email status to 'read' only if not sender access ---
    if (!isSenderAccess) {
      try {
        if (mongoose.connection.readyState) {
          console.log("Searching for email with emailId:", emailId);
          
          // First, try to find the email without userId filter (for backward compatibility)
          let result = await Email.findOneAndUpdate(
            { emailId },
            { 
              $set: { 
                status: "read", 
                lastUpdate: new Date(),
                readTime: new Date(),
                "trackingData.lastOpen": new Date(),
                userAgent,
                ipAddress: ip
              },
              $inc: { "trackingData.opens": 1 }
            },
            { new: true }
          );
          
          if (!result) {
            console.log("Email not found with emailId:", emailId);
            console.log("Checking if email exists in database...");
            
            // Check if any email with this emailId exists
            const existingEmail = await Email.findOne({ emailId });
            if (existingEmail) {
              console.log("Email found but update failed:", existingEmail._id);
              
              // Try a simpler update without $inc
              try {
                const simpleUpdate = await Email.findOneAndUpdate(
                  { emailId },
                  { 
                    $set: { 
                      status: "read", 
                      lastUpdate: new Date(),
                      readTime: new Date(),
                      userAgent,
                      ipAddress: ip
                    }
                  },
                  { new: true }
                );
                if (simpleUpdate) {
                  console.log("Simple update successful for emailId:", emailId);
                }
              } catch (simpleErr) {
                console.error("Simple update also failed:", simpleErr.message);
              }
            } else {
              console.log("No email found with emailId:", emailId);
            }
          } else {
            console.log("DB update successful for emailId:", emailId, "Email ID:", result._id);
          }
        } else {
          console.log("Database not connected, skipping DB update for emailId:", emailId);
        }
      } catch (err) {
        console.error("Failed to update email status to 'read' for:", emailId, err);
        
        // Try a fallback update without complex operations
        try {
          const fallbackUpdate = await Email.findOneAndUpdate(
            { emailId },
            { 
              $set: { 
                status: "read", 
                lastUpdate: new Date()
              }
            }
          );
          if (fallbackUpdate) {
            console.log("Fallback update successful for emailId:", emailId);
          }
        } catch (fallbackErr) {
          console.error("Fallback update also failed:", fallbackErr.message);
        }
      }
    } else {
      console.log("Logging pixel access but not marking as read (sender access)");
    }

    // Always log the pixel access, even if DB update fails
    await checkLogRotation();
    let currentLogs = [];
    try {
      currentLogs = JSON.parse(await fs.readFile(LOG_FILE, "utf-8"));
    } catch (err) {
      console.warn("Resetting corrupted log file.");
      currentLogs = [];
    }
    currentLogs.push(logEntry);
    await fs.writeFile(LOG_FILE, JSON.stringify(currentLogs, null, 2));
    
    console.log("Pixel access logged successfully");

    // Send the pixel response
    res.set({
      "Content-Type": "image/gif",
      "Content-Length": PIXEL.length,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });
    res.end(PIXEL);
    
    console.log("Pixel response sent successfully");
  } catch (error) {
    console.error("Error in tracking endpoint:", error);
    console.error("Error stack:", error.stack);
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
      console.log("Database not connected, storing in logs only");
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
    
    // Capture sender's IP address for later comparison
    const senderIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    email.senderIpAddress = senderIp;
    
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
      console.log("Database not connected, returning logs only");
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
  console.log(`Logs stored at: ${LOG_FILE}`);
}

startServer();

export { app };
