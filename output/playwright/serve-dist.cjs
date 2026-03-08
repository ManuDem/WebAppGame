const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve('C:/Users/manud/Desktop/WebApp Game/client/dist');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};
const server = http.createServer((req, res) => {
  const cleanPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let target = cleanPath === '/' ? '/index.html' : cleanPath;
  let filePath = path.join(root, target);
  if (!filePath.startsWith(root)) {
    res.statusCode = 403;
    return res.end('forbidden');
  }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.statusCode = 404;
        return res.end('not found');
      }
      res.setHeader('Content-Type', mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
      res.end(data);
    });
  });
});
server.listen(3000, 'localhost', () => console.log('STATIC_SERVER_READY http://localhost:3000'));
setInterval(() => {}, 1 << 30);
