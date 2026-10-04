/**
 * Serves the committed www/ web client (commit 11be35b or later) on 127.0.0.1 only, for the stale
 * snapshot recovery (docs/recovery/STALE-SNAPSHOT-RECOVERY-RUNBOOK.md, step F).
 *
 * Refuses to start unless HEAD contains 11be35b, the served files have no uncommitted changes, the
 * www/ mirror matches the root sources for the sync modules, the client pauses uploads once the
 * initial snapshot insert is sent, and www/config.json points at project
 * qouokiqoepjpoksupskb without server secrets. Every response is no-store and the service worker
 * script is withheld, so the browser cannot keep or reuse older assets. config.json is checked, never
 * printed.
 *
 * Usage: node scripts/recovery/serve-recovery-client.mjs [port]   (default 5180)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const www = path.join(root, "www");
const REQUIRED_COMMIT = "11be35b";
const PROJECT_REF = "qouokiqoepjpoksupskb";
const FORBIDDEN_REF = "angoswtgcklnorhlosnf";
const MIRRORED = ["app.js", "index.html", "src/sync/snapshot-bootstrap.js", "src/sync/cloud.js", "src/sync/snapshot-security.js", "src/config.js"];
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2"
};

function stop(message) {
  throw new Error(`STOP: ${message}`);
}

const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

export function preflight() {
  try {
    git("merge-base", "--is-ancestor", REQUIRED_COMMIT, "HEAD");
  } catch {
    stop(`HEAD does not contain commit ${REQUIRED_COMMIT}; check out ${REQUIRED_COMMIT} or later.`);
  }
  const dirty = git("status", "--porcelain", "--untracked-files=no", "--", "www", "src", "app.js", "index.html");
  if (dirty) stop("served files have uncommitted changes:\n" + dirty);
  for (const file of MIRRORED) {
    const a = fs.readFileSync(path.join(root, file));
    const b = fs.readFileSync(path.join(www, file));
    if (!a.equals(b)) stop(`www/${file} differs from ${file}; the www mirror is not the committed client.`);
  }
  const served = (file) => fs.readFileSync(path.join(www, file), "utf8");
  if (!served("src/sync/snapshot-bootstrap.js").includes("pauseCloudUploads();")
    || !/export async function pushCloudBackup\(silent = false\) \{\s*if \(cloudUploadsPaused\(\)\)/.test(served("src/sync/cloud.js"))
    || !/async function pushCloudBackup\(silent = false\) \{\s*if \(cloudUploadsPaused\(\)\)/.test(served("app.js"))) {
    stop("this client lacks the upload pause after the initial cloud snapshot; it would overwrite the new snapshot with device defaults.");
  }
  const configFile = path.join(www, "config.json");
  if (!fs.existsSync(configFile)) stop("www/config.json is missing (copy the deployment config; it is not committed).");
  const config = fs.readFileSync(configFile, "utf8");
  if (config.includes(FORBIDDEN_REF)) stop("www/config.json references another system's project.");
  if (!config.includes(PROJECT_REF)) stop(`www/config.json does not point at project ${PROJECT_REF}.`);
  if (/service_role|sb_secret_|"serviceRoleKey"|"databasePassword"/i.test(config)) stop("www/config.json contains a server secret.");
  return git("rev-parse", "--short=12", "HEAD");
}

export function createServer() {
  return http.createServer((req, res) => {
    const headers = { "Cache-Control": "no-store, max-age=0", "Pragma": "no-cache", "X-Content-Type-Options": "nosniff" };
    let requested;
    try {
      requested = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    } catch {
      res.writeHead(400, headers).end("Bad request");
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, headers).end("Method not allowed");
      return;
    }
    const relative = requested === "/" ? "index.html" : requested.replace(/^\/+/, "");
    if (path.basename(relative) === "service-worker.js") {
      res.writeHead(404, headers).end("Service worker disabled for recovery");
      return;
    }
    const file = path.resolve(www, relative);
    if (file !== www && !file.startsWith(www + path.sep)) {
      res.writeHead(403, headers).end("Forbidden");
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404, headers).end("Not found");
        return;
      }
      res.writeHead(200, { ...headers, "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(req.method === "HEAD" ? undefined : data);
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] || 5180);
  let commit;
  try {
    if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 5173) stop("use a port from 1024 to 65535 other than 5173 (the old client's origin).");
    commit = preflight();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  createServer().listen(port, "127.0.0.1", () => {
    console.log(`Recovery client (commit ${commit}, www/) at http://127.0.0.1:${port}/  (127.0.0.1 only, no-store, service worker withheld)`);
    console.log("Open it only in a brand-new browser profile. Press Ctrl+C to stop.");
  });
}
