const Submission = require("../models/Submission");
const { toISODate, addDays } = require("../lib/dates");

/**
 * Compute a user's current streak from the submissions collection.
 *
 * Definition: the longest run of consecutive days ending at `today` or
 * `yesterday` where the user has at least one submission. Yesterday is
 * allowed so the streak doesn't reset at 00:00 UTC before the user has
 * had a chance to solve today's problem.
 *
 * Approach: fetch the last N ISO dates with any submission (distinct,
 * sorted desc), then walk backwards counting consecutive days. Bounded
 * by `maxLookbackDays` to guarantee constant work even for heavy users.
 */
async function getCurrentStreak(userID, { now = new Date(), maxLookbackDays = 400 } = {}) {
  const todayISO = toISODate(now);
  const fromISO = toISODate(new Date(now.getTime() - maxLookbackDays * 86400000));

  // Only count accepted solves — ignore WA/TLE/etc. if ever recorded.
  const dates = await Submission.distinct("dateISO", {
    userID,
    verdict: "OK",
    dateISO: { $gte: fromISO, $lte: todayISO }
  });

  if (dates.length === 0) return { length: 0, lastSolvedDate: null, includesToday: false };

  const set = new Set(dates);
  const yesterdayISO = addDays(todayISO, -1);

  // Anchor: today if solved, else yesterday if solved, else streak is 0.
  let anchor;
  if (set.has(todayISO)) anchor = todayISO;
  else if (set.has(yesterdayISO)) anchor = yesterdayISO;
  else return { length: 0, lastSolvedDate: dates.sort().at(-1), includesToday: false };

  let length = 0;
  let cursor = anchor;
  while (set.has(cursor)) {
    length++;
    cursor = addDays(cursor, -1);
  }

  return {
    length,
    lastSolvedDate: anchor,
    includesToday: anchor === todayISO
  };
}

/**
 * Build the solved-day map needed by the calendar UI — lightweight
 * view-model of listSubmissions result.
 */
async function getSolvedDays(userID, fromISO, toISO) {
  const dates = await Submission.distinct("dateISO", {
    userID,
    verdict: "OK",
    dateISO: { $gte: fromISO, $lte: toISO }
  });
  const map = {};
  for (const d of dates) map[d] = true;
  return map;
}

module.exports = { getCurrentStreak, getSolvedDays };
