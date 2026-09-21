export const STORE_KEY = "smile_trust_susu_v1";
export const LEGACY_ANDROID_STORE_KEY = "smile_trust_susu_android_v1";
export const SYNC_URL_KEY = "smile_trust_susu_sync_url";
export const CLOUD_KEY_STORAGE = "smile_trust_susu_cloud_key";
export const SYNC_TOKEN_STORAGE = "smile_trust_susu_sync_token";
export const BUSINESS_ID_KEY = "smile_trust_business_id";
export const SEED_LOADED_KEY = "smile_trust_susu_seed_loaded_v1";
export const REMEMBER_LOGIN_KEY = "smile_trust_susu_remembered_login";
export const CANCEL_PENDING_MESSAGES_KEY = "smile_trust_susu_cancel_pending_messages_v1";
export const ANDROID_CLOUD_PRIMARY_KEY = "smile_trust_susu_android_cloud_primary_v1";
export const SESSION_USER_KEY = "smile_trust_session_user";
export const CLOUD_SNAPSHOT_TABLE = "smile_trust_cloud_snapshots";
export const PBKDF2_ITERATIONS = 120000;

export const defaultStateTemplate = {
  settings: {
    collectionDays: 31,
    loanInterest: 15,
    businessName: "SMILE TRUST SUSU MANAGEMENT SYSTEM",
    currency: "GHS",
    theme: "emerald",
    cloudUrl: "",
    cloudKey: "",
    localBackupUrl: "",
    syncToken: "",
    businessId: "",
    cloudMode: "auto"
  },
  groups: [],
  users: [],
  customers: [],
  collections: [],
  loans: [],
  transactions: [],
  messages: [],
  closings: [],
  deletedUsers: [],
  deletedRecords: [],
  audit: []
};
