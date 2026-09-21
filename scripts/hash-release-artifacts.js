#!/usr/bin/env node
/**
 * GAP-012 — Hash release artifacts (APK / EXE / AAB) into docs/release-evidence when present.
 *
 * Does not invent binaries. Exit 0 with a checklist JSON even if artifacts are missing
 * (status: waiting). Exit 1 only on I/O failure.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const evidenceDir = path.join(root, "docs", "release-evidence");
const outPath = path.join(evidenceDir, "artifact-hashes.json");
const checklistPath = path.join(evidenceDir, "artifact-hash-checklist.md");

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function pushIfExists(found, entry) {
  const abs = path.join(root, entry.path);
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
    found.push({ ...entry, absolutePath: abs });
  }
}

function collectCandidates() {
  const found = [];

  pushIfExists(found, {
    id: "android-debug-apk",
    channel: "android",
    kind: "debug",
    path: "android/app/build/outputs/apk/debug/app-debug.apk"
  });
  pushIfExists(found, {
    id: "android-debug-apk-unsigned",
    channel: "android",
    kind: "debug",
    path: "android/app/build/outputs/apk/debug/app-debug-unsigned.apk"
  });
  pushIfExists(found, {
    id: "android-release-apk",
    channel: "android",
    kind: "release",
    path: "android/app/build/outputs/apk/release/app-release.apk"
  });
  pushIfExists(found, {
    id: "android-release-apk-unsigned",
    channel: "android",
    kind: "release-unsigned",
    path: "android/app/build/outputs/apk/release/app-release-unsigned.apk"
  });

  const bundleDir = path.join(root, "android", "app", "build", "outputs", "bundle", "release");
  if (fs.existsSync(bundleDir)) {
    for (const name of fs.readdirSync(bundleDir)) {
      if (!name.toLowerCase().endsWith(".aab")) continue;
      pushIfExists(found, {
        id: `android-release-aab-${name}`,
        channel: "android",
        kind: "bundle",
        path: `android/app/build/outputs/bundle/release/${name}`
      });
    }
  }

  const dist = path.join(root, "dist");
  if (fs.existsSync(dist)) {
    for (const name of fs.readdirSync(dist)) {
      const abs = path.join(dist, name);
      if (!fs.statSync(abs).isFile()) continue;
      const lower = name.toLowerCase();
      if (lower.endsWith(".exe") && lower.includes("setup")) {
        found.push({
          id: "windows-nsis",
          channel: "windows",
          kind: "release",
          path: `dist/${name}`,
          absolutePath: abs
        });
      } else if (lower.endsWith(".exe") && lower.includes("portable")) {
        found.push({
          id: "windows-portable",
          channel: "windows",
          kind: "release",
          path: `dist/${name}`,
          absolutePath: abs
        });
      } else if (lower.endsWith(".blockmap")) {
        found.push({
          id: `windows-blockmap-${name}`,
          channel: "windows",
          kind: "updater-meta",
          path: `dist/${name}`,
          absolutePath: abs
        });
      } else if (lower === "latest.yml") {
        found.push({
          id: "windows-latest-yml",
          channel: "windows",
          kind: "updater-meta",
          path: `dist/${name}`,
          absolutePath: abs
        });
      } else if (lower.endsWith(".exe") && (lower.includes("smile") || lower.includes("susu"))) {
        found.push({
          id: `windows-exe-${name}`,
          channel: "windows",
          kind: "artifact",
          path: `dist/${name}`,
          absolutePath: abs
        });
      }
    }
  }

  return found;
}

function assessSigningHints() {
  const androidProps = fs.existsSync(path.join(root, "android", "keystore.properties"));
  const androidKeystore = fs.existsSync(
    path.join(root, "android", "smile-trust-release.keystore")
  );
  const cscLink = process.env.CSC_LINK || process.env.WIN_CSC_LINK || "";
  const cscPresent = Boolean(cscLink);
  const cscPathExists = cscLink && !/^https?:/i.test(cscLink) ? fs.existsSync(cscLink) : null;
  const updateFeed = process.env.SMILE_UPDATE_FEED_URL || "";
  return {
    androidKeystorePropertiesPresent: androidProps,
    androidKeystoreFilePresent: androidKeystore,
    electronCscEnvPresent: cscPresent,
    electronCscPathExists: cscPathExists,
    smileUpdateFeedConfigured: Boolean(updateFeed) && !/example\.(invalid|com)/i.test(updateFeed),
    note: "Signing secrets are never invented; org must supply Android keystore + CSC_* for production."
  };
}

function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const candidates = collectCandidates();
  const artifacts = [];

  for (const c of candidates) {
    const st = fs.statSync(c.absolutePath);
    artifacts.push({
      id: c.id,
      channel: c.channel,
      kind: c.kind,
      path: c.path,
      bytes: st.size,
      mtimeUtc: st.mtime.toISOString(),
      sha256: sha256File(c.absolutePath)
    });
  }

  const releaseApk = artifacts.some((a) => a.id === "android-release-apk");
  const releaseApkUnsigned = artifacts.some((a) => a.id === "android-release-apk-unsigned");
  const releaseExe = artifacts.some(
    (a) => a.channel === "windows" && (a.id === "windows-nsis" || a.id === "windows-portable")
  );
  const debugApk = artifacts.some(
    (a) => a.id === "android-debug-apk" || a.id === "android-debug-apk-unsigned"
  );
  const signing = assessSigningHints();

  let status = "waiting";
  if (releaseApk && releaseExe) status = "ready_for_signoff";
  else if (artifacts.length) status = "partial";

  const payload = {
    schemaVersion: "smile-trust-artifact-hashes/1.1",
    gapId: "GAP-012",
    backlogId: "TASK-000187",
    generatedAtUtc: new Date().toISOString(),
    status,
    notes: [
      "Hashes are recorded only for files present on disk.",
      "Signed production artifacts still require org CSC_* / Android keystore secrets (do not invent).",
      "Debug APK hashes help pilot verification; release APK+EXE needed for GAP-012 Completed.",
      "Unsigned release APK (app-release-unsigned.apk) is evidence of build path only — not production-ready."
    ],
    checklist: {
      androidDebugApkPresent: debugApk,
      androidReleaseApkPresent: releaseApk,
      androidReleaseApkUnsignedPresent: releaseApkUnsigned,
      windowsExePresent: releaseExe,
      hashesWritten: artifacts.length > 0
    },
    signingHints: signing,
    artifacts
  };

  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const lines = [
    "# GAP-012 artifact hash checklist",
    "",
    `Generated: ${payload.generatedAtUtc}`,
    `Status: **${status}**`,
    "",
    "| Check | Present |",
    "|-------|---------|",
    `| Android debug APK | ${debugApk ? "yes" : "no"} |`,
    `| Android release APK (signed path) | ${releaseApk ? "yes" : "no"} |`,
    `| Android release APK unsigned | ${releaseApkUnsigned ? "yes" : "no"} |`,
    `| Windows EXE (NSIS/portable) | ${releaseExe ? "yes" : "no"} |`,
    `| Android keystore.properties (local) | ${signing.androidKeystorePropertiesPresent ? "yes" : "no"} |`,
    `| Electron CSC_* env | ${signing.electronCscEnvPresent ? "yes" : "no"} |`,
    `| Update feed configured | ${signing.smileUpdateFeedConfigured ? "yes" : "no"} |`,
    "",
    "## Artifacts",
    ""
  ];
  if (!artifacts.length) {
    lines.push(
      "_No APK/EXE found. Build with `npm run pilot:android` / `npm run release:android` and/or `npm run build:exe`, then re-run `npm run hash:artifacts`._"
    );
  } else {
    lines.push("| ID | Path | SHA-256 | Bytes |");
    lines.push("|----|------|---------|-------|");
    for (const a of artifacts) {
      lines.push(`| ${a.id} | \`${a.path}\` | \`${a.sha256}\` | ${a.bytes} |`);
    }
  }
  lines.push("");
  lines.push("Machine JSON: `docs/release-evidence/artifact-hashes.json`");
  lines.push("");
  fs.writeFileSync(checklistPath, `${lines.join("\n")}\n`, "utf8");

  console.log(`hash:artifacts — status=${status}; count=${artifacts.length}`);
  console.log(`  wrote ${path.relative(root, outPath)}`);
  console.log(`  wrote ${path.relative(root, checklistPath)}`);
  for (const a of artifacts) {
    console.log(`  ${a.id} sha256=${a.sha256.slice(0, 16)}…`);
  }
  if (status === "waiting") {
    console.log("  waiting: produce APK/EXE then re-run");
  }
  process.exit(0);
}

main();
