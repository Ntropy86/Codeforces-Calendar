/**
 * V3 in-process cron. Opt-in via ENABLE_CRON=true in the environment.
 *
 * "Daily problem for rating X on date Y" is NOT a scheduled job in V3 —
 * it's derived on read (see lib/dailyProblem.js). The only things we
 * schedule are data-freshness tasks:
 *
 *   1. Weekly: pull new CF problems into the pool. If skipped, nothing
 *      breaks — users continue to get problems from the existing pool.
 *   2. Weekly: prune submissions older than 90 days to keep the
 *      collection small.
 *
 * Jobs are idempotent, so a missed tick just merges into the next one.
 */
const cron = require("node-cron");
const problemService = require("../services/problemService");
const submissionService = require("../services/submissionService");

const TIMEZONE = process.env.CRON_TIMEZONE || "UTC";

function schedule(expr, name, task) {
  cron.schedule(
    expr,
    async () => {
      try {
        console.log(`[cron] ${name} start`);
        const result = await task();
        console.log(`[cron] ${name} done`, result ?? "");
      } catch (err) {
        console.error(`[cron] ${name} failed:`, err);
      }
    },
    { scheduled: true, timezone: TIMEZONE }
  );
}

// Sunday 05:11 — pull new CF problems. Weekly is enough: CF publishes
// ~2-3 contests per week, and the selector's pool-freeze guarantees
// newly-added problems join the pool starting next Monday anyway.
schedule("11 5 * * 0", "refresh-global-problems", () => problemService.refreshGlobalProblems());

// Sunday 06:07 — prune submissions >90 days old.
schedule("07 6 * * 0", "prune-submissions", () => submissionService.pruneOldSubmissions());

console.log(`[cron] scheduled jobs initialized (tz=${TIMEZONE})`);
