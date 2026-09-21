/**
 * Wave 6 — Auto-update scaffolding (electron-updater).
 * Code signing certificates are environment-specific — never embed secrets.
 * When electron-updater or publish URL is absent, returns a documented noop.
 */

"use strict";

const path = require("path");
const fs = require("fs");

function readPackageBuild(rootDir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
    return pkg.build || {};
  } catch {
    return {};
  }
}

/** Placeholder / docs-only hosts must not trigger real update checks. */
function isPlaceholderUpdateUrl(url) {
  if (!url || typeof url !== "string") return true;
  const u = url.trim().toLowerCase();
  if (!u) return true;
  return (
    u.includes("example.invalid") ||
    u.includes("example.com") ||
    u.includes("localhost") ||
    u === "about:blank"
  );
}

/**
 * @param {{ app: import('electron').App, BrowserWindow: typeof import('electron').BrowserWindow, ipcMain: import('electron').IpcMain, isPackaged: boolean, rootDir: string }} ctx
 */
function setupAutoUpdater(ctx) {
  const { app, BrowserWindow, ipcMain, isPackaged, rootDir } = ctx;
  const build = readPackageBuild(rootDir);
  const publish = build.publish || build.win?.publish || null;
  const channel = process.env.SMILE_UPDATE_CHANNEL || publish?.channel || "latest";
  const rawFeed =
    process.env.SMILE_UPDATE_FEED_URL || (typeof publish === "object" && publish?.url) || "";
  // Treat example.invalid / placeholder hosts as unconfigured (GAP-008).
  const feedUrl = isPlaceholderUpdateUrl(rawFeed) ? "" : String(rawFeed || "").trim();
  const publishConfigured = Boolean(feedUrl);

  let autoUpdater = null;
  try {
    autoUpdater = require("electron-updater").autoUpdater;
  } catch {
    autoUpdater = null;
  }

  const status = {
    available: Boolean(autoUpdater),
    configured: publishConfigured,
    channel,
    feedUrl: feedUrl || null,
    lastStatus: autoUpdater ? "idle" : "updater_module_absent",
    signingNote:
      "Set CSC_LINK / CSC_KEY_PASSWORD (or Windows certificate store) for signed NSIS builds. Unsigned pilots are allowed with signAndEditExecutable:false. Set SMILE_UPDATE_FEED_URL for production updates — do not ship placeholder hosts.",
    placeholderFeedBlocked: isPlaceholderUpdateUrl(rawFeed)
  };

  function broadcast(payload) {
    status.lastStatus = payload.status || status.lastStatus;
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        win.webContents.send("desktop:updateStatus", { ...status, ...payload });
      } catch {
        /* ignore */
      }
    }
  }

  if (!autoUpdater) {
    ipcMain.handle("desktop:updateCheck", async () => ({
      ok: false,
      ...status,
      error: "electron-updater not installed or not loadable"
    }));
    ipcMain.handle("desktop:updateInstall", async () => ({
      ok: false,
      ...status,
      error: "electron-updater not installed or not loadable"
    }));
    return status;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.channel = channel;
  if (feedUrl) {
    try {
      autoUpdater.setFeedURL({ provider: "generic", url: feedUrl, channel });
    } catch (err) {
      status.lastStatus = "feed_error";
      status.feedError = err?.message || String(err);
    }
  }

  autoUpdater.on("checking-for-update", () => broadcast({ status: "checking" }));
  autoUpdater.on("update-available", (info) => broadcast({ status: "available", info }));
  autoUpdater.on("update-not-available", (info) => broadcast({ status: "not-available", info }));
  autoUpdater.on("error", (err) => broadcast({ status: "error", error: err?.message || String(err) }));
  autoUpdater.on("download-progress", (progress) => broadcast({ status: "downloading", progress }));
  autoUpdater.on("update-downloaded", (info) => broadcast({ status: "downloaded", info }));

  ipcMain.handle("desktop:updateCheck", async () => {
    if (!isPackaged && !process.env.SMILE_UPDATE_FORCE) {
      return {
        ok: true,
        skipped: true,
        reason: "Updates run in packaged builds (set SMILE_UPDATE_FORCE=1 to force)",
        ...status
      };
    }
    if (!status.configured && !feedUrl) {
      return {
        ok: false,
        ...status,
        error: "No publish feed configured. Set build.publish or SMILE_UPDATE_FEED_URL."
      };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      return { ok: true, ...status, result: result?.updateInfo || null };
    } catch (err) {
      return { ok: false, ...status, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("desktop:updateInstall", async () => {
    try {
      autoUpdater.quitAndInstall(false, true);
      return { ok: true, ...status };
    } catch (err) {
      return { ok: false, ...status, error: err?.message || String(err) };
    }
  });

  app.whenReady().then(() => {
    if (isPackaged && status.configured) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => {});
      }, 15000);
    }
  });

  return status;
}

module.exports = { setupAutoUpdater, readPackageBuild, isPlaceholderUpdateUrl };
