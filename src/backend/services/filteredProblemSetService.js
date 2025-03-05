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
 * @param {number} month - Month (0-11 for JavaScript Date, but stored as 1-12 in database)
 * @param {number} year - Year
 * @returns {Promise<Object>} The filtered problem set document or null if not found
 */
const findFilteredProblemSet = async (month, year) => {
    try {
        // Add 1 to month because we store months as 1-12 in database
        const dbMonth = month + 1;
        console.log(`Looking for filtered problem set for month: ${dbMonth}, year: ${year}`);
        return await FilteredProblemSet.findOne({ month: dbMonth, year });
    } catch (error) {
        throw error;
    }
};

/**
 * Create a new filtered problem set for a specific month and year
 * @param {number} month - Month (0-11 for JavaScript Date, but stored as 1-12 in database)
 * @param {number} year - Year
 * @returns {Promise<Object>} The newly created filtered problem set document
 */
const createFilteredProblemSet = async (month, year) => {
    try {
        // Add 1 to month because we store months as 1-12 in database
        const dbMonth = month + 1;
        console.log(`Creating new filtered problem set for month: ${dbMonth}, year: ${year}`);
        const newFilteredProblemSet = new FilteredProblemSet({
            month: dbMonth,
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
 * @param {number} month - Month (0-11 for JavaScript Date, but stored as 1-12 in database)
 * @param {number} year - Year
 * @returns {Promise<Object>} The filtered problem set document
 */
const findOrCreateFilteredProblemSet = async (month, year) => {
    try {
        let filteredProblemSet = await findFilteredProblemSet(month, year);
        
        if (!filteredProblemSet) {
            // Add 1 to month for display in log (1-12)
            console.log(`No filtered problem set found for ${month + 1}/${year}. Creating a new one.`);
            filteredProblemSet = await createFilteredProblemSet(month, year);
        }
        
        return filteredProblemSet;
    } catch (error) {
        throw error;
    }
};

/**
 * Clear filtered problem set for a specific month and year
 * @param {number} month - Month (0-11 for JavaScript Date, but stored as 1-12 in database)
 * @param {number} year - Year
 * @returns {Promise<Object>} Result of the delete operation
 */
const clearFilteredProblemSet = async (month, year) => {
    try {
        // Add 1 to month because we store months as 1-12 in database
        const dbMonth = month + 1;
        console.log(`Clearing filtered problem set for month: ${dbMonth}, year: ${year}`);
        return await FilteredProblemSet.deleteOne({ month: dbMonth, year });
    } catch (error) {
        throw error;
    }
};

/**
 * Get monthly problems for a specific rating
 * @param {number} month - Month (0-11 for JavaScript Date, but stored as 1-12 in database)
 * @param {number} year - Year
 * @param {number} rating - Problem rating
 * @returns {Promise<Array>} Array of problems for the month
 */
const getMonthlyProblemsForRating = async (month, year, rating) => {
    try {
        // Add 1 to month because we store months as 1-12 in database
        const dbMonth = month + 1;
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
 * Find the closest available rating that has unused problems
 * @param {number} targetRating - The target rating to find problems for
 * @param {number} count - Number of problems needed
 * @returns {Promise<{rating: number, problems: Array}>} The closest rating and its problems
 */
const findClosestAvailableRating = async (targetRating, count) => {
    try {
        console.log(`Finding closest available rating to ${targetRating} with at least ${count} problems`);
        
        // Get all ratings defined in the system
        const ratings = RATING_CATEGORIES;
        
        // Sort ratings by distance from target rating
        const sortedRatings = [...ratings].sort((a, b) => {
            return Math.abs(a - targetRating) - Math.abs(b - targetRating);
        });
        
        console.log(`Sorted ratings by distance from ${targetRating}:`, sortedRatings);
        
        // Try each rating in order of closest to farthest
        for (const rating of sortedRatings) {
            if (rating === targetRating) continue; // Skip the target rating, we already tried it
            
            // Reset the rating first to ensure all problems are available
            await globalProblemSetService.resetProblemUsedFlagByRating(rating);
            
            // Try to find problems with this rating
            const problems = await globalProblemSetService.findUnusedProblemsByRating(rating, count);
            
            if (problems.length >= count) {
                console.log(`Found ${problems.length} problems with rating ${rating} as a fallback for ${targetRating}`);
                return {
                    rating,
                    problems
                };
            }
            
            console.log(`Rating ${rating} only has ${problems.length} problems, need ${count}`);
        }
        
        // If we get here, we couldn't find any rating with enough problems
        console.log(`Could not find any rating with ${count} unused problems`);
        return {
            rating: null,
            problems: []
        };
    } catch (error) {
        console.error(`Error finding closest available rating:`, error);
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
        const currentMonth = today.getMonth(); // Month is 0-indexed in JS Date (0-11)
        const currentYear = today.getFullYear();
        
        console.log(`Running filtered problem set generation for date: ${today.toISOString().split('T')[0]}`);
        
        // Stats for response
        let stats = {
            date: today.toISOString().split('T')[0],
            month: currentMonth + 1, // Convert to 1-indexed for display (1-12)
            year: currentYear,
            newProblemsAdded: 0,
            noAvailableProblems: [],
            resetRatings: [],
            fallbackRatings: [],
            errors: []
        };
        
        // Check if we already have a problem set for this month and year
        let filteredProblemSet = await findFilteredProblemSet(currentMonth, currentYear);
      
        // If it's the first day of the month or we don't have a problem set for this month, create a new one
        if (currentDay === 1 || !filteredProblemSet) {
            console.log(`Creating or clearing filtered problem set for ${currentMonth + 1}/${currentYear}.`);
            
            // If it exists, clear it (first day of month)
            if (filteredProblemSet && currentDay === 1) {
                await clearFilteredProblemSet(currentMonth, currentYear);
            }
            
            // Create a new one
            filteredProblemSet = await createFilteredProblemSet(currentMonth, currentYear);
        }
        console.log("filteredProblemSet", filteredProblemSet);
        // shuffle(filteredProblemSet);
        console.log("filteredProblemSetshuffled", filteredProblemSet);
        
        // For each rating category, add problems for days that need to be populated
        await populateProblemSet(filteredProblemSet, currentDay, stats);
        
        // Now also check if we need to create a problem set for next month if we're near the end of the month
        // This ensures users have problems available for the next month as soon as it starts
        if (currentDay >= 28) {
            const nextMonth = (currentMonth + 1) % 12; // Wrap around to 0 (January) after 11 (December)
            const nextYear = nextMonth === 0 ? currentYear + 1 : currentYear; // If next month is January, increment year
            
            console.log(`Near end of month, checking if we need to create problem set for ${nextMonth + 1}/${nextYear}.`);
            
            // Check if we already have a problem set for next month and year
            let nextMonthProblemSet = await findFilteredProblemSet(nextMonth, nextYear);
            
            if (!nextMonthProblemSet) {
                console.log(`Creating filtered problem set for upcoming month ${nextMonth + 1}/${nextYear}.`);
                nextMonthProblemSet = await createFilteredProblemSet(nextMonth, nextYear);
                
                stats.nextMonthPrepared = {
                    month: nextMonth + 1,
                    year: nextYear
                };
                
                // Calculate days to populate for next month - let's pre-populate some days
                const daysToPrePopulate = 7; // Pre-populate first week of the month
                
                // Create a separate stats object for next month population
                const nextMonthStats = {
                    newProblemsAdded: 0,
                    noAvailableProblems: [],
                    resetRatings: [],
                    fallbackRatings: [],
                    errors: []
                };
                
                // Populate the next month's problem set for the first week
                console.log(`Pre-populating ${daysToPrePopulate} days for next month ${nextMonth + 1}/${nextYear}`);
                await populateProblemSet(nextMonthProblemSet, daysToPrePopulate, nextMonthStats);
                
                // Add next month stats to the main stats
                stats.nextMonthStats = nextMonthStats;
                stats.newProblemsAdded += nextMonthStats.newProblemsAdded;
            }
        }
        
        return stats;
    } catch (error) {
        throw error;
    }
};

/**
 * Helper function to populate a problem set for specified days
 * @param {Object} problemSet - The problem set document to populate
 * @param {number} upToDay - Populate problems up to this day
 * @param {Object} stats - Stats object to update
 * @returns {Promise<void>}
 */
const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
        }
    return array;
}

const populateProblemSet = async (problemSet, upToDay, stats) => {
    // For each rating category, add problems for days that need to be populated
    for (const rating of RATING_CATEGORIES) {
        try {
            // Get the problems map for this rating or create a new one
            let problemsForRating = problemSet.problems.get(rating.toString()) || [];
          //  console.log("Problems for rating", rating, problemsForRating);
           // problemsForRating =  shuffle(problemsForRating);
            // Find the last day that has been populated for this rating
            let lastPopulatedDay = 0;
            
            if (problemsForRating.length > 0) {
                // Find the maximum day in the existing problems
                lastPopulatedDay = Math.max(...problemsForRating.map(p => p.day));
            }
            
            // Days that need to be populated (from last populated day + 1 to upToDay)
            const daysToPopulate = [];
            for (let day = lastPopulatedDay + 1; day <= upToDay; day++) {
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
                
                // If still not enough problems, try fallback to closest rating
                if (availableProblems.length < daysToPopulate.length) {
                    console.log(`Still not enough problems for rating ${rating} after reset. Available: ${availableProblems.length}, Needed: ${daysToPopulate.length}`);
                    
                    // Try to find a fallback rating with enough problems
                    const fallback = await findClosestAvailableRating(rating, daysToPopulate.length);
                    
                    if (fallback.rating && fallback.problems.length >= daysToPopulate.length) {
                        console.log(`Using fallback rating ${fallback.rating} for rating ${rating}`);
                        availableProblems = fallback.problems;
                        stats.fallbackRatings.push({
                            originalRating: rating,
                            fallbackRating: fallback.rating,
                            problemsFound: fallback.problems.length
                        });
                    } else {
                        // If still not enough problems, log the issue and continue to next rating
                        stats.noAvailableProblems.push({
                            rating,
                            available: availableProblems.length,
                            needed: daysToPopulate.length
                        });
                        continue;
                    }
                }
            }
            
            // Assign problems to days and mark them as used
            for (let i = 0; i < daysToPopulate.length; i++) {
                if (i >= availableProblems.length) break; // Safety check
                
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
            problemSet.problems.set(rating.toString(), problemsForRating);
            
        } catch (error) {
            console.error(`Error processing rating ${rating}:`, error);
            stats.errors.push({
                rating,
                error: error.message
            });
        }
    }
    
    // Save the updated filtered problem set
    await problemSet.save();
};

/**
 * Get all problems for a specific month, year and rating
 * @param {number} month - Month (1-12 as received from client)
 * @param {number} year - Year
 * @param {number} rating - Problem rating (optional)
 * @returns {Promise<Object>} Object with problems organized by rating
 */
const getMonthlyProblems = async (month, year, rating = null) => {
    try {
        // Convert month from 1-12 (client format) to 0-11 (JS Date format)
        const jsMonth = month - 1;
        
        // But we store as 1-12 in the database, so use the original month parameter
        const filteredProblemSet = await FilteredProblemSet.findOne({ month, year });
        
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