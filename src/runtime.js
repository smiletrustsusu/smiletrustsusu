export const rt = {
  state: null,
  sessionUserId: null,
  activeView: "dashboard",
  syncTimer: null,
  syncBusy: false,
  gatewayTimer: null,
  autoSyncTimer: null,
  localSavePending: false,
  lastAndroidRefreshAt: 0,
  root: null,
  attachHandlers: () => {}
};

export function registerRuntime(api) {
  Object.assign(rt, api);
}

export function bindState(stateRef) {
  Object.defineProperty(rt, "state", {
    get: () => stateRef.value,
    set: (next) => {
      stateRef.value = next;
    },
    configurable: true
  });
}

export function bindSession(sessionRef) {
  Object.defineProperty(rt, "sessionUserId", {
    get: () => sessionRef.value,
    set: (next) => {
      sessionRef.value = next;
    },
    configurable: true
  });
}

export function bindActiveView(viewRef) {
  Object.defineProperty(rt, "activeView", {
    get: () => viewRef.value,
    set: (next) => {
      viewRef.value = next;
    },
    configurable: true
  });
}
