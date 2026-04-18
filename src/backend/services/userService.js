const User = require("../models/User");

const CF_USER_API = "https://codeforces.com/api/user.info?handles=";
const UNRATED_DEFAULT = 800;

/**
 * Fetch canonical handle + current rating from the Codeforces API.
 * Throws an error tagged with `statusCode = 400` for invalid handles so
 * the controller layer can translate it to an HTTP 400.
 */
async function fetchFromCodeforces(handle) {
  const res = await fetch(`${CF_USER_API}${encodeURIComponent(handle)}`);
  const body = await res.json();

  if (body.status !== "OK") {
    const err = new Error(body.comment || "Invalid Codeforces handle");
    err.statusCode = 400;
    throw err;
  }

  const cf = body.result[0];
  return { handle: cf.handle, rating: cf.rating ?? UNRATED_DEFAULT };
}

/**
 * Single source of truth for user login/signup.
 * Always reconciles with Codeforces so the rating can never go stale.
 */
async function getOrCreateUser(rawHandle) {
  const { handle, rating } = await fetchFromCodeforces(rawHandle);

  // Case-insensitive lookup; we store canonical CF casing on first write.
  const existing = await User.findOne({ userID: new RegExp(`^${escapeRegex(handle)}$`, "i") });

  if (existing) {
    if (existing.rating !== rating) {
      existing.rating = rating;
      existing.ratingUpdatedAt = new Date();
      await existing.save();
    }
    return existing;
  }

  return User.create({ userID: handle, rating });
}

async function findUser(userID) {
  return User.findOne({ userID: new RegExp(`^${escapeRegex(userID)}$`, "i") });
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { getOrCreateUser, findUser, UNRATED_DEFAULT };
