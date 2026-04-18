/**
 * Scheduled jobs for the Codeforces POTD backend.
 *
 * All jobs run in IST to keep behaviour predictable for the primary user base.
 * See cron.md for the full schedule and a runbook for manually triggering jobs.
 */
const cron = require("node-cron");
const mongoose = require("mongoose");
const Models = require("../models/models");
const filteredProblemSetService = require("../services/filteredProblemSetService");
const globalProblemSetService = require("../services/globalProblemSetService");
const userService = require("../services/userService");

const User = mongoose.model("User", Models.userSchema);

const TIMEZONE = "Asia/Kolkata";

const schedule = (expr, name, task) => {
  cron.schedule(expr, async () => {
    try {
      console.log(`[cron] ${name} start`);
      const result = await task();
      console.log(`[cron] ${name} done`, result ?? "");
    } catch (err) {
      console.error(`[cron] ${name} failed:`, err);
    }
  }, { scheduled: true, timezone: TIMEZONE });
};

// 1. Pull latest problems from the Codeforces API into our global set.
schedule("11 5 * * *", "update-global-problem-set",
  () => globalProblemSetService.updateGlobalProblemSet()
);

// 2. Regenerate the per-rating filtered sets used by the extension each day.
//    Runs just after the global update to pick up any new problems.
schedule("17 5 * * *", "generate-filtered-problem-sets",
  () => filteredProblemSetService.generateFilteredProblemSets()
);

// 3. Trim streak_days entries older than 3 months so user docs stay compact.
schedule("07 6 * * 0", "cleanup-old-streak-days", async () => {
  const users = await User.find({}, { userID: 1 });
  let ok = 0, fail = 0;
  for (const { userID } of users) {
    if (!userID) continue;
    try {
      await userService.cleanupOldStreakDays(userID);
      ok++;
    } catch (err) {
      console.error(`[cron] cleanup failed for ${userID}:`, err.message);
      fail++;
    }
  }
  return { users: users.length, ok, fail };
});

console.log("[cron] scheduled jobs initialized");
