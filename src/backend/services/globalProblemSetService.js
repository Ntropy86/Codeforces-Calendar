const mongoose = require("mongoose");
const Models = require("../models/models");

const GlobalProblemSet = new mongoose.model(
  "GlobalProblemSet",
  Models.globalProblemSetSchema
);

const CF_PROBLEMSET_API = "https://codeforces.com/api/problemset.problems";

const countProblems = () => GlobalProblemSet.countDocuments({});

const findProblemByID = (problemID) => GlobalProblemSet.findOne({ problemID });

const findUnusedProblemsByRating = (rating, limit) =>
  GlobalProblemSet.find({ problemRating: rating, problemUsed: false }).limit(limit);

const resetProblemUsedFlagByRating = (rating) =>
  GlobalProblemSet.updateMany({ problemRating: rating }, { $set: { problemUsed: false } });

const markProblemAsUsed = (problemID) =>
  GlobalProblemSet.findOneAndUpdate(
    { problemID },
    { $set: { problemUsed: true } },
    { new: true }
  );

const fetchProblemsFromCodeforces = async () => {
  const response = await fetch(CF_PROBLEMSET_API);
  const data = await response.json();
  if (data.status !== "OK") {
    throw new Error("Failed to fetch problems from Codeforces API");
  }
  return data;
};

/**
 * Sync our global problem set with the Codeforces API. Only inspects problems
 * newer than what we already have (CF returns problems in newest-first order),
 * inserts new ones in a single batch, and patches any rating updates for
 * problems we already track.
 */
const updateGlobalProblemSet = async () => {
  const existingCount = await countProblems();
  const { result } = await fetchProblemsFromCodeforces();
  const problems = result.problems;

  const newProblemsToCheck = Math.max(0, problems.length - existingCount);

  const stats = {
    totalProblems: problems.length,
    existingInDB: existingCount,
    newProblemsChecked: newProblemsToCheck,
    newProblemsAdded: 0,
    duplicatesFound: 0,
    noRatingFound: 0,
    errors: 0
  };

  if (newProblemsToCheck === 0) return stats;

  const newestProblems = problems.slice(0, newProblemsToCheck);
  const toInsert = [];

  for (const problem of newestProblems) {
    try {
      const problemID = `${problem.contestId}${problem.index}`;

      if (problem.rating === undefined) {
        stats.noRatingFound++;
        continue;
      }

      const existing = await findProblemByID(problemID);
      if (!existing) {
        toInsert.push({
          problemID,
          problemRating: problem.rating,
          problemURL: `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`,
          problemUsed: false
        });
      } else if (existing.problemRating !== problem.rating) {
        existing.problemRating = problem.rating;
        await existing.save();
      } else {
        stats.duplicatesFound++;
      }
    } catch (err) {
      console.error("[global] problem processing failed:", err.message);
      stats.errors++;
    }
  }

  if (toInsert.length > 0) {
    await GlobalProblemSet.insertMany(toInsert);
    stats.newProblemsAdded = toInsert.length;
    console.log(`[global] inserted ${stats.newProblemsAdded} new problems`);
  }

  return stats;
};

module.exports = {
  countProblems,
  findProblemByID,
  fetchProblemsFromCodeforces,
  findUnusedProblemsByRating,
  resetProblemUsedFlagByRating,
  markProblemAsUsed,
  updateGlobalProblemSet
};
