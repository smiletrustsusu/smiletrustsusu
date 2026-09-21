const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const lines = fs.readFileSync(path.join(root, "app.js"), "utf8").split(/\r?\n/);

const coreLines = lines.slice(0, 500);
const tailLines = lines.slice(4124);

const coreFns = [...coreLines.join("\n").matchAll(/^(?:async )?function (\w+)/gm)].map((m) => m[1]);
const tailFns = [...tailLines.join("\n").matchAll(/^(?:async )?function (\w+)/gm)].map((m) => m[1]);
const allCore = [...new Set([...coreFns, ...tailFns, "syncToApp", "syncFromApp"])];

const imports = `import { registerRuntime, rt } from "./src/runtime.js";
import { render } from "./src/ui/views.js";
import { attachHandlers } from "./src/ui/handlers.js";
import * as Print from "./src/ui/print.js";
import * as Imports from "./src/ui/imports.js";
`;

const bridge = `
function syncRefsToRuntime() {
  rt.state = state;
  rt.sessionUserId = sessionUserId;
  rt.activeView = activeView;
  rt.syncTimer = syncTimer;
  rt.syncBusy = syncBusy;
  rt.gatewayTimer = gatewayTimer;
  rt.autoSyncTimer = autoSyncTimer;
  rt.localSavePending = localSavePending;
  rt.lastAndroidRefreshAt = lastAndroidRefreshAt;
  rt.root = app;
}

function syncRefsFromRuntime() {
  state = rt.state;
  sessionUserId = rt.sessionUserId;
  activeView = rt.activeView;
  syncTimer = rt.syncTimer;
  syncBusy = rt.syncBusy;
  gatewayTimer = rt.gatewayTimer;
  autoSyncTimer = rt.autoSyncTimer;
  localSavePending = rt.localSavePending;
  lastAndroidRefreshAt = rt.lastAndroidRefreshAt;
}

function registerAppRuntime() {
  syncRefsToRuntime();
  registerRuntime({
    attachHandlers,
    render,
${allCore.filter((n) => !["render"].includes(n)).map((n) => `    ${n}`).join(",\n")},
    openPrintWindow: Print.openPrintWindow,
    printReceipt: Print.printReceipt,
    printMemberStatement: Print.printMemberStatement,
    printDailyInputLog: Print.printDailyInputLog,
    printClosingById: Print.printClosingById,
    printClosing: Print.printClosing,
    importFileRecords: Imports.importFileRecords,
    importWorkbook: Imports.importWorkbook,
    extractDocumentText: Imports.extractDocumentText,
    rowsFromText: Imports.rowsFromText,
    splitImportLine: Imports.splitImportLine,
    importSavingsRows: Imports.importSavingsRows,
    importLoanRows: Imports.importLoanRows,
    importLogRows: Imports.importLogRows,
    ensureCustomerFromRow: Imports.ensureCustomerFromRow,
    textValue: Imports.textValue,
    numberValue: Imports.numberValue,
    dateValue: Imports.dateValue,
    normalizeHeader: Imports.normalizeHeader
  });
}

const originalSyncToApp = syncToApp;
syncToApp = function syncToAppWrapped() {
  syncRefsToRuntime();
  originalSyncToApp();
};

const originalSyncFromApp = syncFromApp;
syncFromApp = function syncFromAppWrapped() {
  originalSyncFromApp();
  syncRefsFromRuntime();
};
`;

const head = lines.slice(0, 26).join("\n");
const coreBody = lines.slice(26, 500).join("\n");
const tailBody = tailLines.join("\n");

const out = `${head}
${imports}
${coreBody}
${bridge}
${tailBody.replace("async function initializeApp()", "async function initializeApp()").replace(
  "async function initializeApp() {",
  "async function initializeApp() {\n  registerAppRuntime();"
)}
`;

fs.writeFileSync(path.join(root, "app.js"), out);
console.log("Rewired app.js to use UI modules.");
