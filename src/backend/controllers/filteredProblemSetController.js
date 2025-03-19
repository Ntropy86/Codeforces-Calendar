const filteredProblemSetService = require('../services/filteredProblemSetService');

/**
 * Generate filtered problem sets for each rating
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const generateFilteredProblemSets = async (req, res) => {
    try {
        console.log("Generating filtered problem sets...");
        
        const stats = await filteredProblemSetService.generateFilteredProblemSets();
        
        res.status(200).json({
            "message": "Filtered problem set updated successfully",
            stats
        });
    } catch (err) {
        console.error("Error in generateFilteredProblemSets:", err);
        res.status(500).json({
            "message": err.message || "Internal server error"
        });
    }
};

/**
 * Get problems for a specific month, year and optionally rating
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getMonthlyProblems = async (req, res) => {
    try {
        // Get month, year, and rating from query parameters
        const date = new Date();
        const month = req.query.month !== undefined ? parseInt(req.query.month) : date.getMonth();
        const year = parseInt(req.query.year) || date.getFullYear();
        const rating = req.query.rating ? parseInt(req.query.rating) : null;
        
        console.log(`Fetching monthly problems for ${month}/${year}${rating ? ` with rating ${rating}` : ''}`);
        
        const monthlyProblems = await filteredProblemSetService.getMonthlyProblems(month, year, rating);
        
        if (monthlyProblems.status === "not_found") {
            return res.status(404).json({
                "message": monthlyProblems.message
            });
        }
        
        res.status(200).json({
            "message": "Monthly problems retrieved successfully",
            "data": monthlyProblems
        });
    } catch (err) {
        console.error("Error in getMonthlyProblems:", err);
        res.status(500).json({
            "message": err.message || "Internal server error"
        });
    }
};

module.exports = {
    generateFilteredProblemSets,
    getMonthlyProblems
};