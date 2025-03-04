const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 8000;

app.get("/stream", (req, res) => {
  const filePath = path.join(__dirname, "record.mp3"); // Replace with your file path
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const CHUNK_SIZE = req.query?.chunkSize || 64 * 1024; // 64 KB chunks
  const STREAM_DELAY = req.query?.delay || 500; // 500ms delay per chunk (adjust as needed)

  // Get Query 'buffer'
  const buffer = req.query?.buffer || false;
  console.log(buffer);

  // Set CORS & COEP headers (common for both full and partial responses)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

  const range = req.headers.range;

  if (range) {
    // --- Handle Range Requests ---
    // Example range header: "bytes=0-65535"
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    console.log(`Range request: ${start} - ${end} (chunk size: ${chunkSize} bytes)`);

    // Set response headers for partial content
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    res.setHeader("Content-Length", chunkSize);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", "audio/mpeg");

    // Create a read stream for the requested range only
    const readStream = fs.createReadStream(filePath, {
      start,
      end,
      highWaterMark: CHUNK_SIZE,
    });

    // Function to simulate chunked transfer with a delay
    function sendChunk() {
      const chunk = readStream.read();
      if (chunk) {
        res.write(chunk);

        if (buffer) {
          setTimeout(sendChunk, STREAM_DELAY);
        } else {
          sendChunk();
        }
      } else {
        readStream.once("readable", sendChunk);
      }
    }

    readStream.on("end", () => res.end());
    readStream.on("error", (err) => {
      console.error("Stream error:", err);
      res.status(500).send("Stream error");
    });

    sendChunk();
  } else {
    // --- No Range header provided: send entire file ---
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", fileSize);
    res.setHeader("Accept-Ranges", "bytes");

    const readStream = fs.createReadStream(filePath, {
      highWaterMark: CHUNK_SIZE,
    });

    function sendChunk() {
      const chunk = readStream.read();
      if (chunk) {
        res.write(chunk);
        setTimeout(sendChunk, STREAM_DELAY);
      } else {
        readStream.once("readable", sendChunk);
      }
    }

    readStream.on("end", () => res.end());
    readStream.on("error", (err) => {
      console.error("Stream error:", err);
      res.status(500).send("Stream error");
    });

    sendChunk();
  }
});

// Enable OPTIONS preflight request for CORS
app.options("/stream", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
  res.sendStatus(204);
});

app.get("/", (req, res) => {
  res.send(`
    <html>
    <head>
      <title>Streaming Server</title>
    </head>
    <body>
        <h2>Stream Query Params</h2>
        <ul>    
            <li>/stream?buffer=true - To enable Buffer </li>
            <li>/stream?buffer=false - To disable Buffer</li>
            <li>/stream?delay=500 - Chunk Send Delay Default 500ms</li>
            <li>/stream?chunkSize=500 - Chunk Size Default 64KB</li>
        </ul>
    </body>
    </html>    
    
`);
});

app.listen(PORT, () => {
  console.log(`Streaming server running at http://localhost:${PORT}/stream`);
});
