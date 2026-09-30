#!/usr/bin/env node
/**
 * Scan client distributables for privileged secrets. Prints file + rule only (values redacted).
 *
 *   node scripts/scan-client-secrets.js                       # www/ and the Capacitor web copy
 *   node scripts/scan-client-secrets.js --apk path/app.apk     # unpack and scan an APK
 *   node scripts/scan-client-secrets.js --exe path/setup.exe   # unpack NSIS installer / portable EXE
 *   node scripts/scan-client-secrets.js --dir dist/win-unpacked
 *   --report out.json                                          # write a redacted JSON report
 *   --expect-backend <project-ref>                             # fail on any other Supabase project
 *
 * Exits 1 (BLOCKED) when any finding remains.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { localSecretValues, scanDirectory } = require("./lib/client-secret-scan.js");

const root = path.join(__dirname, "..");

function parseArgs(argv) {
  const targets = [];
  let report = "";
  let expectBackend = "";
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--report") report = argv[++i];
    else if (flag === "--expect-backend") {
      expectBackend = String(argv[++i] || "");
      if (!/^[a-z]{20}$/.test(expectBackend)) throw new Error("--expect-backend needs a 20-letter Supabase project ref");
    }
    else if (flag === "--apk" || flag === "--exe" || flag === "--dir") targets.push({ kind: flag.slice(2), path: argv[++i] });
    else throw new Error(`Unknown argument: ${flag}`);
  }
  if (!targets.length) {
    targets.push({ kind: "dir", path: "www" });
    const capacitorCopy = "android/app/src/main/assets/public";
    if (fs.existsSync(path.join(root, capacitorCopy))) targets.push({ kind: "dir", path: capacitorCopy });
  }
  return { targets, report, expectBackend };
}

function sevenZip() {
  const arch = process.arch === "arm64" ? "arm64" : process.arch === "ia32" ? "ia32" : "x64";
  const bin = process.platform === "win32"
    ? path.join(root, "node_modules", "7zip-bin", "win", arch, "7za.exe")
    : path.join(root, "node_modules", "7zip-bin", process.platform === "darwin" ? "mac" : "linux", arch, "7za");
  if (!fs.existsSync(bin)) throw new Error("7zip-bin is not installed (npm install)");
  return bin;
}

function extractArchive(file, dest) {
  fs.mkdirSync(dest, { recursive: true });
  execFileSync(sevenZip(), ["x", "-y", `-o${dest}`, file], { stdio: "ignore" });
}

function* filesUnder(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* filesUnder(full);
    else yield full;
  }
}

/** Expand nested payloads (NSIS app-64.7z, app.asar) in place so their contents are scanned. */
function expandNested(dir) {
  let expanded = true;
  const done = new Set();
  while (expanded) {
    expanded = false;
    for (const file of [...filesUnder(dir)]) {
      if (done.has(file)) continue;
      const lower = file.toLowerCase();
      if (lower.endsWith(".7z")) {
        extractArchive(file, `${file}.d`);
        done.add(file);
        expanded = true;
      } else if (lower.endsWith(".asar")) {
        require("@electron/asar").extractAll(file, `${file}.d`);
        done.add(file);
        expanded = true;
      }
    }
  }
}

function prepareTarget(target) {
  const full = path.resolve(root, target.path);
  if (!fs.existsSync(full)) throw new Error(`Missing ${target.kind}: ${target.path}`);
  if (target.kind === "dir") {
    const hasAsar = [...filesUnder(full)].some((file) => file.toLowerCase().endsWith(".asar"));
    if (!hasAsar) return { dir: full, cleanup: () => {} };
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "st-scan-"));
    fs.cpSync(full, temp, { recursive: true });
    expandNested(temp);
    return { dir: temp, cleanup: () => fs.rmSync(temp, { recursive: true, force: true }) };
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "st-scan-"));
  extractArchive(full, temp);
  expandNested(temp);
  return { dir: temp, cleanup: () => fs.rmSync(temp, { recursive: true, force: true }) };
}

function main() {
  const { targets, report, expectBackend } = parseArgs(process.argv.slice(2));
  const secretValues = localSecretValues(root);
  console.log(`Checking for ${secretValues.length} locally configured secret value(s) plus built-in rules (values never printed).`);
  if (expectBackend) console.log(`Expected Supabase project: ${expectBackend}`);
  const results = [];
  for (const target of targets) {
    const prepared = prepareTarget(target);
    try {
      const { files, findings, backends } = scanDirectory(prepared.dir, { secretValues, expectBackend });
      results.push({ target: `${target.kind}:${target.path}`, files, backends, findings });
      console.log(`\n${target.kind} ${target.path}: ${files} files scanned, ${findings.length} finding(s)`);
      console.log(`  Supabase projects referenced: ${backends.map((item) => `${item.ref} (${item.files} file(s))`).join(", ") || "none"}`);
      for (const finding of findings) console.log(`  [${finding.rule}] ${finding.file} - ${finding.detail}`);
    } finally {
      prepared.cleanup();
    }
  }
  const total = results.reduce((sum, item) => sum + item.findings.length, 0);
  if (report) {
    fs.mkdirSync(path.dirname(path.resolve(root, report)), { recursive: true });
    fs.writeFileSync(path.resolve(root, report), `${JSON.stringify({
      scannedAt: new Date().toISOString(),
      expectBackend: expectBackend || null,
      secretValuesChecked: secretValues.map((item) => item.label),
      results,
      status: total ? "BLOCKED" : "CLEAN"
    }, null, 2)}\n`);
  }
  console.log(`\n${total ? "BLOCKED" : "CLEAN"}: ${total} finding(s) across ${results.length} target(s).`);
  process.exit(total ? 1 : 0);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
