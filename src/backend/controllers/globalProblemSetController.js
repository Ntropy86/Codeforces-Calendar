const globalProblemSetService = require('../services/globalProblemSetService');

/**
 * Update the global problem set with new problems from Codeforces
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const updateGlobalProblemSet = async (req, res) => {
    try {
        console.log("Updating global problem set...");
        
        const stats = await globalProblemSetService.updateGlobalProblemSet();
        
        res.status(200).json({
            "message": "Problem set update completed",
            stats
        });
    } catch (err) {
        console.error("Error in updateGlobalProblemSet:", err);
        res.status(500).json({ 
            "message": err.message || "Internal server error" 
        });
    }
};

module.exports = {
    updateGlobalProblemSet
};