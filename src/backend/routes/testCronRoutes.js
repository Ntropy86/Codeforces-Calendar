/**
 * Manual triggers for the cron jobs defined in cron/scheduledJobs.js.
 *
 * Mounted at `/test/cron` and gated on NODE_ENV !== "production" in app.js —
 * these routes MUST NOT be reachable on a live deployment.
 */
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const filteredProblemSetService = require("../services/filteredProblemSetService");
const globalProblemSetService = require("../services/globalProblemSetService");
const userService = require("../services/userService");
const Models = require("../models/models");

const User = mongoose.model("User", Models.userSchema);

const handle = (fn) => async (req, res) => {
  try {
    const result = await fn(req);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("[test/cron] failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

router.post("/update-global-problem-set", handle(async () => ({
  stats: await globalProblemSetService.updateGlobalProblemSet()
})));

router.post("/generate-filtered-problem-sets", handle(async () => ({
  stats: await filteredProblemSetService.generateFilteredProblemSets()
})));

router.post("/cleanup-streak-data", handle(async (req) => {
  if (req.body.userID) {
    const user = await userService.cleanupOldStreakDays(req.body.userID);
    return { user };
  }
  const users = await User.find({}).limit(10);
  const results = [];
  for (const u of users) {
    if (!u.userID) continue;
    const result = await userService.cleanupOldStreakDays(u.userID);
    results.push({ userID: u.userID, success: !!result });
  }
  return { results };
}));

module.exports = router;
