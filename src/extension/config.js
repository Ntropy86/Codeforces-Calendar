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
    enableDebugLogs: false
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

/**
 * Date helpers — all in UTC to avoid drift when users travel across
 * timezones. "Today" is defined as the UTC calendar date so it lines up
 * with how the backend (see lib/dates.js) keys submissions.
 */
window.dateUtils = {
  getTodayISO() {
    return this.formatDateToUTCISO(new Date());
  },
  formatDateToUTCISO(date) {
    const y = date.getUTCFullYear();
    const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    const d = date.getUTCDate().toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
};
