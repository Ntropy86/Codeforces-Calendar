const userService = require('../services/userService');

/**
 * Get user by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getUser = async (req, res) => {
    try {
        const userID = req.body.UserID || req.body.userID;
        
        if (!userID) {
            return res.status(400).json("UserID is required");
        }
        
        const user = await userService.findUserByID(userID);
        
        if (user.length === 0) {
            return res.status(404).json("User not found");
        }
        
        res.status(200).json({ "message": user });
    } catch (err) {
        console.error("Error in getUser:", err);
        res.status(500).json({ "message": err.message || "Internal server error" });
    }
};

/**
 * Create a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const createUser = async (req, res) => {
    try {
        const userID = req.body.userID;
        
        if (!userID) {
            return res.status(400).json("UserID is required");
        }
        
        console.log("User ID:", userID, req.body);
        
        try {
            const user = await userService.findUserByID(userID);
            
            if (user.length !== 0) {
                console.log("User already exists", user);
                return res.status(403).json({ "message": "User already exists", user });
            }
            
            const newUser = await userService.createUser(userID);
            console.log("New User is created", newUser);
            
            res.status(200).json({ "message": newUser });
        } catch (error) {
            if (error.message === "User already exists") {
                return res.status(403).json({ "message": error.message });
            }
            throw error;
        }
    } catch (err) {
        console.error("Error in createUser:", err);
        res.status(500).json({ "message": err.message || "Internal server error" });
    }
};

/**
 * Update user streak
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const updateUserStreak = async (req, res) => {
    try {
        const userID = req.body.userID;
        const lastStreakCount = req.body.last_streak_count;
        
        if (!userID) {
            return res.status(400).json("UserID is required");
        }
        
        if (lastStreakCount === undefined) {
            return res.status(400).json("last_streak_count is required");
        }
        
        const updatedUser = await userService.updateUserStreak(userID, lastStreakCount);
        console.log("User Streak Updated", updatedUser);
        
        res.status(200).json({ "message": updatedUser });
    } catch (err) {
        console.error("Error in updateUserStreak:", err);
        res.status(500).json({ "message": err.message || "Internal server error" });
    }
};

module.exports = {
    getUser,
    createUser,
    updateUserStreak
};