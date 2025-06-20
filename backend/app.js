import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import morgan from "morgan";
import Email from "./model/email.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(morgan("combined"));
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

const LOG_FILE = path.join(__dirname, "logs.json");
const MAX_LOG_SIZE = 5 * 1024 * 1024;
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

app.get("/pixel.png", async (req, res) => {
  try {
    const { emailId, recipientId } = req.query;
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
    const logs = JSON.parse(await fs.readFile(LOG_FILE, "utf-8"));
    res.json(logs);
  } catch {
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
app.post("/emails", async (req, res) => {
  try {
    const email = req.body;
    if (!email || !email.id) return res.status(400).json({ error: "Missing email data or id" });

    // Upsert (insert or update)
    await Email.findOneAndUpdate(
      { id: email.id },
      { $set: email },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to store email" });
  }
});

// Fetch all stored emails
app.get("/emails", async (req, res) => {
  try {
    const emails = await Email.find().sort({ sentTime: -1 }).lean();
    res.json(emails);
  } catch {
    res.status(500).json({ error: "Failed to read emails" });
  }
});

async function startServer() {
  await initLogFile();
  console.log(`📝 Logs stored at: ${LOG_FILE}`);
}

startServer();

export { app };
