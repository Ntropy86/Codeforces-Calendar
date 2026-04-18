/**
 * Backend API client for the extension.
 *
 * Uses `window.config.current.API_URL` resolved from config.json at load
 * time, and retries transient failures (up to 3 attempts with a fixed
 * back-off) before surfacing the error to the caller.
 */

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 2000;

/**
 * Extract the user document from a backend response. Tolerates both the
 * `{ message: { ... } }` and `{ user: { ... } }` shapes some legacy
 * endpoints still return.
 */
function extractUser(response) {
  if (response?.message && typeof response.message === "object") {
    return Array.isArray(response.message) ? response.message[0] : response.message;
  }
  if (response?.user) return response.user;
  return null;
}

window.api = {
  async fetchWithRetry(url, options, maxRetries = DEFAULT_MAX_RETRIES, delay = DEFAULT_RETRY_DELAY_MS) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        window.log.debug(`[api] ${options?.method || "GET"} ${url} (attempt ${attempt + 1})`);
        const response = await fetch(url, options);
        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          throw new Error(
            `HTTP ${response.status}: ${errorBody ? JSON.stringify(errorBody) : response.statusText}`
          );
        }
        return await response.json();
      } catch (error) {
        console.warn(`[api] attempt ${attempt + 1} failed:`, error.message);
        lastError = error;
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  },

  /**
   * POST /users — single entry point for login/signup. Always returns the
   * synced user record (Codeforces rating fetched server-side).
   */
  async getOrCreateUser(handle) {
    try {
      const response = await this.fetchWithRetry(
        `${window.config.current.API_URL}/users`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userID: handle })
        }
      );
      const user = extractUser(response);
      if (!user) throw new Error("Failed to extract user data from response");
      return user;
    } catch (error) {
      window.errorHandler.logError("getOrCreateUser", error);
      throw error;
    }
  },

  async updateUserStreak(handle, streakCount, updateDate = false) {
    try {
      const response = await this.fetchWithRetry(
        `${window.config.current.API_URL}/users`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userID: handle,
            last_streak_count: streakCount,
            updateDate
          })
        }
      );
      const user = extractUser(response);
      if (!user) throw new Error("Failed to extract updated user data");
      return user;
    } catch (error) {
      window.errorHandler.logError("updateUserStreak", error);
      throw error;
    }
  },

  async cleanupOldStreakDays(handle) {
    try {
      const response = await this.fetchWithRetry(
        `${window.config.current.API_URL}/users/cleanup-streak-days`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userID: handle })
        }
      );
      const user = extractUser(response);
      if (!user) throw new Error("Failed to extract updated user data");
      return user;
    } catch (error) {
      window.errorHandler.logError("cleanupOldStreakDays", error);
      throw error;
    }
  },

  /**
   * GET /problemset/monthly
   *
   * Ratings are stored in 100-point buckets offset by +200 from the user's
   * current rating (so a 1204 user gets 1400-rated problems — a bit of a
   * stretch target). This rounding lives here until the "standardize-data"
   * sprint moves it to the backend.
   */
  async getMonthlyProblems(month, year, rating) {
    try {
      const bucketRating = Math.ceil(rating / 100) * 100 + 200;
      const url = `${window.config.current.API_URL}/problemset/monthly?month=${month}&year=${year}&rating=${bucketRating}`;

      const response = await this.fetchWithRetry(url, { method: "GET" });
      if (response.data) return response.data;
      throw new Error(`Failed to get monthly problems: ${JSON.stringify(response)}`);
    } catch (error) {
      window.errorHandler.logError("getMonthlyProblems", error);
      throw error;
    }
  },

  /**
   * Verify the user has an AC submission for today's problem.
   *
   * Queries Codeforces directly from the content script (their API is CORS-open).
   * The backend /test/submissions route exists for local dev with mocked data
   * and is never reachable in production — this client always hits CF live.
   */
  async verifySubmission(handle, problem) {
    try {
      const url = `https://codeforces.com/api/user.status?handle=${handle}&from=1&count=10`;
      const response = await this.fetchWithRetry(url, { method: "GET" });

      if (response.status !== "OK") {
        throw new Error(`Codeforces API error: ${response.comment || "Unknown error"}`);
      }
      if (!Array.isArray(response.result)) {
        return { verified: false, message: "No submissions returned" };
      }

      for (const submission of response.result) {
        const match = problem
          && submission.problem.contestId === problem.problem.contestId
          && submission.problem.index === problem.problem.index;
        if (match && submission.verdict === "OK") {
          console.log(`[api] verified AC for ${submission.problem.contestId}${submission.problem.index}`);
          return { verified: true, submission };
        }
      }
      return { verified: false, message: "No accepted submission found for today's problem" };
    } catch (error) {
      window.errorHandler.logError("verifySubmission", error);
      return { verified: false, error: error.message };
    }
  },

  async updateLastStreakDate(handle, dateString) {
    try {
      const response = await this.fetchWithRetry(
        `${window.config.current.API_URL}/users/streak-date`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userID: handle, last_streak_date: dateString })
        }
      );
      const user = extractUser(response);
      if (!user) throw new Error("Failed to extract updated user data");
      return user;
    } catch (error) {
      window.errorHandler.logError("updateLastStreakDate", error);
      throw error;
    }
  }
};
