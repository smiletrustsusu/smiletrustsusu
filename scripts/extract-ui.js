const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const lines = fs.readFileSync(path.join(root, "app.js"), "utf8").split(/\r?\n/);

const sections = [
  { file: "src/ui/views.js", start: 501, end: 1998 },
  { file: "src/ui/handlers.js", start: 1999, end: 3621 },
  { file: "src/ui/print.js", start: 3622, end: 3723 },
  { file: "src/ui/imports.js", start: 3724, end: 4124 }
];

const reserved = new Set([
  "defaultState",
  "normalizeState",
  "loadState",
  "saveState",
  "mergeStates",
  "normalizeStateForMerge",
  "restoreCloudBackupFromCloud",
  "pushCloudBackup",
  "replaceCloudBackup",
  "replaceFromCloud",
  "latestCloudSnapshot",
  "initializeApp",
  "hashPasswordForUser"
]);

function transform(code) {
  const vars = [
    "sessionUserId",
    "activeView",
    "syncTimer",
    "syncBusy",
    "gatewayTimer",
    "autoSyncTimer",
    "localSavePending",
    "lastAndroidRefreshAt"
  ];
  let out = code;
  for (const name of vars) {
    out = out.replace(new RegExp(`\\b${name}\\b`, "g"), `rt.${name}`);
  }
  out = out.replace(/(?<![a-zA-Z])state(?![a-zA-Z])/g, (match, offset, str) => {
    for (const word of reserved) {
      const idx = offset - word.length + word.indexOf("state");
      if (idx >= 0 && str.slice(idx, idx + word.length) === word) return match;
    }
    const before = str.slice(Math.max(0, offset - 12), offset);
    if (/default|normalize|load|save|merge|restore|push|replace|latest|initialize|hashPasswordFor/.test(before)) return match;
    return "rt.state";
  });
  out = out.replace(/\bapp\.innerHTML/g, "rt.root.innerHTML");
  out = out.replace(/document\.querySelector\("#app"\)/g, "rt.root");
  out = out.replace(/^function /gm, "export function ");
  out = out.replace(/^async function /gm, "export async function ");
  return out;
}

const header = `import { rt } from "../runtime.js";\n\n`;

for (const section of sections) {
  const body = transform(lines.slice(section.start - 1, section.end).join("\n"));
  const target = path.join(root, section.file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${header}${body}\n`);
  console.log(`Wrote ${section.file} (${section.end - section.start + 1} lines)`);
}

fs.writeFileSync(
  path.join(root, "src/ui/index.js"),
  `export * from "./views.js";\nexport * from "./handlers.js";\nexport * from "./print.js";\nexport * from "./imports.js";\n`
);

console.log("UI modules extracted.");
