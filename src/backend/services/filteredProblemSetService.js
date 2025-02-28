const mongoose = require("mongoose");
const Models = require("../models/models");
const FilteredProblemSet = new mongoose.model("FilteredProblemSet", Models.filteredProblemSetSchema);
const globalProblemSetService = require("./globalProblemSetService");

// Define the rating categories as a constant for reuse
const RATING_CATEGORIES = [
    600, 800, 1000, 1200, 1300, 1400, 1500, 1600, 
    1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 
    2500, 2600, 2700, 2800, 2900, 3000, 3100, 3200, 3300, 3400, 3500
];

/**
 * Get all rating categories
 * @returns {Array} Array of rating categories
 */
const getRatingCategories = () => {
    return RATING_CATEGORIES;
};

/**
 * Find the filtered problem set for a specific month and year
 * @param {number} month - Month (0-11)
 * @param {number} year - Year
 * @returns {Promise<Object>} The filtered problem set document or null if not found
 */
const findFilteredProblemSet = async (month, year) => {
    try {
        return await FilteredProblemSet.findOne({ month, year });
    } catch (error) {
        throw error;
    }
};

/**
 * Create a new filtered problem set for a specific month and year
 * @param {number} month - Month (0-11)
 * @param {number} year - Year
 * @returns {Promise<Object>} The newly created filtered problem set document
 */
const createFilteredProblemSet = async (month, year) => {
    try {
        const newFilteredProblemSet = new FilteredProblemSet({
            month,
            year,
            problems: new Map()
        });
        
        return await newFilteredProblemSet.save();
    } catch (error) {
        throw error;
    }
};

/**
 * Find or create a filtered problem set for a specific month and year
 * @param {number} month - Month (0-11)
 * @param {number} year - Year
 * @returns {Promise<Object>} The filtered problem set document
 */
const findOrCreateFilteredProblemSet = async (month, year) => {
    try {
        let filteredProblemSet = await findFilteredProblemSet(month, year);
        
        if (!filteredProblemSet) {
            console.log(`No filtered problem set found for ${month}/${year}. Creating a new one.`);
            filteredProblemSet = await createFilteredProblemSet(month, year);
        }
        
        return filteredProblemSet;
    } catch (error) {
        throw error;
    }
};

/**
 * Clear filtered problem set for a specific month and year
 * @param {number} month - Month (0-11)
 * @param {number} year - Year
 * @returns {Promise<Object>} Result of the delete operation
 */
const clearFilteredProblemSet = async (month, year) => {
    try {
        return await FilteredProblemSet.deleteOne({ month, year });
    } catch (error) {
        throw error;
    }
};

/**
 * Get monthly problems for a specific rating
 * @param {number} month - Month (0-11)
 * @param {number} year - Year
 * @param {number} rating - Problem rating
 * @returns {Promise<Array>} Array of problems for the month
 */
const getMonthlyProblemsForRating = async (month, year, rating) => {
    try {
        const filteredProblemSet = await findFilteredProblemSet(month, year);
        
        if (!filteredProblemSet) {
            return [];
        }
        
        return filteredProblemSet.problems.get(rating.toString()) || [];
    } catch (error) {
        throw error;
    }
};

/**
 * Generate filtered problem sets for each rating
 * @returns {Promise<Object>} Statistics about the generation process
 */
const generateFilteredProblemSets = async () => {
    try {
        const today = new Date();
        const currentDay = today.getDate();
        const currentMonth = today.getMonth() + 1; // Month is 0-indexed
        const currentYear = today.getFullYear();
        
        console.log(`Running filtered problem set generation for date: ${today.toISOString().split('T')[0]}`);
        
        // Stats for response
        let stats = {
            date: today.toISOString().split('T')[0],
            month: currentMonth,
            year: currentYear,
            newProblemsAdded: 0,
            noAvailableProblems: [],
            resetRatings: [],
            errors: []
        };
        
        // If it's the first day of the month, clear the filtered problem set for this month and year
        if (currentDay === 1) {
            console.log(`It's the first day of the month. Clearing filtered problem set for ${currentMonth}/${currentYear}.`);
            await clearFilteredProblemSet(currentMonth, currentYear);
        }
        
        // Retrieve or create the filtered problem set for this month and year
        let filteredProblemSet = await findOrCreateFilteredProblemSet(currentMonth, currentYear);
        
        // For each rating category, add problems for days that need to be populated
        for (const rating of RATING_CATEGORIES) {
            try {
                // Get the problems map for this rating or create a new one
                let problemsForRating = filteredProblemSet.problems.get(rating.toString()) || [];
                
                // Find the last day that has been populated for this rating
                let lastPopulatedDay = 0;
                
                if (problemsForRating.length > 0) {
                    // Find the maximum day in the existing problems
                    lastPopulatedDay = Math.max(...problemsForRating.map(p => p.day));
                }
                
                // Days that need to be populated (from last populated day + 1 to current day)
                const daysToPopulate = [];
                for (let day = lastPopulatedDay + 1; day <= currentDay; day++) {
                    daysToPopulate.push(day);
                }
                
                if (daysToPopulate.length === 0) {
                    // This rating is already up to date
                    continue;
                }
                
                console.log(`Rating ${rating}: Populating days ${daysToPopulate.join(', ')}`);
                
                // Find available problems for this rating that haven't been used
                let availableProblems = await globalProblemSetService.findUnusedProblemsByRating(
                    rating, 
                    daysToPopulate.length
                );
                
                // If not enough problems, reset problemUsed flag for this rating and try again
                if (availableProblems.length < daysToPopulate.length) {
                    console.log(`Not enough problems for rating ${rating}. Resetting problemUsed flags.`);
                    
                    // Reset all problems for this rating
                    await globalProblemSetService.resetProblemUsedFlagByRating(rating);
                    stats.resetRatings.push(rating);
                    
                    // Try again with the reset problems
                    availableProblems = await globalProblemSetService.findUnusedProblemsByRating(
                        rating, 
                        daysToPopulate.length
                    );
                    
                    // If still not enough problems, log the issue and continue to next rating
                    if (availableProblems.length < daysToPopulate.length) {
                        console.log(`Still not enough problems for rating ${rating} after reset. Available: ${availableProblems.length}, Needed: ${daysToPopulate.length}`);
                        stats.noAvailableProblems.push({
                            rating,
                            available: availableProblems.length,
                            needed: daysToPopulate.length
                        });
                        continue;
                    }
                }
                
                // Assign problems to days and mark them as used
                for (let i = 0; i < daysToPopulate.length; i++) {
                    const day = daysToPopulate[i];
                    const problem = availableProblems[i];
                    
                    // Add to filtered problem set
                    problemsForRating.push({
                        day,
                        problemID: problem.problemID,
                        problemURL: problem.problemURL
                    });
                    
                    // Mark the problem as used in the global set
                    await globalProblemSetService.markProblemAsUsed(problem.problemID);
                    
                    stats.newProblemsAdded++;
                }
                
                // Update the problems map for this rating
                filteredProblemSet.problems.set(rating.toString(), problemsForRating);
                
            } catch (error) {
                console.error(`Error processing rating ${rating}:`, error);
                stats.errors.push({
                    rating,
                    error: error.message
                });
            }
        }
        
        // Save the updated filtered problem set
        await filteredProblemSet.save();
        
        return stats;
    } catch (error) {
        throw error;
    }
};

/**
 * Get all problems for a specific month, year and rating
 * @param {number} month - Month (0-11)
 * @param {number} year - Year
 * @param {number} rating - Problem rating (optional)
 * @returns {Promise<Object>} Object with problems organized by rating
 */
const getMonthlyProblems = async (month, year, rating = null) => {
    try {
        const filteredProblemSet = await findFilteredProblemSet(month, year);
        
        if (!filteredProblemSet) {
            return {
                month,
                year,
                status: "not_found",
                message: `No problem set found for ${month}/${year}`
            };
        }
        
        // If rating is specified, return only problems for that rating
        if (rating) {
            const problemsForRating = filteredProblemSet.problems.get(rating.toString()) || [];
            
            return {
                month,
                year,
                rating,
                status: "success",
                problems: problemsForRating
            };
        }
        
        // Otherwise, return all problems organized by rating
        const result = {
            month,
            year,
            status: "success",
            ratings: {}
        };
        
        // Convert Map to plain object for response
        for (const [ratingKey, problems] of filteredProblemSet.problems.entries()) {
            result.ratings[ratingKey] = problems;
        }
        
        return result;
    } catch (error) {
        throw error;
    }
};

module.exports = {
    getRatingCategories,
    findFilteredProblemSet,
    findOrCreateFilteredProblemSet,
    clearFilteredProblemSet,
    getMonthlyProblemsForRating,
    generateFilteredProblemSets,
    getMonthlyProblems
};