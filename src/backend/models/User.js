const mongoose = require("mongoose");

/**
 * Slim user record. Holds identity + current rating only.
 *
 * Streak state is NOT stored here — it's derived from the `submissions`
 * collection (see services/streakService.js). This avoids the V2 problem
 * of denormalised streak fields drifting out of sync with reality.
 *
 * `userID` stores Codeforces canonical casing (e.g. "tourist", not "TOURIST"),
 * assigned on creation by resolving the handle via the Codeforces API.
 */
const userSchema = new mongoose.Schema(
  {
    userID: { type: String, required: true, unique: true, index: true },
    rating: { type: Number, required: true },
    ratingUpdatedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
  },
  { collection: "users" }
);

userSchema.set("toJSON", { versionKey: false });
userSchema.set("toObject", { versionKey: false });

module.exports = mongoose.model("User", userSchema);
