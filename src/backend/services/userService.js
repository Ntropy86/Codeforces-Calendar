const mongoose = require("mongoose");
const Models = require("../models/models");

const User = mongoose.model("User", Models.userSchema);

const CF_USER_API = "https://codeforces.com/api/user.info?handles=";
const UNRATED_DEFAULT = 800;

/**
 * Fetch a user from the Codeforces API. Returns the canonical handle and
 * current rating (defaults to UNRATED_DEFAULT for unrated users).
 * Throws a 400-tagged error if the handle is invalid.
 */
const fetchFromCodeforces = async (handle) => {
  const response = await fetch(`${CF_USER_API}${handle}`);
  const data = await response.json();

  if (data.status !== "OK") {
    const err = new Error(data.comment || "Invalid Codeforces handle");
    err.statusCode = 400;
    throw err;
  }

  const cf = data.result[0];
  return {
    handle: cf.handle,
    rating: cf.rating || UNRATED_DEFAULT
  };
};

/** Build an empty streak_days map for the current month. */
const buildInitialStreakDays = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const streakDays = {};
  for (let day = 1; day <= daysInMonth; day++) {
    streakDays[`${year}-${month}-${day}`] = false;
  }
  return streakDays;
};

const findUserByID = (userID) => User.find({ userID });

/**
 * Single source of truth for user login / signup.
 *
 * Always fetches the latest user info from Codeforces and reconciles it with
 * our DB. If the rating has drifted, we update it. New users are created with
 * canonical CF casing and a fresh streak_days map.
 */
const getOrCreateUser = async (userID) => {
  const { handle, rating } = await fetchFromCodeforces(userID);

  const existing = await User.findOne({
    userID: { $regex: `^${handle}$`, $options: "i" }
  });

  if (existing) {
    if (existing.rating !== rating) {
      console.log(`[user] rating sync ${handle}: ${existing.rating} -> ${rating}`);
      existing.rating = rating;
      await existing.save();
    }
    return existing;
  }

  console.log(`[user] creating ${handle} (rating: ${rating})`);
  return new User({
    userID: handle,
    rating,
    streak: {
      last_streak_date: null,
      last_streak_count: 0,
      streak_days: buildInitialStreakDays()
    }
  }).save();
};

/**
 * Manual "refresh rating" endpoint now piggy-backs on getOrCreateUser so the
 * Codeforces-sync logic lives in exactly one place.
 */
const refreshUserRating = (userID) => getOrCreateUser(userID);

const updateUserStreakDay = async (userID, day, solved = true) => {
  const date = new Date();
  const monthDay = day || date.getDate();
  const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${monthDay}`;

  const updated = await User.findOneAndUpdate(
    { userID },
    { $set: { [`streak.streak_days.${dayKey}`]: solved } },
    { new: true }
  );
  if (!updated) throw new Error("User not found");
  return updated;
};

const resetUserStreakDays = async (userID) => {
  const date = new Date();
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;

  const updateQuery = {};
  for (let i = 1; i <= daysInMonth; i++) {
    updateQuery[`streak.streak_days.${monthKey}-${i}`] = false;
  }

  const updated = await User.findOneAndUpdate(
    { userID },
    { $set: updateQuery },
    { new: true }
  );
  if (!updated) throw new Error("User not found");
  return updated;
};

const updateUserStreak = async (userID, lastStreakCount, updateDate = false) => {
  const streakCount = parseInt(lastStreakCount, 10);

  const existing = await User.findOne({ userID });
  if (!existing) throw new Error("User not found");

  const updateFields = { "streak.last_streak_count": streakCount };

  if (
    updateDate ||
    (streakCount > 0 && existing.streak.last_streak_count !== streakCount)
  ) {
    updateFields["streak.last_streak_date"] = new Date();
  }

  // For a continuing streak (or a new validated solve) mark today solved.
  const isReset = streakCount === 0;
  if (!isReset || updateDate) {
    const today = new Date();
    const dayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    updateFields[`streak.streak_days.${dayKey}`] = true;
  }

  const updated = await User.findOneAndUpdate(
    { userID },
    { $set: updateFields },
    { new: true }
  );
  if (!updated) throw new Error("User not found");
  return updated;
};

/** Drop streak_days entries older than 3 months to keep the doc compact. */
const cleanupOldStreakDays = async (userID) => {
  const user = await User.findOne({ userID });
  if (!user || !user.streak || !user.streak.streak_days) {
    throw new Error("User or streak days not found");
  }

  const threshold = new Date();
  threshold.setMonth(threshold.getMonth() - 3);

  const keyToDate = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const unset = {};
  let removed = 0;
  for (const key of Object.keys(user.streak.streak_days.toObject?.() ?? user.streak.streak_days)) {
    if (keyToDate(key) < threshold) {
      unset[`streak.streak_days.${key}`] = "";
      removed++;
    }
  }

  if (removed === 0) return user;

  console.log(`[user] cleaned ${removed} old streak days for ${userID}`);
  return User.findOneAndUpdate(
    { userID },
    { $unset: unset },
    { new: true }
  );
};

module.exports = {
  findUserByID,
  getOrCreateUser,
  refreshUserRating,
  updateUserStreak,
  updateUserStreakDay,
  resetUserStreakDays,
  cleanupOldStreakDays
};
