/**
 * Date utilities. All functions operate on UTC to avoid timezone-dependent
 * output that would desync instances running in different regions.
 *
 * The selector uses ISO week boundaries to freeze the candidate pool for a
 * week at a time — see `startOfISOWeek` below.
 */

/** Format a Date as "YYYY-MM-DD" in UTC. */
function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parse "YYYY-MM-DD" into a UTC midnight Date. Throws a 400-tagged error
 * on malformed input so controllers surface bad client dates as HTTP 400
 * instead of an opaque 500.
 */
function fromISODate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const err = new Error(`Invalid ISO date: ${iso}`);
    err.statusCode = 400;
    throw err;
  }
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Start of the ISO week (Monday) containing `date`, as "YYYY-MM-DD".
 * Used as a pool-version key so the candidate list can't shift mid-week.
 */
function startOfISOWeek(date) {
  const d = date instanceof Date ? new Date(date.getTime()) : fromISODate(date);
  const dow = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const daysBack = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - daysBack);
  d.setUTCHours(0, 0, 0, 0);
  return toISODate(d);
}

/** Whole-day difference between two ISO dates (b - a), can be negative. */
function daysBetween(aISO, bISO) {
  const a = fromISODate(aISO);
  const b = fromISODate(bISO);
  return Math.round((b - a) / 86400000);
}

/** Shift an ISO date by `n` days (n can be negative). */
function addDays(iso, n) {
  const d = fromISODate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISODate(d);
}

module.exports = { toISODate, fromISODate, startOfISOWeek, daysBetween, addDays };
