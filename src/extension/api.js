/**
 * Backend API client for the extension (V3 contract).
 *
 * Every backend call returns a flat, predictable shape — no more deep-array
 * unwrapping. Transient network failures are retried up to 3 times with a
 * fixed back-off before surfacing to the caller.
 *
 * `verifySubmission` hits the Codeforces API directly (CORS-open) because
 * the backend doesn't need to be in that loop — rationale in
 * services/submissionService.js.
 */

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1500;

async function fetchWithRetry(url, options = {}, {
  maxRetries = DEFAULT_MAX_RETRIES,
  delayMs = DEFAULT_RETRY_DELAY_MS
} = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      window.log.debug(`[api] ${options.method || "GET"} ${url} (try ${attempt})`);
      const res = await fetch(url, options);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const err = new Error(body.error || `HTTP ${res.status}`);
        err.statusCode = res.status;
        // Don't retry 4xx — they won't succeed on retry.
        if (res.status >= 400 && res.status < 500) throw err;
        throw err;
      }
      return await res.json();
    } catch (err) {
      lastError = err;
      const isClientErr = err.statusCode >= 400 && err.statusCode < 500;
      if (isClientErr || attempt === maxRetries) break;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

function base() {
  const url = window.config.current.API_URL;
  if (!url) throw new Error("API_URL not configured — check config.json");
  return url;
}

window.api = {
  /**
   * POST /users — upsert + Codeforces rating sync in one call.
   * Returns { user, today: { dateISO, problem, streak } }.
   */
  async getOrCreateUser(handle) {
    return fetchWithRetry(`${base()}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userID: handle })
    });
  },

  /** GET /users/:userID — same shape as POST, no CF re-sync. */
  async getUser(handle) {
    return fetchWithRetry(`${base()}/users/${encodeURIComponent(handle)}`);
  },

  /** POST /users/:userID/refresh-rating — force CF re-sync. */
  async refreshRating(handle) {
    return fetchWithRetry(`${base()}/users/${encodeURIComponent(handle)}/refresh-rating`, {
      method: "POST"
    });
  },

  /** GET /problems/daily?rating=X&date=YYYY-MM-DD. */
  async getDailyProblem(rating, dateISO) {
    const qs = new URLSearchParams({ rating });
    if (dateISO) qs.set("date", dateISO);
    return fetchWithRetry(`${base()}/problems/daily?${qs}`);
  },

  /** GET /problems?rating=X&from=YYYY-MM-DD&to=YYYY-MM-DD. */
  async getProblemsInRange(rating, fromISO, toISO) {
    const qs = new URLSearchParams({ rating, from: fromISO, to: toISO });
    return fetchWithRetry(`${base()}/problems?${qs}`);
  },

  /** POST /submissions — idempotent. Returns { submission, streak }. */
  async recordSubmission(handle, problemCfId, dateISO) {
    return fetchWithRetry(`${base()}/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userID: handle, problemCfId, dateISO })
    });
  },

  /**
   * GET /submissions?userID=X&from=...&to=... — returns `items` and a
   * pre-built `solvedDays` map keyed by dateISO.
   */
  async getSubmissions(handle, fromISO, toISO) {
    const qs = new URLSearchParams({ userID: handle, from: fromISO, to: toISO });
    return fetchWithRetry(`${base()}/submissions?${qs}`);
  },

  /**
   * Query Codeforces directly to check whether the handle has an AC for
   * a given problem. Returns { verified: boolean, submission? }.
   *
   * We scan the user's most recent 30 submissions, which comfortably covers
   * a day's worth of activity for any realistic user.
   */
  async verifySubmission(handle, problemCfId) {
    if (!handle || !problemCfId) return { verified: false, reason: "missing args" };
    try {
      const url = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=30`;
      const res = await fetch(url);
      const body = await res.json();
      if (body.status !== "OK") {
        return { verified: false, reason: body.comment || "CF API error" };
      }
      for (const s of body.result || []) {
        const cfId = `${s.problem.contestId}${s.problem.index}`;
        if (cfId === problemCfId && s.verdict === "OK") {
          return { verified: true, submission: s };
        }
      }
      return { verified: false, reason: "no matching AC found" };
    } catch (err) {
      window.log.warn("[api] verifySubmission failed:", err.message);
      return { verified: false, reason: err.message };
    }
  }
};
