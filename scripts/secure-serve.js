const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || "4175");
const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));

const headerEntries = (vercelConfig.headers || []).find((entry) => entry.source === "/(.*)")?.headers || [];
const securityHeaders = Object.fromEntries(headerEntries.map((header) => [header.key, header.value]));
const rewrites = vercelConfig.rewrites || [];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const rewritePath = (requestPath) => {
  const exact = rewrites.find((rewrite) => rewrite.source === requestPath);
  return exact ? exact.destination : requestPath;
};

const safeResolve = (requestPath) => {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const rewritten = rewritePath(decoded);
  const normalized = path.posix.normalize(rewritten);
  const trimmed = normalized.replace(/^\/+/, "");
  const resolved = path.resolve(root, trimmed || "index.html");

  if (!resolved.startsWith(root)) return null;
  return resolved;
};

const send = (res, statusCode, headers, body) => {
  res.writeHead(statusCode, { ...securityHeaders, ...headers });
  res.end(body);
};

const server = http.createServer((req, res) => {
  const urlPath = req.url === "/" ? "/index.html" : req.url;
  let filePath = safeResolve(urlPath);

  if (!filePath) {
    send(res, 403, { "Content-Type": "text/plain; charset=utf-8" }, "Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    const fallback404 = path.join(root, "404.html");
    if (fs.existsSync(fallback404)) {
      send(
        res,
        404,
        { "Content-Type": mimeTypes[".html"] },
        fs.readFileSync(fallback404)
      );
    } else {
      send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not Found");
    }
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || "application/octet-stream";
  const stat = fs.statSync(filePath);

  res.writeHead(200, {
    ...securityHeaders,
    "Content-Type": contentType,
    "Content-Length": stat.size,
  });

  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, () => {
  console.log(`[secure-serve] Serving brat.gg with security headers at http://localhost:${port}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
