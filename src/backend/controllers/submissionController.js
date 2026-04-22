const submissionService = require("../services/submissionService");
const streakService = require("../services/streakService");
const { handle, required } = require("../lib/http");
const { toISODate } = require("../lib/dates");

/**
 * POST /submissions
 * Body: { userID, problemCfId, dateISO? }
 * Returns: { submission, streak }
 *
 * The extension calls this AFTER client-side verification against the
 * Codeforces user.status endpoint. Idempotent — re-calling for the same
 * (user, day, problem) is a no-op.
 */
exports.record = handle(async (req) => {
  const userID = required(req.body?.userID, "userID");
  const problemCfId = required(req.body?.problemCfId, "problemCfId");
  const dateISO = (req.body?.dateISO || "").trim() || toISODate(new Date());

  const submission = await submissionService.recordSubmission({ userID, problemCfId, dateISO });
  const streak = await streakService.getCurrentStreak(userID);
  return { submission, streak };
});

/**
 * GET /submissions?userID=X&from=...&to=...
 * Returns: { userID, from, to, items, solvedDays: {dateISO: true} }
 */
exports.list = handle(async (req) => {
  const userID = required(req.query.userID, "userID");
  const from = required(req.query.from, "from");
  const to = required(req.query.to, "to");
  const [items, solvedDays] = await Promise.all([
    submissionService.listSubmissions(userID, from, to),
    streakService.getSolvedDays(userID, from, to)
  ]);
  return { userID, from, to, items, solvedDays };
});
