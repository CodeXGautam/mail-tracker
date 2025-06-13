import express from 'express';
import fs from 'fs';

const app = express();

app.get("/pixel.png", (req, res) => {
  const log = {
    time: new Date(),
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    emailId: req.query.emailId || "unknown"
  };
  console.log("Mail opened:", log);

  fs.appendFile("logs.json", JSON.stringify(log) + ",\n", (err) => {
    if (err) console.error("Failed to write log:", err);
  });

  const pixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  res.writeHead(200, {
    "Content-Type": "image/gif",
    "Content-Length": pixel.length
  });
  res.end(pixel);
});


export {app};
