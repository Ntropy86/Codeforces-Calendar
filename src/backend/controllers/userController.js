const userService = require("../services/userService");
const streakService = require("../services/streakService");
const problemService = require("../services/problemService");
const { handle, required } = require("../lib/http");
const { toISODate } = require("../lib/dates");

/**
 * POST /users
 * Body: { userID }
 * Returns: { user, today: { dateISO, problem, streak } }
 *
 * Single onboarding endpoint. Upserts the user (case-insensitive),
 * reconciles rating from Codeforces, and returns enough for the extension
 * to render the home screen in one round-trip.
 */
exports.createOrLogin = handle(async (req) => {
  const userID = required(req.body?.userID, "userID");
  const user = await userService.getOrCreateUser(userID);
  return buildUserView(user);
});

/**
 * GET /users/:userID
 * Returns: { user, today } — same shape as POST for consistency.
 */
exports.getUser = handle(async (req) => {
  const userID = required(req.params.userID, "userID");
  const user = await userService.findUser(userID);
  if (!user) {
    const err = new Error(`User not found: ${userID}`);
    err.statusCode = 404;
    throw err;
  }
  return buildUserView(user);
});

/**
 * POST /users/:userID/refresh-rating
 * Force a Codeforces re-sync. Useful for the "refresh rating" button even
 * though getOrCreateUser is already idempotent on login.
 */
exports.refreshRating = handle(async (req) => {
  const userID = required(req.params.userID, "userID");
  const user = await userService.getOrCreateUser(userID);
  return buildUserView(user);
});

async function buildUserView(user) {
  const dateISO = toISODate(new Date());
  const [problem, streak] = await Promise.all([
    problemService.getDailyProblem(user.rating, dateISO),
    streakService.getCurrentStreak(user.userID)
  ]);
  return {
    user: {
      userID: user.userID,
      rating: user.rating,
      ratingUpdatedAt: user.ratingUpdatedAt,
      createdAt: user.createdAt
    },
    today: { dateISO, problem, streak }
  };
}
