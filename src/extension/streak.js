/**
 * Streak management.
 *
 * All date math is done in UTC so a user travelling through timezones sees
 * the same "today". The streak_days map is the authoritative source of
 * truth; `last_streak_date` and `last_streak_count` are derived caches kept
 * in sync by `syncStreakDaysWithDatabase`.
 *
 * Key format: "YYYY-M-D" (no zero-padding) — matches what the backend
 * writes. See models.js for the DB schema.
 */

function unwrapUser(userInfo) {
  if (!userInfo) return null;
  if (Array.isArray(userInfo) && userInfo.length > 0) {
    return Array.isArray(userInfo[0]) ? userInfo[0][0] : userInfo[0];
  }
  return typeof userInfo === "object" ? userInfo : null;
}

window.streak = {
  keyFromDate(date) {
    return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
  },

  dateFromKey(key) {
    const [year, month, day] = key.split("-").map((n) => parseInt(n, 10));
    const date = new Date();
    date.setUTCFullYear(year);
    date.setUTCMonth(month - 1);
    date.setUTCDate(day);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  },

  async getStreakDays() {
    try {
      const userInfo = await window.storage.get(window.storageKeys.USER_INFO);
      const user = unwrapUser(userInfo);
      return user?.streak?.streak_days || {};
    } catch (error) {
      console.error("[streak] getStreakDays failed:", error);
      return {};
    }
  },

  /**
   * Count consecutive solved days up to today. If today isn't marked, count
   * up to yesterday — the streak isn't broken until yesterday is also
   * unmarked.
   */
  async getCurrentStreak() {
    try {
      const streakDays = await this.getStreakDays();
      if (Object.keys(streakDays).length === 0) return 0;

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const startFrom = streakDays[this.keyFromDate(today)] === true
        ? today
        : (() => {
            const y = new Date(today);
            y.setUTCDate(y.getUTCDate() - 1);
            return streakDays[this.keyFromDate(y)] === true ? y : null;
          })();

      if (!startFrom) return 0;

      let cursor = new Date(startFrom);
      let count = 0;
      while (streakDays[this.keyFromDate(cursor)] === true) {
        count++;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }
      return count;
    } catch (error) {
      console.error("[streak] getCurrentStreak failed:", error);
      return 0;
    }
  },

  /** Collect every solved day as a YYYY-MM-DD ISO string (UTC). */
  async getDatesToMarkSolved() {
    try {
      const streakDays = await this.getStreakDays();
      const dates = [];
      for (const [key, solved] of Object.entries(streakDays)) {
        if (solved !== true || key.split("-").length !== 3) continue;
        const date = this.dateFromKey(key);
        if (!Number.isNaN(date.getTime())) {
          dates.push(window.dateUtils.formatDateToUTCISO(date));
        }
      }
      return dates;
    } catch (error) {
      console.error("[streak] getDatesToMarkSolved failed:", error);
      return [];
    }
  },

  async getLastStreakDate() {
    try {
      const streakDays = await this.getStreakDays();
      const solvedDays = Object.entries(streakDays)
        .filter(([, solved]) => solved === true)
        .map(([k]) => k)
        .sort()
        .reverse();
      if (solvedDays.length === 0) return null;
      return this.dateFromKey(solvedDays[0]).toISOString().split("T")[0];
    } catch (error) {
      console.error("[streak] getLastStreakDate failed:", error);
      return null;
    }
  },

  /**
   * Purge streak_days older than 3 months from local storage. The backend
   * does the same via the cleanup-old-streak-days cron, so this is mainly to
   * keep the local cache compact.
   */
  async cleanupOldStreakDays() {
    try {
      const streakDays = await this.getStreakDays();
      if (Object.keys(streakDays).length === 0) return true;

      const threshold = new Date();
      threshold.setUTCMonth(threshold.getUTCMonth() - 3);
      threshold.setUTCHours(0, 0, 0, 0);

      const toRemove = Object.keys(streakDays).filter(
        (key) => this.dateFromKey(key) < threshold
      );
      if (toRemove.length === 0) return true;

      console.log(`[streak] pruning ${toRemove.length} old streak days`);
      for (const key of toRemove) delete streakDays[key];

      const userInfo = await window.storage.get(window.storageKeys.USER_INFO);
      if (!userInfo || !Array.isArray(userInfo) || !userInfo[0]) return false;

      // Write back to whichever shape we read from.
      if (Array.isArray(userInfo[0]) && userInfo[0][0]) {
        userInfo[0][0].streak.streak_days = streakDays;
      } else {
        userInfo[0].streak.streak_days = streakDays;
      }
      await window.storage.set(window.storageKeys.USER_INFO, userInfo);
      return true;
    } catch (error) {
      console.error("[streak] cleanupOldStreakDays failed:", error);
      return false;
    }
  },

  /**
   * True if the streak counter should reset — either the calendar rolled
   * into a new month or more than a day has passed without a solve.
   */
  async shouldResetStreak() {
    try {
      const lastStreakDate = await this.getLastStreakDate();
      if (!lastStreakDate) return false;

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const last = new Date(lastStreakDate);
      last.setUTCHours(0, 0, 0, 0);

      // First of a new month + last solve was in a previous month → reset.
      if (today.getUTCDate() === 1 && last.getUTCMonth() !== today.getUTCMonth()) {
        return true;
      }

      const diffDays = Math.floor((today.getTime() - last.getTime()) / 86_400_000);
      return diffDays > 1;
    } catch (error) {
      console.error("[streak] shouldResetStreak failed:", error);
      return false;
    }
  },

  async resetStreak(userHandle) {
    try {
      await this.cleanupOldStreakDays();
      const updatedUser = await window.api.updateUserStreak(userHandle, 0);
      await window.storage.set(window.storageKeys.USER_INFO, [updatedUser]);
      if (typeof window.refreshCalendar === "function") window.refreshCalendar();
      return { success: true, streakReset: true, newStreak: 0 };
    } catch (error) {
      window.errorHandler.logError("resetStreak", error);
      return { success: false, reason: "error", error: error.message };
    }
  },

  /**
   * Called after a new AC for today's problem: verify, update streak count,
   * mark today in storage, and refresh the UI.
   */
  async validateAndUpdateStreak(userHandle, todaysProblem) {
    try {
      const today = window.dateUtils.getTodayISO();
      const shouldReset = await this.shouldResetStreak();
      const verification = await window.api.verifySubmission(userHandle, todaysProblem);

      if (!verification.verified) {
        return { success: false, reason: "not_verified", details: verification };
      }

      await this.cleanupOldStreakDays();

      const newStreak = shouldReset ? 1 : (await this.getCurrentStreak()) + 1;
      const updatedUser = await window.api.updateUserStreak(userHandle, newStreak, true);
      await window.storage.set(window.storageKeys.USER_INFO, [updatedUser]);
      await window.storage.set(window.storageKeys.LAST_SOLVED_DATE, today);

      if (typeof window.refreshCalendar === "function") window.refreshCalendar();
      await this.syncStreakDaysWithDatabase(userHandle);

      return {
        success: true,
        newStreak,
        previousStreak: shouldReset ? 0 : newStreak - 1,
        wasReset: shouldReset
      };
    } catch (error) {
      window.errorHandler.logError("validateAndUpdateStreak", error);
      return { success: false, reason: "error", error: error.message };
    }
  },

  async checkAndResetStreakIfNeeded(userHandle) {
    try {
      if (!userHandle) return { success: false, reason: "missing_handle" };
      if (await this.shouldResetStreak()) {
        console.log("[streak] auto-resetting due to gap");
        return await this.resetStreak(userHandle);
      }
      if (new Date().getUTCDate() === 1) {
        await this.cleanupOldStreakDays();
      }
      return {
        success: true,
        streakMaintained: true,
        currentStreak: await this.getCurrentStreak()
      };
    } catch (error) {
      window.errorHandler.logError("checkAndResetStreakIfNeeded", error);
      return { success: false, reason: "error", error: error.message };
    }
  },

  /**
   * Reconcile the backend's `last_streak_date` with our local streak_days
   * map. If the stored date points to a day that has been un-marked locally
   * (e.g. manual correction), push the most recent actually-solved day
   * back to the DB.
   */
  async syncStreakDaysWithDatabase(userHandle) {
    try {
      const streakDays = await this.getStreakDays();
      if (Object.keys(streakDays).length === 0) return false;

      const userInfo = await window.storage.get(window.storageKeys.USER_INFO);
      const user = unwrapUser(userInfo);
      const currentDate = user?.streak?.last_streak_date
        ? new Date(user.streak.last_streak_date)
        : null;

      // Stored date is still correct → nothing to do.
      if (currentDate && streakDays[this.keyFromDate(currentDate)] === true) {
        return true;
      }

      const mostRecentSolved = Object.entries(streakDays)
        .filter(([, solved]) => solved === true)
        .map(([key]) => ({ key, date: this.dateFromKey(key) }))
        .sort((a, b) => b.date - a.date)[0];

      if (!mostRecentSolved) return false;

      const updatedUser = await window.api.updateLastStreakDate(
        userHandle,
        mostRecentSolved.date.toISOString()
      );
      await window.storage.set(window.storageKeys.USER_INFO, [updatedUser]);
      return true;
    } catch (error) {
      console.error("[streak] syncStreakDaysWithDatabase failed:", error);
      return false;
    }
  }
};
