// These are the methods that need to be updated in filteredProblemSetService.js
// Replace the existing implementations with these UTC-based versions

const generateFilteredProblemSets = async () => {
    try {
        // Use UTC for consistent date handling across timezones
        const today = new Date();
        const currentDay = today.getUTCDate();  // Use UTC date
        const currentMonth = today.getUTCMonth();  // Month is 0-indexed in JS Date (0-11)
        const currentYear = today.getUTCFullYear();  // Use UTC year
        
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

// Helper function to populate a problem set for specified days
// This function doesn't need to be changed much, but ensure the date creation is UTC-based
const populateProblemSet = async (problemSet, upToDay, stats) => {
    // For each rating category, add problems for days that need to be populated
    for (const rating of RATING_CATEGORIES) {
        try {
            // Get the problems map for this rating or create a new one
            let problemsForRating = problemSet.problems.get(rating.toString()) || [];
            
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

// Update getMonthlyProblems to use UTC date handling
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