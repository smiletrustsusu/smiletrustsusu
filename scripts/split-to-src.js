const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const sourcePath = path.join(root, "app.js");
const lines = fs.readFileSync(sourcePath, "utf8").split(/\r?\n/);

const sections = [
  { file: "src/ui/views.js", start: 440, end: 1931, exports: true },
  { file: "src/ui/handlers.js", start: 1933, end: 3557, exports: true },
  { file: "src/ui/print.js", start: 3558, end: 3659, exports: true },
  { file: "src/ui/imports.js", start: 3660, end: 4059, exports: true },
  { file: "src/core/runtime.js", start: 57, end: 438, exports: true }
];

const skipLines = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56]);

function slice(start, end) {
  return lines.slice(start - 1, end).join("\n");
}

function transformBody(body) {
  return body
    .replace(/\bstate\./g, "App.state.")
    .replace(/\bstate,/g, "App.state,")
    .replace(/\bstate\)/g, "App.state)")
    .replace(/\(\s*state\s*=/g, "(App.state =")
    .replace(/\bstate =/g, "App.state =")
    .replace(/\bstate;\s*$/gm, "App.state;")
    .replace(/\bsessionUserId\b/g, "App.sessionUserId")
    .replace(/\bactiveView\b/g, "App.activeView")
    .replace(/\bsyncTimer\b/g, "App.syncTimer")
    .replace(/\bsyncBusy\b/g, "App.syncBusy")
    .replace(/\bgatewayTimer\b/g, "App.gatewayTimer")
    .replace(/\bautoSyncTimer\b/g, "App.autoSyncTimer")
    .replace(/\blocalSavePending\b/g, "App.localSavePending")
    .replace(/\blastAndroidRefreshAt\b/g, "App.lastAndroidRefreshAt")
    .replace(/\bapp\.innerHTML/g, "App.root.innerHTML")
    .replace(/\bapp\b/g, "App.root")
    .replace(/function hashPassword[\s\S]*?^}/m, "// hashPassword moved to src/password.js")
    .replace(/const DEFAULT_SUPABASE_URL =[\s\S]*?\n/g, "")
    .replace(/const DEFAULT_SUPABASE_ANON_KEY =[\s\S]*?\n/g, "")
    .replace(/const CLOUD_BUSINESS_ID =[\s\S]*?\n/g, "");
}

function exportFunctions(body) {
  const names = [];
  body.replace(/^(?:async )?function (\w+)/gm, (_, name) => {
    names.push(name);
    return _;
  });
  return names;
}

const viewHeader = `import { App } from "../context.js";
import { REMEMBER_LOGIN_KEY, ANDROID_CLOUD_PRIMARY_KEY } from "../constants.js";
import { restoreCloudBackupFromCloud, connectLoginSync, replaceLoginSync } from "../sync/cloud.js";
import { togglePassword } from "../core/runtime.js";
import { findLoginUser } from "../core/auth.js";
import { renderApp } from "./app-shell.js";
import * as H from "./handlers.js";
import * as D from "./domain.js";

`;

const handlerHeader = `import { App } from "../context.js";
import { pushCloudBackup, restoreCloudBackupFromCloud } from "../sync/cloud.js";
import * as D from "./domain.js";
import * as P from "./print.js";
import * as I from "./imports.js";

`;

for (const section of sections) {
  let body = slice(section.start, section.end);
  body = transformBody(body);
  const names = exportFunctions(body);
  const exportLine = `\nexport {\n  ${names.join(",\n  ")}\n};\n`;
  let header = `import { App } from "../context.js";\n\n`;
  if (section.file.includes("views.js")) header = viewHeader;
  if (section.file.includes("handlers.js")) header = handlerHeader;
  if (section.file.includes("print.js")) header = `import { App } from "../context.js";\nimport { toast } from "../core/runtime.js";\nimport * as D from "./domain.js";\n\n`;
  if (section.file.includes("imports.js")) header = `import { App } from "../context.js";\nimport { saveState } from "../core/state.js";\nimport { pushCloudBackup } from "../sync/cloud.js";\nimport * as D from "./domain.js";\n\n`;
  if (section.file.includes("runtime.js")) header = "";
  const target = path.join(root, section.file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${header}${body}${section.exports ? exportLine : ""}`);
}

console.log("Extracted UI modules from app.js");
