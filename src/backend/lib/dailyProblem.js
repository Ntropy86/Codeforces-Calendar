const crypto = require("crypto");
const { startOfISOWeek, daysBetween } = require("./dates");

/**
 * The core V3 primitive: deterministically select "today's problem" for a
 * given rating, for a given calendar day, from a candidate pool.
 *
 * Properties this guarantees, by construction:
 *   1. (rating, dateISO, pool) → same cfId for every caller, everywhere.
 *      Two users rated 1200 on the same day get the same problem. That's
 *      the community-POTD property.
 *   2. Within an ISO week the pool is frozen — adding a new problem to the
 *      rating bucket on Tuesday cannot change Monday's or Wednesday's pick.
 *      We do this by filtering candidates to those with addedAt <= weekStart
 *      and sorting by cfId so insertion order is irrelevant.
 *   3. Different day of week → different pick. The seed is
 *      hash(rating:weekKey) and the offset within the week rotates the index.
 *   4. No DB writes. The function is pure; callers can cache trivially.
 *
 * Returns null iff `pool` has zero candidates at or before weekStart.
 */
function dailyProblem(rating, dateISO, pool) {
  if (!Array.isArray(pool) || pool.length === 0) return null;

  const weekStart = startOfISOWeek(dateISO);
  const weekStartMs = new Date(weekStart + "T00:00:00Z").getTime();

  // Candidates eligible this week = items that existed at week-start. Items
  // added during the week wait until the next week's snapshot — this is
  // what makes the pick stable for 7 days regardless of incoming refreshes.
  const frozen = pool
    .filter((p) => {
      if (p.rating !== rating) return false;
      const added = p.addedAt instanceof Date ? p.addedAt.getTime() : new Date(p.addedAt).getTime();
      return added <= weekStartMs;
    })
    .sort((a, b) => String(a.cfId).localeCompare(String(b.cfId)));

  if (frozen.length === 0) return null;

  const dow = daysBetween(weekStart, dateISO); // 0..6
  const seed = seedFor(rating, weekStart);
  const idx = (seed + dow) % frozen.length;
  return frozen[idx];
}

/** 32-bit unsigned integer seed from a rating + week identifier. */
function seedFor(rating, weekKey) {
  const h = crypto.createHash("sha256").update(`${rating}:${weekKey}`).digest();
  return h.readUInt32BE(0);
}

module.exports = { dailyProblem, seedFor };
