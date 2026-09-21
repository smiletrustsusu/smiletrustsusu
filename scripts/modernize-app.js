const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const appPath = path.join(root, "app.js");
let source = fs.readFileSync(appPath, "utf8");

const header = `import { App } from "./src/context.js";
import {
  getAppConfig,
  getSyncMode,
  loadAppConfig,
  persistCloudSettings,
  resolvedLocalBackupUrl,
  resolvedSupabaseKey,
  resolvedSupabaseUrl,
  resolveBusinessId
} from "./src/config.js";
import {
  getDefaultKbaPassword,
  hashPassword,
  legacyHash,
  readDefaultKbaPasswordFromConfig,
  verifyPassword
} from "./src/password.js";
import {
  connectLoginSync as connectLoginSyncRemote,
  latestCloudSnapshot as latestRemoteSnapshot,
  pushCloudBackup as pushRemoteBackup,
  replaceFromCloud as replaceFromCloudRemote,
  restoreCloudBackupFromCloud as restoreRemoteBackup,
  startAutoCloudSync as startRemoteAutoSync
} from "./src/sync/cloud.js";

function syncToApp() {
  App.state = state;
  App.sessionUserId = sessionUserId;
  App.activeView = activeView;
  App.syncTimer = syncTimer;
  App.syncBusy = syncBusy;
  App.gatewayTimer = gatewayTimer;
  App.autoSyncTimer = autoSyncTimer;
  App.localSavePending = localSavePending;
  App.lastAndroidRefreshAt = lastAndroidRefreshAt;
}

function syncFromApp() {
  state = App.state;
  sessionUserId = App.sessionUserId;
  activeView = App.activeView;
  syncTimer = App.syncTimer;
  syncBusy = App.syncBusy;
  gatewayTimer = App.gatewayTimer;
  autoSyncTimer = App.autoSyncTimer;
  localSavePending = App.localSavePending;
  lastAndroidRefreshAt = App.lastAndroidRefreshAt;
}

`;

source = source.replace(
  /^const STORE_KEY[\s\S]*?let lastAndroidRefreshAt = 0;\n\nconst defaultState/m,
  `${header}const STORE_KEY`
);

source = source.replace(
  /const DEFAULT_SUPABASE_URL =[\s\S]*?\nconst DEFAULT_SUPABASE_ANON_KEY =[\s\S]*?\nconst CLOUD_BUSINESS_ID =[\s\S]*?\nconst CLOUD_SNAPSHOT_TABLE =[\s\S]*?\n/,
  `const CLOUD_SNAPSHOT_TABLE = "kba_cloud_snapshots";\n`
);

source = source.replace(
  /passwordHash: hashPassword\("King05491"\)/,
  `passwordHash: legacyHash(getDefaultKbaPassword())`
);

source = source.replace(
  /if \(!kba\.passwordHash\) kba\.passwordHash = hashPassword\("King05491"\);/,
  `if (!kba.passwordHash) kba.passwordHash = legacyHash(getDefaultKbaPassword());`
);

source = source.replace(
  /function findLoginUser\(username, password\) \{\n  const passwordHash = hashPassword\(password\);\n  return state\.users\.find\(\(item\) => item\.username\?\.toLowerCase\(\) === username && item\.passwordHash === passwordHash && item\.active && !item\.pending\);\n\}/,
  `async function findLoginUser(username, password) {
  const user = state.users.find((item) => item.username?.toLowerCase() === username && item.active && !item.pending);
  if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
  if (user.passwordHash?.startsWith("kba-")) {
    user.passwordHash = await hashPassword(password);
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }
  return user;
}`
);

source = source.replace(
  /normalized\.settings\.cloudUrl = normalized\.settings\.cloudUrl \|\| localStorage\.getItem\(SYNC_URL_KEY\) \|\| DEFAULT_SUPABASE_URL;/,
  `normalized.settings.cloudUrl = normalized.settings.cloudUrl || localStorage.getItem(SYNC_URL_KEY) || resolvedSupabaseUrl(normalized);`
);

source = source.replace(
  /normalized\.settings\.cloudKey = normalized\.settings\.cloudKey \|\| localStorage\.getItem\("kba_susu_cloud_key"\) \|\| DEFAULT_SUPABASE_ANON_KEY;/,
  `normalized.settings.cloudKey = normalized.settings.cloudKey || localStorage.getItem("kba_susu_cloud_key") || resolvedSupabaseKey(normalized);
  normalized.settings.localBackupUrl = normalized.settings.localBackupUrl || resolvedLocalBackupUrl(normalized);
  normalized.settings.businessId = resolveBusinessId(normalized);`
);

source = source.replace(
  /if \(user\.password && !user\.passwordHash\) user\.passwordHash = hashPassword\(user\.password\);/,
  `if (user.password && !user.passwordHash) user.passwordHash = user.password;`
);

source = source.replace(
  /function cloudUrl\(\) \{\n  return \(state\.settings\.cloudUrl \|\| localStorage\.getItem\(SYNC_URL_KEY\) \|\| DEFAULT_SUPABASE_URL\)\.replace\(\/\\\/\$\/, ""\);\n\}/,
  `function cloudUrl() {
  return resolvedSupabaseUrl(state);
}`
);

source = source.replace(
  /function cloudKey\(\) \{\n  return state\.settings\.cloudKey \|\| localStorage\.getItem\("kba_susu_cloud_key"\) \|\| DEFAULT_SUPABASE_ANON_KEY;\n\}/,
  `function cloudKey() {
  return resolvedSupabaseKey(state);
}

function businessId() {
  return resolveBusinessId(state);
}

function localBackupUrl() {
  return resolvedLocalBackupUrl(state);
}`
);

source = source.replace(
  /function hashPassword\(value\) \{\n  let hash = 2166136261;[\s\S]*?return `kba-\$\{\(hash >>> 0\)\.toString\(16\)\}`;\n\}/,
  `async function hashPasswordForUser(value) {
  return hashPassword(value);
}`
);

source = source.replace(/\bhashPassword\(/g, (match, offset) => {
  const before = source.slice(Math.max(0, offset - 40), offset);
  if (before.includes("async function hashPasswordForUser") || before.includes("from \"./src/password.js\"")) return match;
  return "hashPasswordForUser(";
});

source = source.replace(
  /let user = findLoginUser\(username, password\);/,
  `let user = await findLoginUser(username, password);`
);

source = source.replace(
  /user = findLoginUser\(username, password\);/,
  `user = await findLoginUser(username, password);`
);

source = source.replace(
  /function renderSettings\(\) \{[\s\S]*?<div class="notice">These are fallback defaults\.[\s\S]*?<\/div>\n    <\/div>\n  `;\n\}/,
  `function renderSettings() {
  if (!isKBA()) return \`<div class="notice">System defaults are controlled by KBA. Group operating rules are managed from My Group.</div>\`;
  const syncMode = getSyncMode(state);
  return \`
    <div class="panel">
      <div class="section-title"><h2>System Controls</h2></div>
      <form id="settingsForm" class="form-grid">
        <div class="field"><label>Business Name</label><input name="businessName" value="\${escapeAttr(state.settings.businessName)}" required /></div>
        <div class="field"><label>Currency</label><input name="currency" value="\${escapeAttr(state.settings.currency)}" required /></div>
        <div class="field"><label>Default Collection Days</label><input name="collectionDays" type="number" min="1" value="\${state.settings.collectionDays}" required /></div>
        <div class="field"><label>Default Loan Interest %</label><input name="loanInterest" type="number" min="0" step="0.01" value="\${state.settings.loanInterest}" required /></div>
        <div class="field"><label>Business ID</label><input name="businessId" value="\${escapeAttr(businessId())}" readonly /></div>
        <div class="field"><label>Cloud Mode</label><select name="cloudMode"><option value="auto" \${state.settings.cloudMode === "auto" ? "selected" : ""}>Auto detect</option><option value="supabase" \${state.settings.cloudMode === "supabase" ? "selected" : ""}>Supabase</option><option value="local" \${state.settings.cloudMode === "local" ? "selected" : ""}>Local backup server</option></select></div>
        <div class="field full"><label>Supabase Project URL</label><input name="cloudUrl" value="\${escapeAttr(cloudUrl())}" placeholder="https://your-project.supabase.co" /></div>
        <div class="field full"><label>Supabase Anon Key</label><textarea name="cloudKey" placeholder="Paste Supabase anon public key">\${escapeHtml(cloudKey())}</textarea></div>
        <div class="field full"><label>Local Backup URL</label><input name="localBackupUrl" value="\${escapeAttr(localBackupUrl())}" placeholder="http://localhost:8787" /></div>
        <div class="field full"><label>Sync Token</label><input name="syncToken" value="\${escapeAttr(state.settings.syncToken || "")}" placeholder="Optional token for local backup server" /></div>
        <div class="form-actions full"><button class="btn" type="submit">Save settings</button></div>
      </form>
      <div class="notice">Active sync mode: <strong>\${syncMode}</strong>. Supabase stores online snapshots. The local backup URL uses the desktop sync server at /backup. Copy config.example.json to config.json for deployment defaults.</div>
    </div>
  \`;
}`
);

source = source.replace(
  /function handleSettings\(event\) \{[\s\S]*?toast\("Settings saved"\);\n  render\(\);\n\}/,
  `function handleSettings(event) {
  event.preventDefault();
  const data = formData(event.target);
  Object.assign(state.settings, {
    businessName: data.businessName,
    currency: data.currency,
    collectionDays: Number(data.collectionDays),
    loanInterest: Number(data.loanInterest),
    cloudMode: data.cloudMode || "auto"
  });
  persistCloudSettings(state, {
    cloudUrl: data.cloudUrl,
    cloudKey: data.cloudKey,
    localBackupUrl: data.localBackupUrl,
    syncToken: data.syncToken,
    businessId: data.businessId
  });
  saveState();
  toast("Settings saved");
  render();
}`
);

source = source.replace(
  /async function pushCloudBackup\(silent = false\) \{[\s\S]*?  \} finally \{\n    syncBusy = false;\n  \}\n\}/,
  `async function pushCloudBackup(silent = false) {
  syncToApp();
  try {
    await pushRemoteBackup(silent);
    syncFromApp();
    if (!silent) {
      logAudit("Cloud backup pushed", businessId());
      toast("Cloud backup saved");
    }
  } catch (error) {
    syncFromApp();
    if (!silent) toast(\`Cloud backup failed: \${error.message}\`);
  }
}`
);

source = source.replace(
  /async function latestCloudSnapshot\(\) \{[\s\S]*?return rows\?\.\[0\] \|\| null;\n\}/,
  `async function latestCloudSnapshot() {
  syncToApp();
  const snapshot = await latestRemoteSnapshot();
  syncFromApp();
  return snapshot;
}`
);

source = source.replace(
  /async function restoreCloudBackupFromCloud\(options = \{\}\) \{[\s\S]*?  return snapshot;\n\}\n\nasync function replaceFromCloud/,
  `async function restoreCloudBackupFromCloud(options = {}) {
  syncToApp();
  const snapshot = await restoreRemoteBackup(options);
  syncFromApp();
  return snapshot;
}

async function replaceFromCloud`
);

source = source.replace(
  /async function replaceFromCloud\(options = \{\}\) \{[\s\S]*?  return snapshot;\n\}\n\nasync function connectLoginSync/,
  `async function replaceFromCloud(options = {}) {
  syncToApp();
  const snapshot = await replaceFromCloudRemote(options);
  syncFromApp();
  return snapshot;
}

async function connectLoginSync`
);

source = source.replace(
  /async function connectLoginSync\(\) \{[\s\S]*?  \}\n\}\n\nasync function replaceLoginSync/,
  `async function connectLoginSync() {
  syncToApp();
  const ok = await connectLoginSyncRemote();
  syncFromApp();
  if (ok) {
    toast("Cloud data merged");
    render();
  }
}

async function replaceLoginSync`
);

source = source.replace(
  /async function replaceLoginSync\(\) \{[\s\S]*?  \}\n\}\n\nasync function syncNow/,
  `async function replaceLoginSync() {
  syncToApp();
  const ok = await replaceLoginSyncRemote();
  syncFromApp();
  if (ok) {
    localStorage.setItem(ANDROID_CLOUD_PRIMARY_KEY, "true");
    toast("Device data replaced from cloud");
    render();
  }
}

async function syncNow`
);

source = source.replace(
  /function startAutoCloudSync\(\) \{[\s\S]*?  \}\);\n\}/,
  `function startAutoCloudSync() {
  const refresh = () => (isAndroidRuntime() ? refreshAndroidFromCloud() : autoCloudMerge());
  startRemoteAutoSync(refresh);
  autoSyncTimer = App.autoSyncTimer;
}`
);

source = source.replace(
  /async function initializeApp\(\) \{\n  startAutoCloudSync\(\);/,
  `async function initializeApp() {
  await loadAppConfig();
  readDefaultKbaPasswordFromConfig(getAppConfig());
  App.root = document.querySelector("#app");
  syncToApp();
  startAutoCloudSync();`
);

source = source.replace(
  /initializeApp\(\);$/,
  `initializeApp();`
);

source = source.replace(
  /business_id=eq\.\$\{encodeURIComponent\(CLOUD_BUSINESS_ID\)\}/g,
  `business_id=eq.\${encodeURIComponent(businessId())}`
);

source = source.replace(
  /business_id: CLOUD_BUSINESS_ID,/g,
  `business_id: businessId(),`
);

source = source.replace(
  /logAudit\("Cloud backup pushed", CLOUD_BUSINESS_ID\)/g,
  `logAudit("Cloud backup pushed", businessId())`
);

// Remove now-dead sync helpers if still present after pushCloudBackup replace failed partially
[
  /async function saveCloudSnapshot[\s\S]*?^}\n/m,
  /function cloudHeaders[\s\S]*?^}\n/m,
  /async function fetchWithTimeout[\s\S]*?^}\n/m,
  /async function responseError[\s\S]*?^}\n/m
].forEach((pattern) => {
  if (pattern.test(source) && source.includes("async function pushCloudBackup(silent = false) {\n  syncToApp();")) {
    source = source.replace(pattern, "");
  }
});

fs.writeFileSync(appPath, source);
console.log("Modernized app.js");
