/**
 * Wave 6 — Hardened Electron main process for SMILE TRUST SUSU MANAGEMENT SYSTEM.
 * Loads the same vanilla JS SPA (www/) as Web + Capacitor — NOT a Next.js/React rewrite.
 *
 * Security defaults: contextIsolation, sandbox, no nodeIntegration, webSecurity on,
 * navigation locks, external-link allowlist, CSP headers, allowlisted IPC.
 */

"use strict";

const { app, BrowserWindow, Menu, shell, nativeImage, ipcMain, dialog, safeStorage, powerMonitor, session } = require("electron");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { startBackupServer } = require("../sync-server");
const { IPC_INVOKE, ALLOWED_EXTERNAL_SCHEMES } = require("./ipc-channels");
const { createSecureVault } = require("./secure-vault");
const { setupAutoUpdater } = require("./updater");

let backupServer;
let secureVault = null;
let deviceIdCache = null;

const ROOT = path.join(__dirname, "..");
const PRELOAD = path.join(__dirname, "preload.js");

const CSP =
  "default-src 'self' file: data: blob:; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' file: blob:; " +
  "style-src 'self' 'unsafe-inline' file:; " +
  "img-src 'self' data: blob: file: https:; " +
  "font-src 'self' data: file:; " +
  "connect-src 'self' file: https: http://127.0.0.1:* http://localhost:* ws: wss:; " +
  "frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";

function assetPath(...parts) {
  const roots = app.isPackaged
    ? [path.join(process.resourcesPath, "assets"), path.join(app.getAppPath(), "assets")]
    : [path.join(ROOT, "assets")];
  for (const root of roots) {
    const candidate = path.join(root, ...parts);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveIconPath() {
  return assetPath("smile-trust-icon.ico") || assetPath("smile-trust-icon.png");
}

function resolveIndexPath() {
  const candidates = app.isPackaged
    ? [path.join(app.getAppPath(), "www", "index.html")]
    : [
        path.join(ROOT, "www", "index.html"),
        path.join(ROOT, "index.html")
      ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function isAppOwnedUrl(url) {
  try {
    if (!url || url === "about:blank") return true;
    if (url.startsWith("file:")) {
      const indexDir = path.dirname(resolveIndexPath());
      const target = path.normalize(decodeURIComponent(url.replace(/^file:\/\/\/?/, "").replace(/\//g, path.sep)));
      const allowed = path.normalize(indexDir);
      // Windows file URLs may include drive letter; compare loosely
      return target.toLowerCase().includes(path.basename(allowed).toLowerCase()) ||
        target.toLowerCase().startsWith(allowed.toLowerCase()) ||
        url.includes("/www/") ||
        url.endsWith("index.html");
    }
    return false;
  } catch {
    return false;
  }
}

function allowExternal(url) {
  try {
    const parsed = new URL(url);
    return ALLOWED_EXTERNAL_SCHEMES.includes(parsed.protocol);
  } catch {
    return false;
  }
}

function deviceIdPath() {
  return path.join(app.getPath("userData"), "device-id.txt");
}

function getOrCreateDeviceId() {
  if (deviceIdCache) return deviceIdCache;
  const file = deviceIdPath();
  try {
    if (fs.existsSync(file)) {
      deviceIdCache = fs.readFileSync(file, "utf8").trim();
      if (deviceIdCache) return deviceIdCache;
    }
  } catch {
    /* recreate */
  }
  deviceIdCache = "exe-" + crypto.randomBytes(16).toString("hex");
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, deviceIdCache, "utf8");
  } catch {
    /* ephemeral */
  }
  return deviceIdCache;
}

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send(channel, payload);
    } catch {
      /* ignore */
    }
  }
}

function registerIpcHandlers() {
  // Only allowlisted channels are registered (see electron/ipc-channels.js).

  ipcMain.handle("desktop:print", async (event, payload = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { ok: false, error: "no_window" };
    const html = String(payload.html || "");
    const silent = Boolean(payload.silent);
    if (html) {
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true
        }
      });
      const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(html);
      await printWin.loadURL(dataUrl);
      return await new Promise((resolve) => {
        printWin.webContents.print(
          { silent, printBackground: true, deviceName: payload.deviceName || "" },
          (success, failureReason) => {
            printWin.close();
            resolve({ ok: Boolean(success), failureReason: failureReason || null, via: "electron-print" });
          }
        );
      });
    }
    return await new Promise((resolve) => {
      win.webContents.print(
        { silent, printBackground: true },
        (success, failureReason) => {
          resolve({ ok: Boolean(success), failureReason: failureReason || null, via: "electron-print-current" });
        }
      );
    });
  });

  ipcMain.handle("desktop:printToPdf", async (event, payload = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { ok: false, error: "no_window" };
    try {
      const pdf = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: payload.pageSize || "A4"
      });
      const defaultName = payload.filename || `smile-trust-${Date.now()}.pdf`;
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        defaultPath: defaultName,
        filters: [{ name: "PDF", extensions: ["pdf"] }]
      });
      if (canceled || !filePath) return { ok: false, cancelled: true };
      fs.writeFileSync(filePath, pdf);
      return { ok: true, path: filePath, via: "printToPDF" };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("desktop:exportFile", async (event, payload = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const filename = String(payload.filename || "export.txt");
    const content = payload.content == null ? "" : String(payload.content);
    const { canceled, filePath } = await dialog.showSaveDialog(win || undefined, {
      defaultPath: filename,
      filters: [
        { name: "All Files", extensions: ["*"] },
        { name: "JSON", extensions: ["json"] },
        { name: "CSV", extensions: ["csv"] },
        { name: "Text", extensions: ["txt"] }
      ]
    });
    if (canceled || !filePath) return { ok: false, cancelled: true };
    fs.writeFileSync(filePath, content, "utf8");
    return { ok: true, path: filePath, via: "exportFile" };
  });

  ipcMain.handle("desktop:secureSet", async (_event, payload = {}) => {
    if (!secureVault) return { ok: false, error: "vault_unavailable" };
    return secureVault.setItem(payload.key, payload.value);
  });

  ipcMain.handle("desktop:secureGet", async (_event, payload = {}) => {
    if (!secureVault) return { ok: false, error: "vault_unavailable", value: null };
    return secureVault.getItem(payload.key);
  });

  ipcMain.handle("desktop:secureDelete", async (_event, payload = {}) => {
    if (!secureVault) return { ok: false, error: "vault_unavailable" };
    return secureVault.deleteItem(payload.key);
  });

  ipcMain.handle("desktop:deviceId", async () => ({
    ok: true,
    deviceId: getOrCreateDeviceId(),
    platform: "win32-electron"
  }));

  ipcMain.handle("desktop:appInfo", async () => ({
    ok: true,
    name: app.getName(),
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    wave: "WAVE-06",
    architecture: "electron-shared-spa",
    notNextJsRewrite: true,
    userData: app.getPath("userData"),
    deviceId: getOrCreateDeviceId(),
    secureStorageEncrypted: secureVault ? secureVault.encryptionAvailable() : false,
    ipcAllowlist: IPC_INVOKE.slice()
  }));

  ipcMain.handle("desktop:openExternal", async (_event, payload = {}) => {
    const url = String(payload.url || "");
    if (!allowExternal(url)) return { ok: false, error: "scheme_refused" };
    await shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle("desktop:getPaths", async () => ({
    ok: true,
    userData: app.getPath("userData"),
    documents: app.getPath("documents"),
    downloads: app.getPath("downloads"),
    indexHtml: resolveIndexPath()
  }));
}

function applyCsp() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    headers["Content-Security-Policy"] = [CSP];
    callback({ responseHeaders: headers });
  });
}

function createWindow() {
  const iconPath = resolveIconPath();
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : null;
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: "SMILE TRUST SUSU MANAGEMENT SYSTEM",
    icon: icon && !icon.isEmpty() ? icon : undefined,
    backgroundColor: "#f5f7f3",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      spellcheck: true
    }
  });

  Menu.setApplicationMenu(null);
  window.once("ready-to-show", () => window.show());

  const indexPath = resolveIndexPath();
  window.loadFile(indexPath).catch((err) => {
    console.error("Failed to load SPA index:", indexPath, err);
  });

  window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });
  window.webContents.on("did-fail-load", (_event, code, description, url) => {
    console.error("Failed to load:", code, description, url);
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer exited:", details);
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^about:blank$/i.test(url)) return { action: "allow" };
    if (allowExternal(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (isAppOwnedUrl(url)) return;
    event.preventDefault();
    if (allowExternal(url)) shell.openExternal(url);
  });

  window.webContents.on("will-redirect", (event, url) => {
    if (isAppOwnedUrl(url)) return;
    event.preventDefault();
    if (allowExternal(url)) shell.openExternal(url);
  });

  return window;
}

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.smiletrust.susu");
  }

  secureVault = createSecureVault({
    userDataPath: app.getPath("userData"),
    safeStorage
  });

  applyCsp();
  registerIpcHandlers();
  setupAutoUpdater({
    app,
    BrowserWindow,
    ipcMain,
    isPackaged: app.isPackaged,
    rootDir: ROOT
  });

  try {
    backupServer = startBackupServer({
      backupFile: path.join(app.getPath("userData"), "cloud-backup.json"),
      host: "127.0.0.1"
    });
  } catch (error) {
    console.error("Backup server failed to start:", error);
  }

  createWindow();

  powerMonitor.on("resume", () => {
    broadcast("desktop:powerResume", { at: new Date().toISOString() });
    broadcast("desktop:wakeSync", { reason: "power-resume", at: new Date().toISOString() });
  });
  powerMonitor.on("unlock-screen", () => {
    broadcast("desktop:wakeSync", { reason: "unlock-screen", at: new Date().toISOString() });
  });

  // Periodic gentle wake for shared Wave 4 sync (renderer decides whether to run)
  setInterval(() => {
    broadcast("desktop:wakeSync", { reason: "interval", at: new Date().toISOString() });
  }, 5 * 60 * 1000);
});

app.on("window-all-closed", () => {
  if (backupServer) backupServer.close();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("web-contents-created", (_event, contents) => {
  contents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (allowExternal(url)) shell.openExternal(url);
    return { action: "deny" };
  });
});
