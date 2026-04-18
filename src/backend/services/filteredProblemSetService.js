const mongoose = require("mongoose");
const Models = require("../models/models");
const globalProblemSetService = require("./globalProblemSetService");

const FilteredProblemSet = new mongoose.model(
  "FilteredProblemSet",
  Models.filteredProblemSetSchema
);

// Rating buckets we pre-generate problem sets for. Covers the full Codeforces
// range in 100-point steps after 1200.
const RATING_CATEGORIES = [
  600, 800, 1000, 1200, 1300, 1400, 1500, 1600,
  1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400,
  2500, 2600, 2700, 2800, 2900, 3000, 3100, 3200, 3300, 3400, 3500
];

const getRatingCategories = () => RATING_CATEGORIES;

/**
 * NOTE: `month` is 0-indexed (JS Date convention) in internal helpers but
 * stored as 1-indexed in the DB, so callers must use the helpers below
 * instead of querying FilteredProblemSet directly.
 */
const findFilteredProblemSet = (month, year) =>
  FilteredProblemSet.findOne({ month: month + 1, year });

const createFilteredProblemSet = (month, year) =>
  new FilteredProblemSet({ month: month + 1, year, problems: new Map() }).save();

const clearFilteredProblemSet = (month, year) =>
  FilteredProblemSet.deleteOne({ month: month + 1, year });

/**
 * Walk the rating categories in order of distance from the target rating and
 * return the first one with enough unused problems. Used as a fallback when a
 * specific rating bucket is exhausted.
 */
const findClosestAvailableRating = async (targetRating, count) => {
  const sorted = [...RATING_CATEGORIES].sort(
    (a, b) => Math.abs(a - targetRating) - Math.abs(b - targetRating)
  );

  for (const rating of sorted) {
    if (rating === targetRating) continue;
    await globalProblemSetService.resetProblemUsedFlagByRating(rating);
    const problems = await globalProblemSetService.findUnusedProblemsByRating(rating, count);
    if (problems.length >= count) return { rating, problems };
  }
  return { rating: null, problems: [] };
};

/**
 * Populate `problemSet` with one problem per day per rating category, up to
 * `upToDay` of the month. Mutates `stats` with summary info.
 */
const populateProblemSet = async (problemSet, upToDay, stats) => {
  for (const rating of RATING_CATEGORIES) {
    try {
      const problemsForRating = problemSet.problems.get(rating.toString()) || [];

      const lastPopulatedDay = problemsForRating.length > 0
        ? Math.max(...problemsForRating.map(p => p.day))
        : 0;

      const daysToPopulate = [];
      for (let day = lastPopulatedDay + 1; day <= upToDay; day++) {
        daysToPopulate.push(day);
      }
      if (daysToPopulate.length === 0) continue;

      let available = await globalProblemSetService.findUnusedProblemsByRating(
        rating, daysToPopulate.length
      );

      // Not enough unused problems — recycle by resetting the rating's used flags.
      if (available.length < daysToPopulate.length) {
        await globalProblemSetService.resetProblemUsedFlagByRating(rating);
        stats.resetRatings.push(rating);
        available = await globalProblemSetService.findUnusedProblemsByRating(
          rating, daysToPopulate.length
        );

        // Still not enough — use the closest rating bucket as a fallback.
        if (available.length < daysToPopulate.length) {
          const fallback = await findClosestAvailableRating(rating, daysToPopulate.length);
          if (fallback.rating && fallback.problems.length >= daysToPopulate.length) {
            available = fallback.problems;
            stats.fallbackRatings.push({
              originalRating: rating,
              fallbackRating: fallback.rating,
              problemsFound: fallback.problems.length
            });
          } else {
            stats.noAvailableProblems.push({
              rating, available: available.length, needed: daysToPopulate.length
            });
            continue;
          }
        }
      }

      for (let i = 0; i < daysToPopulate.length && i < available.length; i++) {
        const problem = available[i];
        problemsForRating.push({
          day: daysToPopulate[i],
          problemID: problem.problemID,
          problemURL: problem.problemURL
        });
        await globalProblemSetService.markProblemAsUsed(problem.problemID);
        stats.newProblemsAdded++;
      }
      problemSet.problems.set(rating.toString(), problemsForRating);
    } catch (err) {
      console.error(`[filtered] rating ${rating} failed:`, err.message);
      stats.errors.push({ rating, error: err.message });
    }
  }

  await problemSet.save();
};

/**
 * Daily cron entry point. Ensures the current month's problem set is
 * populated through today, and pre-populates the first week of next month
 * when we're near the end of the current one.
 */
const generateFilteredProblemSets = async () => {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const stats = {
    date: today.toISOString().split("T")[0],
    month: currentMonth + 1,
    year: currentYear,
    newProblemsAdded: 0,
    noAvailableProblems: [],
    resetRatings: [],
    fallbackRatings: [],
    errors: []
  };

  let filteredProblemSet = await findFilteredProblemSet(currentMonth, currentYear);

  // First of the month: clear any stale set and rebuild from scratch.
  if (currentDay === 1 || !filteredProblemSet) {
    if (filteredProblemSet && currentDay === 1) {
      await clearFilteredProblemSet(currentMonth, currentYear);
    }
    filteredProblemSet = await createFilteredProblemSet(currentMonth, currentYear);
  }

  await populateProblemSet(filteredProblemSet, currentDay, stats);

  // Pre-populate the first week of next month so day-1 users never hit an empty set.
  if (currentDay >= 28) {
    const nextMonth = (currentMonth + 1) % 12;
    const nextYear = nextMonth === 0 ? currentYear + 1 : currentYear;

    let nextSet = await findFilteredProblemSet(nextMonth, nextYear);
    if (!nextSet) {
      nextSet = await createFilteredProblemSet(nextMonth, nextYear);

      const nextStats = {
        newProblemsAdded: 0, noAvailableProblems: [],
        resetRatings: [], fallbackRatings: [], errors: []
      };
      await populateProblemSet(nextSet, 7, nextStats);

      stats.nextMonthPrepared = { month: nextMonth + 1, year: nextYear };
      stats.nextMonthStats = nextStats;
      stats.newProblemsAdded += nextStats.newProblemsAdded;
    }
  }

  return stats;
};

/**
 * Lookup for the extension. `month` here is 1-12 (client format, as stored
 * in DB). Returns either a single rating's problems or all of them.
 */
const getMonthlyProblems = async (month, year, rating = null) => {
  const filteredProblemSet = await FilteredProblemSet.findOne({ month, year });

  if (!filteredProblemSet) {
    return {
      month, year,
      status: "not_found",
      message: `No problem set found for ${month}/${year}`
    };
  }

  if (rating) {
    return {
      month, year, rating,
      status: "success",
      problems: filteredProblemSet.problems.get(rating.toString()) || []
    };
  }

  const ratings = {};
  for (const [key, problems] of filteredProblemSet.problems.entries()) {
    ratings[key] = problems;
  }
  return { month, year, status: "success", ratings };
};

module.exports = {
  getRatingCategories,
  findFilteredProblemSet,
  clearFilteredProblemSet,
  generateFilteredProblemSets,
  getMonthlyProblems
};
