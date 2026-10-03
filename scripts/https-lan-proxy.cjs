// Proxy HTTPS de desarrollo para probar desde el celular por la red local
// (pedido del usuario, 2026-09-29). Chrome solo entrega la ubicación del
// celular a páginas en "contexto seguro" (HTTPS o localhost); por
// http://192.168.x.x la bloquea y el asistente de registro quedaba sin
// ubicación. Este proceso escucha en HTTPS (certificado local de mkcert,
// ver scripts/dev-lan.sh) y reenvía TODO al frontend en :3001 — la API y
// las fotos llegan por la misma dirección (/api, /media: rewrites de
// client/next.config.ts), así que basta un solo puerto HTTPS.
//
// Solo desarrollo. Sin dependencias: node:https + node:http, con soporte
// de WebSocket (el socket de recarga en vivo de `next dev`).
//
// Uso: HTTPS_CERT=... HTTPS_KEY=... node scripts/https-lan-proxy.cjs
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");

const PORT = Number(process.env.HTTPS_PORT ?? 3443);
const TARGET_PORT = Number(process.env.HTTPS_TARGET_PORT ?? 3001);
const TARGET_HOST = "127.0.0.1";

const server = https.createServer(
  { cert: fs.readFileSync(process.env.HTTPS_CERT), key: fs.readFileSync(process.env.HTTPS_KEY) },
  (req, res) => {
    const upstream = http.request(
      {
        host: TARGET_HOST,
        port: TARGET_PORT,
        method: req.method,
        path: req.url,
        headers: { ...req.headers, "x-forwarded-proto": "https", "x-forwarded-host": req.headers.host },
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", () => {
      if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      res.end("El frontend (:" + TARGET_PORT + ") no responde. ¿Corre pm2?");
    });
    req.pipe(upstream);
  },
);

// WebSocket (HMR de next dev): se reenvía el handshake crudo por TCP.
server.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(TARGET_PORT, TARGET_HOST, () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    upstream.write(lines.join("\r\n") + "\r\n\r\n");
    if (head && head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Proxy HTTPS de desarrollo: https://0.0.0.0:${PORT} -> http://${TARGET_HOST}:${TARGET_PORT}`);
});
