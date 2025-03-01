const mongoose = require("mongoose");
const Models = require("../models/models");
const User = new mongoose.model("User", Models.userSchema);

/**
 * Find user by ID
 * @param {string} userID - The user ID to search for
 * @returns {Promise} - Promise resolving to user object or null
 */
const findUserByID = async (userID) => {
    try {
        const user = await User.find({ userID: userID });
        return user;
    } catch (error) {
        throw error;
    }
};

/**
 * Create a new user
 * @param {string} userID - The Codeforces user handle
 * @returns {Promise} - Promise resolving to newly created user
 */
const createUser = async (userID) => {
    try {
        // Check if user already exists
        const existingUser = await User.find({ userID: userID });
        if (existingUser.length !== 0) {
            throw new Error("User already exists");
        }

        // Fetch user data from Codeforces API
        const CF_User_API_URL = `https://codeforces.com/api/user.info?handles=${userID}`;
        const response = await fetch(CF_User_API_URL);
        const data = await response.json();
        
        if (data.status !== "OK") {
            throw new Error("Failed to fetch user data from Codeforces API");
        }
        
        const user = data.result[0];
        const userHandle = user.handle;
        const userRating = user.rating;

        // Create streak_days with all days of the current month set to false
        const streak_days = {};
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1; // 1-indexed month
        const daysInMonth = new Date(year, month, 0).getDate();
        
        // Populate all days in the current month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayKey = `${year}-${month}-${day}`;
            streak_days[dayKey] = false;
        }

        // Create new user
        const newUser = new User({
            userID: userHandle,
            rating: userRating,
            streak: {
                last_streak_date: null,
                last_streak_count: 0,
                streak_days: streak_days
            },
        });

        // Save the user to database
        return await newUser.save();
    } catch (error) {
        throw error;
    }
};

/**
 * Update a specific day's streak status
 * @param {string} userID - The user ID
 * @param {number} day - The day of the month
 * @param {boolean} solved - Whether the day is solved
 * @returns {Promise} - Promise resolving to updated user
 */
const updateUserStreakDay = async (userID, day, solved = true) => {
    try {
        const date = new Date();
        const monthDay = day || date.getDate();
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        const dayKey = `${monthKey}-${monthDay}`;
        
        // Use dot notation for the update to set a specific day in the Map
        const updateQuery = {};
        updateQuery[`streak.streak_days.${dayKey}`] = solved;
        
        const updatedUser = await User.findOneAndUpdate(
            { userID: userID },
            { $set: updateQuery },
            { new: true }
        );
        
        if(updatedUser === null) {
            throw new Error("User not found");
        }
        
        return updatedUser;
    } catch (error) {
        throw error;
    }
};

/**
 * Reset all streak days for the current month
 * @param {string} userID - The user ID
 * @returns {Promise} - Promise resolving to updated user
 */
const resetUserStreakDays = async (userID) => {
    try {
        const date = new Date();
        const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        
        // Create an update query to clear all days
        const updateQuery = {};
        for (let i = 1; i <= daysInMonth; i++) {
            const dayKey = `${monthKey}-${i}`;
            updateQuery[`streak.streak_days.${dayKey}`] = false;
        }
        
        const updatedUser = await User.findOneAndUpdate(
            { userID: userID },
            { $set: updateQuery },
            { new: true }
        );
        
        if(updatedUser === null) {
            throw new Error("User not found");
        }
        
        return updatedUser;
    } catch (error) {
        throw error;
    }
};

/**
 * Update user streak
 * @param {string} userID - The user ID
 * @param {number} lastStreakCount - The current streak count
 * @param {boolean} updateDate - Whether to update the last_streak_date (default: false)
 * @returns {Promise} - Promise resolving to updated user
 */
const updateUserStreak = async (userID, lastStreakCount, updateDate = false) => {
    try {
        const streak_count = parseInt(lastStreakCount);
        
        // Get existing user to decide what to update
        const existingUser = await User.findOne({ userID: userID });
        if (!existingUser) {
            throw new Error("User not found");
        }
        
        // Determine what fields to update
        const updateFields = {};
        
        // Always update streak count
        updateFields["streak.last_streak_count"] = streak_count;
        
        // Only update the date if explicitly requested or if streak > 0 is being set
        if (updateDate || (streak_count > 0 && existingUser.streak.last_streak_count != streak_count)) {
            updateFields["streak.last_streak_date"] = new Date();
        }
        
        // Is this a streak reset to 0?
        const isReset = streak_count === 0;
        
        // For continuing streak or if we're validating a new solve, mark today as solved
        if (!isReset || updateDate) {
            // Mark today as solved
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth() + 1;
            const day = today.getDate();
            const dayKey = `${year}-${month}-${day}`;
            
            updateFields[`streak.streak_days.${dayKey}`] = true;
        }
        
        // Update the user with all field changes - DON'T RESET STREAK DAYS
        const updatedUser = await User.findOneAndUpdate(
            { userID: userID },
            { $set: updateFields },
            { new: true }
        );
        
        if(updatedUser === null) {
            throw new Error("User not found");
        }
        
        return updatedUser;
    } catch (error) {
        throw error;
    }
};

/**
 * Clean up old streak days (older than 3 months)
 * @param {string} userID - The user ID
 * @returns {Promise} - Promise resolving to updated user
 */
const cleanupOldStreakDays = async (userID) => {
    try {
        // Get the user to access their streak days
        const user = await User.findOne({ userID: userID });
        if (!user || !user.streak || !user.streak.streak_days) {
            throw new Error("User or streak days not found");
        }
        
        // Calculate the date 3 months ago
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        // Helper to convert streak day key to date
        const dateFromKey = (key) => {
            const [year, month, day] = key.split('-').map(num => parseInt(num));
            return new Date(year, month - 1, day); // month is 0-indexed in Date
        };
        
        const streakDays = user.streak.streak_days;
        const updateFields = {};
        let removedCount = 0;
        
        // Find and remove old days
        for (const dayKey in streakDays) {
            const date = dateFromKey(dayKey);
            if (date < threeMonthsAgo) {
                updateFields[`streak.streak_days.${dayKey}`] = undefined; // MongoDB $unset equivalent
                removedCount++;
            }
        }
        
        // Only update if there are days to remove
        if (removedCount > 0) {
            console.log(`Cleaning up ${removedCount} old streak days for user ${userID}`);
            
            // Update the user to remove old days
            const updatedUser = await User.findOneAndUpdate(
                { userID: userID },
                { $unset: updateFields },
                { new: true }
            );
            
            return updatedUser;
        }
        
        return user; // No changes needed
    } catch (error) {
        console.error("Error cleaning up old streak days:", error);
        throw error;
    }
};

/**
 * Update user based on the attribute sent in the request body
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const updateUser = async (req, res) => {
    try {
        const userID = req.body.userID;
        const update = req.body.update;

        if (!userID) {
            return res.status(400).json("UserID is required");
        }

        if (!update) {
            return res.status(400).json("Update is required");
        }

        const updatedUser = await User.findOneAndUpdate(
            { userID: userID },
            { 
                $set: update
            },
            { new: true }
        );

        if(updatedUser === null) {
            return res.status(404).json("User not found");
        }

        res.status(200).json({
            "message": "User updated successfully",
            "user": updatedUser
        });
    } catch (err) {
        console.error("Error in updateUser:", err);
        res.status(500).json({
            "message": err.message || "Internal server error"
        });
    }
};

module.exports = {
    findUserByID,
    createUser,
    updateUserStreak,
    updateUserStreakDay,
    resetUserStreakDays,
    cleanupOldStreakDays
};