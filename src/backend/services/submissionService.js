const Submission = require("../models/Submission");
const { toISODate } = require("../lib/dates");

/**
 * Record an accepted solve. Idempotent — re-posting the same
 * (userID, dateISO, problemCfId) triple is a no-op.
 *
 * Verification against the Codeforces API is performed client-side by the
 * extension (see api.js:verifySubmission). This service is the record-keeper,
 * not the gatekeeper. Rationale: CF's user.status endpoint is CORS-friendly
 * from the client, so proxying through our backend just adds latency and a
 * new rate-limit surface for no security gain (this is a single-user tool;
 * there is no leaderboard to game).
 */
async function recordSubmission({ userID, problemCfId, dateISO, verdict = "OK", source = "live" }) {
  const date = dateISO || toISODate(new Date());

  try {
    return await Submission.create({ userID, dateISO: date, problemCfId, verdict, source });
  } catch (err) {
    // Duplicate key = concurrent request or retry for the same solve.
    // Treat as success by returning the already-persisted doc.
    if (err.code === 11000) {
      return Submission.findOne({ userID, dateISO: date, problemCfId });
    }
    throw err;
  }
}

/**
 * List submissions for a user in an inclusive date range (YYYY-MM-DD).
 * Used by the calendar to mark solved days and by streakService to
 * compute the current streak.
 */
async function listSubmissions(userID, fromISO, toISO) {
  const query = { userID };
  if (fromISO || toISO) {
    query.dateISO = {};
    if (fromISO) query.dateISO.$gte = fromISO;
    if (toISO) query.dateISO.$lte = toISO;
  }
  return Submission.find(query, {
    _id: 0,
    userID: 1,
    dateISO: 1,
    problemCfId: 1,
    verdict: 1,
    source: 1
  })
    .sort({ dateISO: 1 })
    .lean();
}

/**
 * Sunday cleanup: drop submissions older than `cutoffISO`.
 * Default cutoff = 90 days ago. Returns the number of docs removed.
 */
async function pruneOldSubmissions(cutoffISO) {
  const cutoff = cutoffISO || toISODate(new Date(Date.now() - 90 * 86400000));
  const { deletedCount } = await Submission.deleteMany({ dateISO: { $lt: cutoff } });
  return { cutoff, deleted: deletedCount };
}

module.exports = { recordSubmission, listSubmissions, pruneOldSubmissions };
