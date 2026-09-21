const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const defaultPort = Number(process.env.PORT || 8787);
const defaultBackupFile = path.join(__dirname, "cloud-backup.json");
const defaultHost = process.env.SYNC_BIND || "127.0.0.1";
const syncToken = process.env.SYNC_TOKEN || "";

function send(res, status, body) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Sync-Token",
    "Content-Type": "application/json"
  });
  res.end(JSON.stringify(body));
}

function authorized(req) {
  if (!syncToken) return true;
  const header = req.headers.authorization || req.headers["x-sync-token"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (!token || token.length !== syncToken.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(syncToken));
}

function localSyncUrls(port) {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
    .map((entry) => `http://${entry.address}:${port}`);
}

function createBackupServer(backupFile = defaultBackupFile, port = defaultPort, host = defaultHost) {
  return http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    send(res, 200, { ok: true });
    return;
  }

  if (!authorized(req)) {
    send(res, 401, { error: "Unauthorized" });
    return;
  }

  if (req.url === "/info" && req.method === "GET") {
    send(res, 200, {
      ok: true,
      port,
      host,
      authRequired: Boolean(syncToken),
      localUrl: `http://localhost:${port}`,
      phoneUrls: host === "0.0.0.0" ? localSyncUrls(port) : []
    });
    return;
  }

  if (req.url === "/backup" && req.method === "GET") {
    if (!fs.existsSync(backupFile)) {
      send(res, 404, { error: "No backup found" });
      return;
    }
    try {
      send(res, 200, JSON.parse(fs.readFileSync(backupFile, "utf8")));
    } catch {
      send(res, 500, { error: "Backup file is corrupt" });
    }
    return;
  }

  if (req.url === "/webhooks/momo" && req.method === "POST") {
    const webhookSecret = process.env.MOMO_WEBHOOK_SECRET || "";
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const signature = req.headers["x-momo-signature"] || req.headers["x-hub-signature-256"] || "";
        let signatureValid = true;
        if (webhookSecret && signature) {
          const expected = crypto.createHmac("sha256", webhookSecret).update(body).digest("hex");
          const provided = String(signature).replace(/^sha256=/i, "").trim();
          signatureValid = expected.length === provided.length
            && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
        } else if (webhookSecret) {
          signatureValid = false;
        }
        send(res, 200, {
          ok: true,
          signatureValid,
          reference: String(payload.reference || payload.externalId || "").trim(),
          message: signatureValid
            ? "Webhook accepted. Forward to Supabase record_momo_webhook RPC or apply in app."
            : "Invalid webhook signature"
        });
      } catch {
        send(res, 400, { error: "Invalid webhook JSON" });
      }
    });
    return;
  }

  if (req.url === "/backup" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 25_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        fs.writeFileSync(backupFile, JSON.stringify(payload, null, 2));
        send(res, 200, { ok: true, savedAt: new Date().toISOString() });
      } catch {
        send(res, 400, { error: "Invalid backup JSON" });
      }
    });
    return;
  }

  send(res, 404, { error: "Not found" });
  });
}

function startBackupServer(options = {}) {
  const port = Number(options.port || defaultPort);
  const backupFile = options.backupFile || defaultBackupFile;
  const host = options.host || defaultHost;
  const server = createBackupServer(backupFile, port, host);
  server.listen(port, host, () => {
    console.log(`KBA backup server running at http://${host}:${port}`);
    if (syncToken) console.log("Sync token authentication enabled.");
  });
  return server;
}

if (require.main === module) {
  startBackupServer();
}

module.exports = { startBackupServer };
