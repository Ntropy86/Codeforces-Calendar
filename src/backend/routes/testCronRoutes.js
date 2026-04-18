/**
 * Manual triggers for the V3 cron jobs.
 *
 * Mounted at `/test/cron` and gated on NODE_ENV !== "production" in app.js.
 * In production these are triggered externally (GCP Cloud Scheduler →
 * HTTPS webhook to these same handler functions behind shared-secret auth;
 * we keep the paths identical so prod & dev have the same contract).
 */
const express = require("express");
const problemService = require("../services/problemService");
const submissionService = require("../services/submissionService");
const { handle } = require("../lib/http");

const router = express.Router();

/** Pull latest problems from Codeforces into the `problems` collection. */
router.post("/refresh-global-problems", handle(async () => ({
  success: true,
  stats: await problemService.refreshGlobalProblems()
})));

/** Trim old submissions (default: older than 90 days). */
router.post("/prune-submissions", handle(async (req) => ({
  success: true,
  stats: await submissionService.pruneOldSubmissions(req.body?.cutoffISO)
})));

module.exports = router;
