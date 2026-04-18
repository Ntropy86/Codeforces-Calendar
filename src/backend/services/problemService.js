const Problem = require("../models/Problem");
const { dailyProblem } = require("../lib/dailyProblem");
const { toISODate, startOfISOWeek, addDays, daysBetween } = require("../lib/dates");

const CF_PROBLEMSET_API = "https://codeforces.com/api/problemset.problems";

/**
 * Codeforces problems are published in 100-point rating buckets (800, 900,
 * 1200, 1300, ...). User ratings are continuous integers (e.g. 1204). To
 * preserve the "everyone at the same rating solves the same problem" property,
 * we snap to the nearest 100 before selecting. Clamped to [800, 3500].
 */
function snapRating(rating) {
  const snapped = Math.round(rating / 100) * 100;
  return Math.min(3500, Math.max(800, snapped));
}

/**
 * Pull the latest problems from Codeforces and append any we don't have.
 * Problems in CF are immutable once created (rating sometimes drifts), so
 * this is strictly additive plus a rating-patch pass for existing docs.
 *
 * Exposed as the single cron job in V3.
 */
async function refreshGlobalProblems() {
  const res = await fetch(CF_PROBLEMSET_API);
  const body = await res.json();
  if (body.status !== "OK") throw new Error("Codeforces problemset API failed");

  const cfProblems = body.result.problems;
  const stats = { fetched: cfProblems.length, added: 0, ratingPatched: 0, skippedNoRating: 0 };

  // Index existing cfIds for O(1) lookup.
  const existing = await Problem.find({}, { cfId: 1, rating: 1 }).lean();
  const existingById = new Map(existing.map((p) => [p.cfId, p]));

  const toInsert = [];
  const ratingUpdates = [];

  for (const cf of cfProblems) {
    if (cf.rating === undefined) {
      stats.skippedNoRating++;
      continue;
    }
    const cfId = `${cf.contestId}${cf.index}`;
    const current = existingById.get(cfId);

    if (!current) {
      toInsert.push({
        cfId,
        contestId: cf.contestId,
        index: cf.index,
        name: cf.name,
        rating: cf.rating,
        tags: cf.tags || [],
        addedAt: new Date()
      });
    } else if (current.rating !== cf.rating) {
      ratingUpdates.push({ cfId, rating: cf.rating });
    }
  }

  if (toInsert.length) {
    await Problem.insertMany(toInsert, { ordered: false });
    stats.added = toInsert.length;
  }
  if (ratingUpdates.length) {
    await Promise.all(
      ratingUpdates.map(({ cfId, rating }) =>
        Problem.updateOne({ cfId }, { $set: { rating } })
      )
    );
    stats.ratingPatched = ratingUpdates.length;
  }

  return stats;
}

/**
 * Daily problem for a rating on a date — pure selector against the live pool.
 * `dateISO` defaults to today (UTC).
 */
async function getDailyProblem(rating, dateISO) {
  const date = dateISO || toISODate(new Date());
  const bucket = snapRating(rating);
  const weekStart = startOfISOWeek(date);

  // Only fetch candidates that could possibly be eligible this week. This
  // keeps the query small even as the global pool grows into the tens of K.
  const weekStartDate = new Date(weekStart + "T00:00:00Z");
  const pool = await Problem.find(
    { rating: bucket, addedAt: { $lte: weekStartDate } },
    { cfId: 1, rating: 1, addedAt: 1, contestId: 1, index: 1, name: 1, tags: 1 }
  ).lean();

  const picked = dailyProblem(bucket, date, pool);
  if (!picked) return null;

  // `picked` is a POJO from .lean(); add a derived url for client convenience.
  return withUrl(picked);
}

/**
 * Bulk problems for a rating across a date range (inclusive). Used by the
 * calendar render — one call instead of N `getDailyProblem` round-trips.
 */
async function getProblemsInRange(rating, fromISO, toISO) {
  const days = daysBetween(fromISO, toISO);
  if (days < 0 || days > 366) {
    const err = new Error("Invalid date range (must be 0..366 days)");
    err.statusCode = 400;
    throw err;
  }
  const bucket = snapRating(rating);

  // Fetch the pool once, covering the widest week any date in the range can see.
  const widestWeekStart = startOfISOWeek(fromISO);
  const pool = await Problem.find(
    { rating: bucket, addedAt: { $lte: new Date(widestWeekStart + "T00:00:00Z") } },
    { cfId: 1, rating: 1, addedAt: 1, contestId: 1, index: 1, name: 1, tags: 1 }
  ).lean();

  const out = [];
  for (let i = 0; i <= days; i++) {
    const dateISO = addDays(fromISO, i);
    const picked = dailyProblem(bucket, dateISO, pool);
    out.push({ dateISO, problem: picked ? withUrl(picked) : null });
  }
  return out;
}

function withUrl(p) {
  return {
    cfId: p.cfId,
    contestId: p.contestId,
    index: p.index,
    name: p.name,
    rating: p.rating,
    tags: p.tags,
    url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`
  };
}

async function countProblems() {
  return Problem.countDocuments({});
}

module.exports = {
  refreshGlobalProblems,
  getDailyProblem,
  getProblemsInRange,
  countProblems,
  snapRating
};
