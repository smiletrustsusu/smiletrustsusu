const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

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

async function writeClientConfig() {
  const dest = path.join(www, "config.json");
  const configPath = path.join(root, "config.json");
  if (!fs.existsSync(configPath)) {
    fs.rmSync(dest, { force: true });
    return;
  }
  const { pickClientConfig } = await import(pathToFileURL(path.join(root, "src", "config.js")).href);
  const { forbiddenClientConfigKeys } = await import(pathToFileURL(path.join(root, "src", "core", "production-guards.js")).href);
  const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const dropped = Object.keys(raw).filter((key) => !(key in pickClientConfig(raw)));
  if (dropped.length) console.warn(`Not shipping config.json keys: ${dropped.join(", ")}`);
  const clientConfig = pickClientConfig(raw);
  const leaked = forbiddenClientConfigKeys(clientConfig);
  if (leaked.length) throw new Error(`Refusing to ship secrets in www/config.json: ${leaked.join(", ")}`);
  fs.writeFileSync(dest, `${JSON.stringify(clientConfig, null, 2)}\n`);
  console.log("Wrote www/config.json (public client settings only)");
}

async function main() {
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

  await writeClientConfig();

  dirs.forEach((dir) => {
    copyDir(path.join(root, dir), path.join(www, dir));
    console.log(`Synced ${dir}/`);
  });

  console.log("www/ is ready for Electron and Capacitor builds.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
