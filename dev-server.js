const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = process.env.FRONTEND_HOST || "127.0.0.1";
const PORT = parseInt(process.env.FRONTEND_PORT, 10) || 3200;
const ROOT = __dirname;
const PREFIX = "/StepBy/";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".md": "text/markdown; charset=utf-8",
};

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  });
  res.end(body);
}

http.createServer((req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (requestUrl.pathname === "/") {
    res.writeHead(302, { Location: `${PREFIX}UI10/map/Index.html` });
    res.end();
    return;
  }
  if (!requestUrl.pathname.startsWith(PREFIX)) {
    send(res, 404, "Not Found");
    return;
  }

  const relativePath = requestUrl.pathname.slice(PREFIX.length);
  const filePath = path.resolve(ROOT, relativePath);
  if (!filePath.startsWith(`${ROOT}${path.sep}`)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, "Not Found");
      return;
    }
    send(res, 200, data, CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream");
  });
}).listen(PORT, HOST, () => {
  console.log(`StepBy UI10 dev server: http://${HOST}:${PORT}${PREFIX}UI10/map/Index.html`);
});
