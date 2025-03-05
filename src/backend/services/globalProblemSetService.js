const mongoose = require("mongoose");
const Models = require("../models/models");
const GlobalProblemSet = new mongoose.model("GlobalProblemSet", Models.globalProblemSetSchema);

/**
 * Count all problems in the global problem set
 * @returns {Promise<number>} Number of problems in the database
 */
const countProblems = async () => {
    try {
        return await GlobalProblemSet.countDocuments({});
    } catch (error) {
        throw error;
    }
};

/**
 * Find a problem by its ID
 * @param {string} problemID - Problem ID to search for
 * @returns {Promise<Object>} Problem object or null if not found
 */
const findProblemByID = async (problemID) => {
    try {
        return await GlobalProblemSet.findOne({ problemID: problemID });
    } catch (error) {
        throw error;
    }
};

/**
 * Fetch problems from Codeforces API
 * @returns {Promise<Object>} Object containing Codeforces API response
 */
const fetchProblemsFromCodeforces = async () => {
    try {
        const codeforcesAPI = "https://codeforces.com/api/problemset.problems";
        const response = await fetch(codeforcesAPI);
        const data = await response.json();
        
        if (data.status !== "OK") {
            throw new Error("Failed to fetch problems from Codeforces API");
        }
        
        return data;
    } catch (error) {
        throw error;
    }
};

/**
 * Create a new problem
 * @param {Object} problemData - Problem data to insert
 * @returns {Promise<Object>} Created problem object
 */
const createProblem = async (problemData) => {
    try {
        const newProblem = new GlobalProblemSet(problemData);
        return await newProblem.save();
    } catch (error) {
        throw error;
    }
};

/**
 * Update a problem
 * @param {Object} problem - Problem object to update
 * @returns {Promise<Object>} Updated problem object
 */
const updateProblem = async (problem) => {
    try {
        return await problem.save();
    } catch (error) {
        throw error;
    }
};

/**
 * Insert multiple problems at once
 * @param {Array} problems - Array of problem objects to insert
 * @returns {Promise<Array>} Array of inserted problem objects
 */
const insertManyProblems = async (problems) => {
    try {
        return await GlobalProblemSet.insertMany(problems);
    } catch (error) {
        throw error;
    }
};

/**
 * Find unused problems by rating
 * @param {number} rating - Problem rating to filter by
 * @param {number} limit - Maximum number of problems to return
 * @returns {Promise<Array>} Array of problem objects
 */
const findUnusedProblemsByRating = async (rating, limit) => {
    try {
        return await GlobalProblemSet.find({
            problemRating: rating,
            problemUsed: false
        }).limit(limit);
    } catch (error) {
        throw error;
    }
};

/**
 * Reset problemUsed flag for problems with a specific rating
 * @param {number} rating - Problem rating to reset
 * @returns {Promise<Object>} Result of the update operation
 */
const resetProblemUsedFlagByRating = async (rating) => {
    try {
        return await GlobalProblemSet.updateMany(
            { problemRating: rating },
            { $set: { problemUsed: false } }
        );
    } catch (error) {
        throw error;
    }
};

/**
 * Mark a problem as used
 * @param {string} problemID - ID of the problem to mark as used
 * @returns {Promise<Object>} Updated problem object
 */
const markProblemAsUsed = async (problemID) => {
    try {
        return await GlobalProblemSet.findOneAndUpdate(
            { problemID: problemID },
            { $set: { problemUsed: true } },
            { new: true }
        );
    } catch (error) {
        throw error;
    }
};

/**
 * Update global problem set with new problems from Codeforces
 * @returns {Promise<Object>} Statistics about the update operation
 */
const updateGlobalProblemSet = async () => {
    try {
        // Get count of existing problems
        const existingProblemCount = await countProblems();
        console.log("Existing problems in database:", existingProblemCount);
        
        // Fetch problems from Codeforces API
        const data = await fetchProblemsFromCodeforces();
        const problems = data.result.problems;
        console.log("Problems fetched from CF API:", problems.length);
        
        // Calculate how many new problems to process
        const newProblemsToCheck = Math.max(0, problems.length - existingProblemCount);
        console.log("New problems to check:", newProblemsToCheck);
        
        // Stats for response
        let stats = {
            totalProblems: problems.length,
            existingInDB: existingProblemCount,
            newProblemsChecked: newProblemsToCheck,
            newProblemsAdded: 0,
            duplicatesFound: 0,
            noRatingFound: 0,
            errors: 0
        };
        
        // If there are potentially new problems, process them
        if (newProblemsToCheck > 0) {
            // Get the newest problems to check
            const newestProblems = problems.slice(0, newProblemsToCheck);
            
            // Create a batch of problems to insert
            const problemsToInsert = [];
            
            // Check each potentially new problem
            for (const problem of newestProblems) {
                try {
                    const problemID = `${problem.contestId}${problem.index}`;
                    
                    if (problem.rating === undefined) {
                        console.log(`Problem rating of ${problemID} is undefined. Skipping this...`);
                        stats.noRatingFound++;
                        continue;
                    }
                    
                    // Check if problem already exists
                    const existingProblem = await findProblemByID(problemID);
                    
                    if (!existingProblem) {
                        console.log(`New problem found: ${problemID}`);
                        const problemURL = `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`;
                        const problemRating = problem.rating || null;
                        
                        // Add to batch insert array
                        problemsToInsert.push({
                            problemID: problemID,
                            problemRating: problemRating,
                            problemURL: problemURL,
                            problemUsed: false
                        });
                    } else {
                        // Check for rating update
                        if ((existingProblem.problemRating === undefined && problem.rating !== undefined) || 
                            (existingProblem.problemRating !== problem.rating)) {
                            console.log(`Problem rating of ${problemID} is updated from ${existingProblem.problemRating} to ${problem.rating}`);
                            existingProblem.problemRating = problem.rating;
                            await updateProblem(existingProblem);
                        } else {
                            console.log(`Duplicate problem found: ${problemID}`);
                            stats.duplicatesFound++;
                        }
                    }
                } catch (error) {
                    console.error(`Error processing problem:`, error);
                    stats.errors++;
                }
            }
            
            // Batch insert new problems if any were found
            if (problemsToInsert.length > 0) {
                await insertManyProblems(problemsToInsert);
                stats.newProblemsAdded = problemsToInsert.length;
                console.log(`Inserting ${stats.newProblemsAdded} into database...`);
            }
        }
        
        return stats;
    } catch (error) {
        throw error;
    }
};

module.exports = {
    countProblems,
    findProblemByID,
    fetchProblemsFromCodeforces,
    createProblem,
    updateProblem,
    insertManyProblems,
    findUnusedProblemsByRating,
    resetProblemUsedFlagByRating,
    markProblemAsUsed,
    updateGlobalProblemSet
};