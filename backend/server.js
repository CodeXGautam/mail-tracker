import express from 'express';
const app = express();

app.get("/track/:id", (req, res) => {
  const id = req.params.id;
  console.log(`Email opened: ${id}`);
  // Store in DB or analytics
  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );
  res.writeHead(200, {
    "Content-Type": "image/gif",
    "Content-Length": pixel.length,
  });
  res.end(pixel);
});

app.listen(4000, () => console.log("Tracking server running on port 4000"));
