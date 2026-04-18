const mongoose = require("mongoose");
const userService = require("../services/userService");
const Models = require("../models/models");

const User = mongoose.model("User", Models.userSchema);

const sendError = (res, err, fallback = "Internal server error") => {
  console.error(err);
  const status = err.statusCode || 500;
  res.status(status).json({ message: err.message || fallback });
};

/**
 * GET /users?userID=handle
 * Lookup-only; does not touch the Codeforces API.
 */
const getUser = async (req, res) => {
  try {
    const userID = req.query.userID || req.body.userID;
    if (!userID) return res.status(400).json("UserID is required");

    const user = await userService.findUserByID(userID);
    if (user.length === 0) return res.status(404).json("User not found");

    res.status(200).json({ message: user });
  } catch (err) {
    sendError(res, err);
  }
};

/**
 * POST /users
 * Single entry point for login/signup. Always reconciles the local record
 * with the Codeforces API (handles new users, rating drift, casing).
 */
const createUser = async (req, res) => {
  try {
    const userID = req.body.userID;
    if (!userID) return res.status(400).json("UserID is required");

    const user = await userService.getOrCreateUser(userID);
    res.status(200).json({ message: user });
  } catch (err) {
    sendError(res, err);
  }
};

/**
 * POST /users/refresh-rating
 * Kept as an explicit manual-refresh endpoint, but internally just delegates
 * to getOrCreateUser so the Codeforces-sync logic lives in one place.
 */
const refreshUserRating = async (req, res) => {
  try {
    const userID = req.body.userID;
    if (!userID) return res.status(400).json("UserID is required");

    const user = await userService.refreshUserRating(userID);
    res.status(200).json({ message: user });
  } catch (err) {
    sendError(res, err);
  }
};

const updateUserStreak = async (req, res) => {
  try {
    const { userID, last_streak_count, updateDate } = req.body;
    if (!userID) return res.status(400).json("UserID is required");
    if (last_streak_count === undefined) return res.status(400).json("last_streak_count is required");

    const user = await userService.updateUserStreak(userID, last_streak_count, updateDate === true);
    res.status(200).json({ message: user });
  } catch (err) {
    sendError(res, err);
  }
};

const updateUserStreakDay = async (req, res) => {
  try {
    const { userID, day, solved } = req.body;
    if (!userID) return res.status(400).json("UserID is required");
    if (!day) return res.status(400).json("Day is required");

    const user = await userService.updateUserStreakDay(userID, day, solved !== false);
    res.status(200).json({ message: user });
  } catch (err) {
    sendError(res, err);
  }
};

const resetUserStreakDays = async (req, res) => {
  try {
    const userID = req.body.userID;
    if (!userID) return res.status(400).json("UserID is required");

    const user = await userService.resetUserStreakDays(userID);
    res.status(200).json({ message: user });
  } catch (err) {
    sendError(res, err);
  }
};

const cleanupOldStreakDays = async (req, res) => {
  try {
    const userID = req.body.userID;
    if (!userID) return res.status(400).json("UserID is required");

    const user = await userService.cleanupOldStreakDays(userID);
    res.status(200).json({ message: "Old streak days cleaned up", user });
  } catch (err) {
    sendError(res, err);
  }
};

/**
 * PUT /users/streak-date
 * Thin wrapper — only used by the frontend streak reconciler to set
 * last_streak_date to a specific past date.
 */
const updateUserStreakDate = async (req, res) => {
  try {
    const { userID, last_streak_date } = req.body;
    if (!userID) return res.status(400).json("UserID is required");
    if (!last_streak_date) return res.status(400).json("last_streak_date is required");

    const user = await User.findOneAndUpdate(
      { userID },
      { $set: { "streak.last_streak_date": new Date(last_streak_date) } },
      { new: true }
    );
    if (!user) return res.status(404).json("User not found");

    res.status(200).json({ message: user });
  } catch (err) {
    sendError(res, err);
  }
};

module.exports = {
  getUser,
  createUser,
  refreshUserRating,
  updateUserStreak,
  updateUserStreakDay,
  resetUserStreakDays,
  cleanupOldStreakDays,
  updateUserStreakDate
};
