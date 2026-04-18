/**
 * Streak helpers — thin view into server-computed streak state.
 *
 * In V3 the streak is derived server-side from the submissions collection
 * (see backend/services/streakService.js). The extension just reads the
 * cached value and the solvedDays map that come back on every user fetch.
 *
 * Replaces the V2 ~300-line streak engine which re-implemented the same
 * logic client-side against a denormalised `streak_days` Map.
 */
window.streak = {
  /** @returns {Promise<number>} current streak length from the latest cache. */
  async getCurrentStreak() {
    const today = await window.storage.get(window.storageKeys.TODAY);
    return Number(today?.streak?.length ?? 0);
  },

  /** @returns {Promise<boolean>} whether today is solved (and counts for the streak). */
  async isTodaySolved() {
    const today = await window.storage.get(window.storageKeys.TODAY);
    return !!today?.streak?.includesToday;
  },

  /**
   * @returns {Promise<Set<string>>} ISO dates the user has solved, from the
   * most recent monthView fetch. Empty set if we haven't synced yet.
   */
  async getSolvedDateSet() {
    const view = await window.storage.get(window.storageKeys.MONTH_VIEW);
    return new Set(Object.keys(view?.solvedDays || {}));
  }
};
