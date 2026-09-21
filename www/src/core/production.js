export function isPackagedApp() {
  if (typeof navigator === "undefined") return false;
  return /Electron/i.test(navigator.userAgent) || /Android/i.test(navigator.userAgent);
}

export function developerLoginAllowed(state = {}) {
  if (!isPackagedApp()) return true;
  return state?.settings?.allowDeveloperLogin === true;
}

export function filterProductionUsers(users = [], state = {}) {
  if (developerLoginAllowed(state)) return users;
  return users.filter((user) => user.role !== "Developer");
}
