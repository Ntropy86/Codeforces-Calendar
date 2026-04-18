/**
 * Extension runtime configuration.
 *
 * Setup:
 *   1. Copy config.example.json to config.json (gitignored).
 *   2. Set `environment` to "development" | "staging" | "production".
 *   3. Fill in the URL for each environment you actually use.
 *
 * At load time we fetch config.json via chrome.runtime.getURL so the values
 * live outside the codebase. If it fails we fall back to a localhost dev
 * config (never to a real production URL).
 */

const FALLBACK_CONFIG = {
  environment: "development",
  api: {
    development: { url: "http://localhost:4000" },
    staging: { url: "" },
    production: { url: "" }
  },
  features: {
    enableDebugLogs: false,
    enableAnimations: true,
    enableDarkMode: true
  }
};

let loadedConfig = FALLBACK_CONFIG;

fetch(chrome.runtime.getURL("config.json"))
  .then((r) => r.json())
  .then((cfg) => {
    loadedConfig = cfg;
    console.log(`[cf-potd] config: ${cfg.environment}`);
  })
  .catch(() => {
    console.warn("[cf-potd] config.json missing — using localhost dev fallback");
  });

window.config = {
  get current() {
    const env = loadedConfig.environment || "development";
    const apiEntry = loadedConfig.api[env] || {};
    return {
      API_URL: apiEntry.url,
      environment: env,
      features: loadedConfig.features
    };
  },
  isDevelopment() { return (loadedConfig.environment || "development") === "development"; },
  isProduction() { return loadedConfig.environment === "production"; }
};

/**
 * Gated logger — chatter is silenced unless `features.enableDebugLogs` is
 * true in config.json. `warn` and `error` are always emitted.
 */
window.log = {
  debug(...args) {
    if (loadedConfig.features?.enableDebugLogs) console.log(...args);
  },
  info(...args) {
    if (loadedConfig.features?.enableDebugLogs) console.log(...args);
  },
  warn(...args) { console.warn(...args); },
  error(...args) { console.error(...args); }
};

/**
 * V3 storage schema. Flat, no nested arrays, no dual shapes.
 *   user:         { userID, rating, ratingUpdatedAt, createdAt }
 *   today:        { dateISO, problem, streak: { length, lastSolvedDate, includesToday } }
 *   monthView:    { rating, from, to, items: [{dateISO, problem}], solvedDays: { iso: true } }
 *   lastSyncedAt: ISO timestamp of the last successful POST /users reconciliation
 */
window.storageKeys = {
  USER: "user",
  TODAY: "today",
  MONTH_VIEW: "monthView",
  LAST_SYNCED_AT: "lastSyncedAt"
};

/** Minimum gap between background user syncs. Ratings change rarely. */
window.SYNC_THROTTLE_MS = 6 * 60 * 60 * 1000; // 6 hours

window.errorHandler = {
  logError(context, error) {
    console.error(`[${context}]`, error);
    return error;
  },
  displayError(message, element) {
    if (element) {
      element.textContent = message;
      element.className = "status-message error-message";
    }
    console.error(message);
  }
};

/**
 * Date helpers — all in UTC to avoid drift when users travel across
 * timezones. "Today" is defined as the UTC calendar date.
 */
window.dateUtils = {
  getTodayISO() {
    return this.formatDateToUTCISO(new Date());
  },
  getYesterdayISO() {
    const y = new Date();
    y.setUTCDate(y.getUTCDate() - 1);
    return this.formatDateToUTCISO(y);
  },
  formatDateToUTCISO(date) {
    const y = date.getUTCFullYear();
    const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    const d = date.getUTCDate().toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
  },
  formatDateToISO(date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
  },
  getCurrentMonthAndYear() {
    const today = new Date();
    return {
      month: today.getUTCMonth() + 1,
      year: today.getUTCFullYear()
    };
  }
};
