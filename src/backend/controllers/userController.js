const userService = require('../services/userService');
const mongoose = require("mongoose");
const Models = require("../models/models");
const User = mongoose.model("User", Models.userSchema);

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

        console.log("[createUser] Received userID:", userID);

        // Single entry point for login/signup.
        // Always syncs rating with Codeforces API as source of truth.
        const user = await userService.getOrCreateUser(userID);

        console.log("[createUser] User synced:", {
            userID: user.userID,
            rating: user.rating
        });

        res.status(200).json({ "message": user });
    } catch (err) {
        console.error("[createUser] Error:", err);
        const statusCode = err.statusCode || 500;
        res.status(statusCode).json({
            "message": err.message || "Internal server error"
        });
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
        const updateDate = req.body.updateDate === true; // Explicit boolean check
        
        if (!userID) {
            return res.status(400).json("UserID is required");
        }
        
        if (lastStreakCount === undefined) {
            return res.status(400).json("last_streak_count is required");
        }
        
        const updatedUser = await userService.updateUserStreak(userID, lastStreakCount, updateDate);
        console.log("User Streak Updated", updatedUser);
        
        res.status(200).json({ "message": updatedUser });
    } catch (err) {
        console.error("Error in updateUserStreak:", err);
        res.status(500).json({ "message": err.message || "Internal server error" });
    }
};

/**
 * Update a specific day in user's streak
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const updateUserStreakDay = async (req, res) => {
    try {
        const userID = req.body.userID;
        const day = req.body.day;
        const solved = req.body.solved !== false; // Default to true if not specified
        
        if (!userID) {
            return res.status(400).json("UserID is required");
        }
        
        if (!day) {
            return res.status(400).json("Day is required");
        }
        
        const updatedUser = await userService.updateUserStreakDay(userID, day, solved);
        console.log("User Streak Day Updated", updatedUser);
        
        res.status(200).json({ "message": updatedUser });
    } catch (err) {
        console.error("Error in updateUserStreakDay:", err);
        res.status(500).json({ "message": err.message || "Internal server error" });
    }
};

/**
 * Reset all streak days for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const resetUserStreakDays = async (req, res) => {
    try {
        const userID = req.body.userID;
        
        if (!userID) {
            return res.status(400).json("UserID is required");
        }
        
        const updatedUser = await userService.resetUserStreakDays(userID);
        console.log("User Streak Days Reset", updatedUser);
        
        res.status(200).json({ "message": updatedUser });
    } catch (err) {
        console.error("Error in resetUserStreakDays:", err);
        res.status(500).json({ "message": err.message || "Internal server error" });
    }
};

/**
 * Clean up old streak days for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const cleanupOldStreakDays = async (req, res) => {
    try {
        const userID = req.body.userID;
        
        if (!userID) {
            return res.status(400).json("UserID is required");
        }
        
        const updatedUser = await userService.cleanupOldStreakDays(userID);
        console.log("Old Streak Days Cleaned Up", updatedUser);
        
        res.status(200).json({ 
            "message": "Old streak days cleaned up successfully",
            "user": updatedUser
        });
    } catch (err) {
        console.error("Error in cleanupOldStreakDays:", err);
        res.status(500).json({ "message": err.message || "Internal server error" });
    }
};

/**
 * Update only the last_streak_date for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const updateUserStreakDate = async (req, res) => {
    try {
        const userID = req.body.userID;
        const lastStreakDate = req.body.last_streak_date;
        
        if (!userID) {
            return res.status(400).json("UserID is required");
        }
        
        if (!lastStreakDate) {
            return res.status(400).json("last_streak_date is required");
        }
        
        // Update only the last_streak_date field
        const updatedUser = await User.findOneAndUpdate(
            { userID: userID },
            { $set: { "streak.last_streak_date": new Date(lastStreakDate) } },
            { new: true }
        );
        
        if(updatedUser === null) {
            throw new Error("User not found");
        }
        
        console.log("User Streak Date Updated", updatedUser);
        
        res.status(200).json({ "message": updatedUser });
    } catch (err) {
        console.error("Error in updateUserStreakDate:", err);
        res.status(500).json({ "message": err.message || "Internal server error" });
    }
};

/**
 * Refresh user rating from Codeforces API
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const refreshUserRating = async (req, res) => {
    try {
        const userID = req.body.userID;
        
        if (!userID) {
            return res.status(400).json("UserID is required");
        }
        
        const updatedUser = await userService.refreshUserRating(userID);
        console.log("User Rating Refreshed", updatedUser);
        
        res.status(200).json({ "message": updatedUser });
    } catch (err) {
        console.error("Error in refreshUserRating:", err);
        res.status(500).json({ "message": err.message || "Internal server error" });
    }
};

module.exports = {
    getUser,
    createUser,
    updateUserStreak,
    updateUserStreakDay,
    resetUserStreakDays,
    cleanupOldStreakDays,
    updateUserStreakDate,
    refreshUserRating
};