const http = require('http');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'client', 'build', 'app', 'outputs', 'flutter-apk');
const PORT = 8081;

const MIME = {
  '.html': 'text/html',
  '.apk': 'application/vnd.android.package-archive',
};

const server = http.createServer((req, res) => {
  const file = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(DIR, file);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serving at http://0.0.0.0:${PORT}`);
});
