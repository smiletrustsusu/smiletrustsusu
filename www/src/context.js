export const App = {
  state: null,
  sessionUserId: null,
  activeView: "dashboard",
  syncTimer: null,
  syncBusy: false,
  gatewayTimer: null,
  autoSyncTimer: null,
  localSavePending: false,
  lastAndroidRefreshAt: 0,
  root: document.querySelector("#app")
};

export function setSessionUserId(userId) {
  App.sessionUserId = userId;
}

export function setActiveView(view) {
  App.activeView = view;
}
