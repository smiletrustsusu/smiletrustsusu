const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const toIco = require("to-ico");

const root = path.join(__dirname, "..");
const assetsDir = path.join(root, "assets");
const buildDir = path.join(root, "build");
const androidResDir = path.join(root, "android", "app", "src", "main", "res");
const sourceLogo = path.join(assetsDir, "smile-trust-logo-source.png");

async function buildWindowsIcon() {
  const icoPngPaths = [16, 32, 48, 64, 128, 256].map((size) => path.join(buildDir, `icon-${size}.png`));
  const icoBuffer = await toIco(icoPngPaths.map((file) => fs.readFileSync(file)));
  fs.writeFileSync(path.join(assetsDir, "smile-trust-icon.ico"), icoBuffer);
  fs.writeFileSync(path.join(buildDir, "icon.ico"), icoBuffer);
}

function runBrandAssetScript() {
  if (!fs.existsSync(sourceLogo)) {
    throw new Error(`Missing ${sourceLogo}. Add the Smile Trust logo as smile-trust-logo-source.png in assets/.`);
  }
  const scriptPath = path.join(__dirname, "generate-brand-assets.ps1");
  execSync(
    `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -SourcePath "${sourceLogo}" -AssetsDir "${assetsDir}" -BuildDir "${buildDir}" -AndroidResDir "${androidResDir}"`,
    { stdio: "inherit" }
  );
}

fs.mkdirSync(assetsDir, { recursive: true });
fs.mkdirSync(buildDir, { recursive: true });

runBrandAssetScript();

buildWindowsIcon()
  .then(() => {
    console.log("Created Smile Trust logo, login background, and icons from the official artwork.");
  })
  .catch((error) => {
    console.error("Icon generation failed:", error.message);
    process.exit(1);
  });
