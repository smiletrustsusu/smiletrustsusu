const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const coreSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const coreNames = [...coreSource.matchAll(/^(?:async )?function (\w+)/gm)]
  .map((match) => match[1])
  .filter((name) => !["render", "renderLogin", "renderApp"].includes(name));

const uiFiles = [
  "src/ui/views.js",
  "src/ui/handlers.js",
  "src/ui/print.js",
  "src/ui/imports.js"
];

const localExports = new Set();
for (const file of uiFiles) {
  const full = path.join(root, file);
  const text = fs.readFileSync(full, "utf8");
  for (const match of text.matchAll(/^export (?:async )?function (\w+)/gm)) {
    localExports.add(match[1]);
  }
}

for (const file of uiFiles) {
  const full = path.join(root, file);
  let text = fs.readFileSync(full, "utf8");
  for (const name of coreNames) {
    if (localExports.has(name)) continue;
    text = text.replace(new RegExp(`\\b${name}\\(`, "g"), `rt.${name}(`);
    text = text.replace(new RegExp(`\\b${name}\\(`, "g"), `rt.${name}(`);
  }
  for (const name of localExports) {
    text = text.replace(new RegExp(`\\brt\\.${name}\\(`, "g"), `${name}(`);
  }
  fs.writeFileSync(full, text);
  console.log(`Patched ${file}`);
}

console.log(`Registered ${coreNames.length} core function references.`);
