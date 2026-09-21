#!/usr/bin/env node
/**
 * Connect an org VCS remote (GAP-007 helper).
 *
 * Requires SMILE_GIT_REMOTE — never invents a host/org/repo.
 * Does not commit, push, or flip HA-* gates.
 *
 * Usage (PowerShell):
 *   $env:SMILE_GIT_REMOTE = "https://github.com/<ORG>/<REPO>.git"
 *   node scripts/connect-git-remote.js
 *   # or: npm run git:connect-remote
 *
 * Flags:
 *   --dry-run   Print planned git remote add without writing (default if no --apply)
 *   --apply     Run `git remote add origin <SMILE_GIT_REMOTE>` when safe
 *   --force-set Replace existing origin URL (still requires SMILE_GIT_REMOTE)
 *
 * Docs: docs/ci-remote-connect.md · docs/backlog/blocked-on-org.md
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const apply = process.argv.includes("--apply");
const forceSet = process.argv.includes("--force-set");
const dryRun = !apply || process.argv.includes("--dry-run");

function runGit(args) {
  return spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true
  });
}

function die(msg, code = 1) {
  console.error(`connect-git-remote: ${msg}`);
  process.exit(code);
}

function main() {
  const remote = String(process.env.SMILE_GIT_REMOTE || "").trim();
  if (!remote) {
    die(
      "SMILE_GIT_REMOTE is required (org HTTPS or SSH URL).\n" +
        "  Example:\n" +
        '    $env:SMILE_GIT_REMOTE = "https://github.com/<ORG>/<REPO>.git"\n' +
        "    node scripts/connect-git-remote.js --apply\n" +
        "See docs/ci-remote-connect.md — do not invent remotes."
    );
  }
  if (/example\.(invalid|com)|<ORG>|<REPO>|your-org|REPLACE/i.test(remote)) {
    die("SMILE_GIT_REMOTE looks like a placeholder — set a real org URL.");
  }
  if (!/^https?:\/\//i.test(remote) && !/^git@/i.test(remote) && !/^ssh:\/\//i.test(remote)) {
    die("SMILE_GIT_REMOTE must be an https://, git@, or ssh:// URL.");
  }

  const gitDir = path.join(root, ".git");
  if (!fs.existsSync(gitDir)) {
    die(
      ".git missing. Initialize locally first (`git init`), then re-run with SMILE_GIT_REMOTE.\n" +
        "This script will not invent a remote host."
    );
  }

  const remotes = runGit(["remote", "-v"]);
  const remoteOut = (remotes.stdout || "").trim();
  const hasOrigin = /^origin\t/m.test(remoteOut);

  console.log("connect-git-remote — GAP-007 helper (no push, no commit)");
  console.log(`  SMILE_GIT_REMOTE=${remote}`);
  console.log(`  existing remotes:\n${remoteOut || "  (none)"}`);

  if (dryRun && !apply) {
    console.log("  mode: dry-run (pass --apply to write remote)");
    if (hasOrigin && !forceSet) {
      console.log("  planned: no-op (origin already set; use --force-set --apply to replace)");
    } else if (hasOrigin && forceSet) {
      console.log(`  planned: git remote set-url origin ${remote}`);
    } else {
      console.log(`  planned: git remote add origin ${remote}`);
    }
    console.log("  next (human): git branch -M main ; git push -u origin main");
    process.exit(0);
  }

  if (hasOrigin && !forceSet) {
    die("origin already configured. Inspect with `git remote -v`, or pass --force-set --apply.");
  }

  const args = hasOrigin
    ? ["remote", "set-url", "origin", remote]
    : ["remote", "add", "origin", remote];
  const result = runGit(args);
  if ((result.status ?? 1) !== 0) {
    die((result.stderr || result.stdout || "git remote failed").trim());
  }
  console.log(`  ok: ${args.join(" ")}`);
  console.log("  next (human): git branch -M main ; git push -u origin main");
  console.log("  then confirm Actions CI is green (docs/ci-remote-connect.md)");
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { main };
