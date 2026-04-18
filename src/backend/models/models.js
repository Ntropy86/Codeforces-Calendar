const mongoose = require("mongoose");

exports.globalProblemSetSchema = new mongoose.Schema({
  problemID: String,
  problemRating: Number,
  problemURL: String,
  problemUsed: Boolean
});

/**
 * Stores the per-day problem assignments for a given month, keyed by rating.
 *
 * Shape:
 *   { month, year, problems: Map<ratingString, [{ day, problemID, problemURL }]> }
 *
 * The Map allows us to add new rating buckets without schema changes.
 */
exports.filteredProblemSetSchema = new mongoose.Schema({
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  problems: {
    type: Map,
    of: [
      new mongoose.Schema(
        {
          day: { type: Number, required: true },
          problemID: String,
          problemURL: String
        },
        { _id: false }
      )
    ]
  }
});

/**
 * User record.
 * - `rating`            : kept in sync with Codeforces on every login.
 * - `streak.last_streak_date`  : the most recent date the user solved the POTD.
 * - `streak.last_streak_count` : cached current streak length. Authoritative
 *                                source is `streak_days`; this is a fast-path
 *                                convenience to avoid a full recount on each
 *                                badge update.
 * - `streak.streak_days`       : Map<"YYYY-M-D", Boolean> of solved flags.
 *                                Trimmed to ~3 months by the cleanup cron.
 */
exports.userSchema = new mongoose.Schema({
  userID: String,
  rating: Number,
  streak: {
    last_streak_date: Date,
    last_streak_count: Number,
    streak_days: {
      type: Map,
      of: Boolean,
      default: {}
    }
  }
});
