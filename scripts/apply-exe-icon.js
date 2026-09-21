const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const distDir = path.join(root, "dist");
const icon = path.join(root, "build", "icon.ico");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMainAppExe(filePath) {
  const name = path.basename(filePath);
  return name === "SmileTrustSusu.exe";
}

function collectExeTargets() {
  if (!fs.existsSync(distDir)) return [];
  const targets = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (isMainAppExe(full)) targets.push(full);
    }
  };
  walk(distDir);
  return targets;
}

async function applyIconWithRetry(rcedit, exePath, attempts = 6) {
  if (!fs.existsSync(exePath)) return false;
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await rcedit(exePath, { icon });
      console.log(`Updated icon: ${exePath}`);
      return true;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        console.warn(`Icon apply retry ${attempt}/${attempts - 1} for ${exePath}`);
        await sleep(2000);
      }
    }
  }
  throw lastError;
}

async function main() {
  const { rcedit } = await import("rcedit");
  if (!fs.existsSync(icon)) {
    throw new Error("Missing build/icon.ico. Run npm run generate:icons first.");
  }

  const targets = collectExeTargets();
  if (!targets.length) {
    console.warn("No SmileTrustSusu.exe found in dist/. Build the app first.");
    return;
  }

  let updated = 0;
  for (const target of targets) {
    if (await applyIconWithRetry(rcedit, target)) updated += 1;
  }
  console.log(`Applied Smile Trust icon to ${updated} app executable(s).`);
  console.log("Installer and portable icons are embedded during electron-builder packaging.");
}

main().catch((error) => {
  console.error("Failed to apply EXE icon:", error.message);
  process.exit(1);
});
