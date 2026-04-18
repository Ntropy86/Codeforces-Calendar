const mongoose = require("mongoose");

/**
 * A Codeforces problem in our canonical pool.
 *
 * Populated by the `refresh-global-problems` cron from
 * https://codeforces.com/api/problemset.problems. Never deleted — Codeforces
 * problems are permanent. Rating can drift; we patch it in place.
 *
 * Intentionally does NOT carry any "used" / "assigned to day" state — daily
 * problem selection is a deterministic function of `(rating, date, pool)`,
 * computed on read (see lib/dailyProblem.js).
 */
const problemSchema = new mongoose.Schema(
  {
    cfId: { type: String, required: true, unique: true, index: true },
    contestId: { type: Number, required: true },
    index: { type: String, required: true },
    name: { type: String, required: true },
    rating: { type: Number, required: true, index: true },
    tags: { type: [String], default: [] },
    addedAt: { type: Date, default: Date.now, index: true }
  },
  { collection: "problems" }
);

problemSchema.index({ rating: 1, addedAt: 1 });

problemSchema.virtual("url").get(function () {
  return `https://codeforces.com/problemset/problem/${this.contestId}/${this.index}`;
});

problemSchema.set("toJSON", { virtuals: true });
problemSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Problem", problemSchema);
