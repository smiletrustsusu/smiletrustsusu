/**
 * Generate Smile Trust PWA/desktop/Android launcher icons.
 *
 * Source priority:
 *   1. assets/smile-trust-logo-source.png (official artwork drop-in)
 *   2. Rendered from in-repo brand mark (assets/smile-trust-mark.svg design)
 *      via scripts/render-brand-logo-source.ps1
 *
 * Writes web assets under assets/ and Android mipmaps under
 * android/app/src/main/res when that tree exists.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const toIco = require("to-ico");

const root = path.join(__dirname, "..");
const assetsDir = path.join(root, "assets");
const buildDir = path.join(root, "build");
const androidResDir = path.join(root, "android", "app", "src", "main", "res");
const sourceLogo = path.join(assetsDir, "smile-trust-logo-source.png");
const brandMarkSvg = path.join(assetsDir, "smile-trust-mark.svg");

function ensureSourceLogo() {
  if (fs.existsSync(sourceLogo)) {
    console.log(`Icon source: ${path.relative(root, sourceLogo)}`);
    return sourceLogo;
  }
  if (!fs.existsSync(brandMarkSvg)) {
    throw new Error(
      `Missing ${path.relative(root, sourceLogo)} and ${path.relative(root, brandMarkSvg)}. ` +
        "Add the Smile Trust logo as smile-trust-logo-source.png in assets/."
    );
  }
  const scriptPath = path.join(__dirname, "render-brand-logo-source.ps1");
  console.log(
    `Icon source: rendering from ${path.relative(root, brandMarkSvg)} → ${path.relative(root, sourceLogo)}`
  );
  execSync(
    `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -OutputPath "${sourceLogo}" -Size 1024`,
    { stdio: "inherit" }
  );
  if (!fs.existsSync(sourceLogo)) {
    throw new Error(`Failed to render ${sourceLogo}`);
  }
  return sourceLogo;
}

async function buildWindowsIcon() {
  const icoPngPaths = [16, 32, 48, 64, 128, 256].map((size) => path.join(buildDir, `icon-${size}.png`));
  for (const file of icoPngPaths) {
    if (!fs.existsSync(file)) {
      throw new Error(`Missing ${file} after brand asset generation`);
    }
  }
  const icoBuffer = await toIco(icoPngPaths.map((file) => fs.readFileSync(file)));
  fs.writeFileSync(path.join(assetsDir, "smile-trust-icon.ico"), icoBuffer);
  fs.writeFileSync(path.join(buildDir, "icon.ico"), icoBuffer);
}

function patchAndroidAdaptiveBackground() {
  const bgXml = path.join(androidResDir, "values", "ic_launcher_background.xml");
  if (!fs.existsSync(path.dirname(bgXml))) return;
  fs.mkdirSync(path.dirname(bgXml), { recursive: true });
  fs.writeFileSync(
    bgXml,
    `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<resources>\n` +
      `    <color name="ic_launcher_background">#0D6B5C</color>\n` +
      `</resources>\n`
  );
  console.log("Set Android adaptive icon background to #0D6B5C");
}

function runBrandAssetScript(sourcePath) {
  const scriptPath = path.join(__dirname, "generate-brand-assets.ps1");
  const androidDir = fs.existsSync(androidResDir) ? androidResDir : path.join(buildDir, "android-res-staging");
  fs.mkdirSync(androidDir, { recursive: true });
  execSync(
    `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -SourcePath "${sourcePath}" -AssetsDir "${assetsDir}" -BuildDir "${buildDir}" -AndroidResDir "${androidDir}"`,
    { stdio: "inherit" }
  );
  if (androidDir !== androidResDir && fs.existsSync(androidResDir)) {
    // Should not happen; staging only when android/ missing
    console.log(`Android res not present yet; icons staged under ${path.relative(root, androidDir)}`);
  }
}

fs.mkdirSync(assetsDir, { recursive: true });
fs.mkdirSync(buildDir, { recursive: true });

const resolvedSource = ensureSourceLogo();
runBrandAssetScript(resolvedSource);
patchAndroidAdaptiveBackground();

buildWindowsIcon()
  .then(() => {
    console.log(
      "Created Smile Trust logo, PWA icons, and Android launcher icons from " +
        path.relative(root, resolvedSource)
    );
  })
  .catch((error) => {
    console.error("Icon generation failed:", error.message);
    process.exit(1);
  });
