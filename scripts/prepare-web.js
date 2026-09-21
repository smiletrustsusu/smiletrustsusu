const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const www = path.join(root, "www");
const files = ["index.html", "app.js", "styles.css", "styles-mobile.css", "service-worker.js", "manifest.webmanifest", "config.example.json"];
const dirs = ["assets", "vendor", "src"];

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`Skipping missing directory: ${path.relative(root, src)}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else copyFile(from, to);
  }
}

fs.mkdirSync(www, { recursive: true });

files.forEach((file) => {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) {
    console.warn(`Skipping missing file: ${file}`);
    return;
  }
  copyFile(src, path.join(www, file));
  console.log(`Copied ${file}`);
});

const configPath = path.join(root, "config.json");
if (fs.existsSync(configPath)) {
  copyFile(configPath, path.join(www, "config.json"));
  console.log("Copied config.json (unified cloud settings for EXE and APK)");
}

dirs.forEach((dir) => {
  copyDir(path.join(root, dir), path.join(www, dir));
  console.log(`Synced ${dir}/`);
});

console.log("www/ is ready for Electron and Capacitor builds.");
