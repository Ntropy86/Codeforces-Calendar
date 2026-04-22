const problemService = require("../services/problemService");
const { handle, required, parseRating } = require("../lib/http");
const { toISODate } = require("../lib/dates");

/**
 * GET /problems/daily?rating=1200&date=2026-04-18
 * Returns: { dateISO, rating, problem | null }
 *
 * `problem` is null iff no eligible candidates exist for that rating in the
 * frozen pool (e.g. a rating the CF API has never published). The client
 * treats null as "come back tomorrow".
 */
exports.getDaily = handle(async (req) => {
  const rating = parseRating(required(req.query.rating, "rating"));
  const dateISO = (req.query.date || "").trim() || toISODate(new Date());
  const problem = await problemService.getDailyProblem(rating, dateISO);
  return { dateISO, rating, problem };
});

/**
 * GET /problems?rating=1200&from=2026-04-01&to=2026-04-30
 * Returns: { rating, from, to, items: [{ dateISO, problem | null }] }
 *
 * Bulk endpoint used to render the calendar grid. One DB query, N selections.
 */
exports.getRange = handle(async (req) => {
  const rating = parseRating(required(req.query.rating, "rating"));
  const from = required(req.query.from, "from");
  const to = required(req.query.to, "to");
  const items = await problemService.getProblemsInRange(rating, from, to);
  return { rating, from, to, items };
});

/** GET /problems/stats — sanity endpoint exposing pool size. */
exports.getStats = handle(async () => {
  const total = await problemService.countProblems();
  return { total };
});
