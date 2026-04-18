const mongoose = require("mongoose");

/**
 * One doc per (user, date, problem) accepted solve.
 *
 * Replaces V2's `user.streak.streak_days` Map. Benefits:
 *   - Streak = aggregate over a date index; no per-user doc balloon
 *   - Cleanup is a single deleteMany({ dateISO: { $lt: threshold } })
 *   - Trivially supports "user solved multiple problems today" without schema change
 *   - Works across multiple API instances with no write contention
 *
 * `dateISO` is "YYYY-MM-DD" in UTC. Always derived from submittedAt on the
 * server to guarantee consistency across timezones.
 *
 * `problemCfId` may be null for submissions imported from the V2 migration
 * (we knew the day was solved, but not which problem).
 */
const submissionSchema = new mongoose.Schema(
  {
    userID: { type: String, required: true, index: true },
    dateISO: { type: String, required: true },
    problemCfId: { type: String, default: null },
    verdict: { type: String, default: "OK" },
    submittedAt: { type: Date, default: Date.now },
    source: { type: String, enum: ["live", "migrated"], default: "live" }
  },
  { collection: "submissions" }
);

// A user gets at most one "solved" marker per day per problem. Distinct
// problems on the same day are allowed — handy for future multi-solve UIs.
submissionSchema.index({ userID: 1, dateISO: 1, problemCfId: 1 }, { unique: true });
submissionSchema.index({ userID: 1, dateISO: 1 });

submissionSchema.set("toJSON", { versionKey: false });

module.exports = mongoose.model("Submission", submissionSchema);
