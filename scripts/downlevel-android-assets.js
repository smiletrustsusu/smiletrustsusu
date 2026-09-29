#!/usr/bin/env node
/**
 * Downlevel Capacitor Android web assets for older System WebViews.
 *
 * Source of truth stays modern (src/ + www/ via prepare:web). After `cap sync`,
 * Android copies under android/app/src/main/assets/public are rewritten in-place
 * to ES2018 so optional chaining / nullish coalescing / numeric separators do
 * not throw Uncaught SyntaxError on WebViews below Chrome 80.
 *
 * Vendor bundles are left untouched (already compiled for broad browsers).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const publicDir = path.join(root, "android", "app", "src", "main", "assets", "public");
const TARGET = "es2018";

function walkJs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "vendor") continue;
      walkJs(full, acc);
      continue;
    }
    if (entry.name.endsWith(".js")) acc.push(full);
  }
  return acc;
}

function main() {
  if (!fs.existsSync(publicDir)) {
    console.warn(`downlevel-android-assets: skip — missing ${path.relative(root, publicDir)}`);
    process.exit(0);
  }

  let esbuild;
  try {
    esbuild = require("esbuild");
  } catch {
    console.error("downlevel-android-assets: esbuild is required (devDependency). Run: npm install");
    process.exit(1);
  }

  const files = walkJs(publicDir);
  if (!files.length) {
    console.warn("downlevel-android-assets: no JS files found");
    process.exit(0);
  }

  let transformed = 0;
  const failures = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    try {
      const result = esbuild.transformSync(source, {
        loader: "js",
        format: "esm",
        target: TARGET,
        platform: "browser",
        sourcemap: false,
        // Keep legal comments out of the APK payload size.
        legalComments: "none"
      });
      if (result.code !== source) {
        fs.writeFileSync(file, result.code, "utf8");
        transformed += 1;
      }
    } catch (error) {
      failures.push({ file: path.relative(root, file), message: error.message || String(error) });
    }
  }

  console.log(
    `downlevel-android-assets: scanned=${files.length} transformed=${transformed} target=${TARGET}`
  );

  if (failures.length) {
    console.error("downlevel-android-assets: transform failures:");
    for (const failure of failures.slice(0, 10)) {
      console.error(`  ${failure.file}: ${failure.message}`);
    }
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { main, publicDir, TARGET };
