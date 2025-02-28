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

        // Create new user
        const newUser = new User({
            userID: userHandle,
            rating: userRating,
            streak: {
                last_streak_date: null,
                last_streak_count: 0,
            },
        });

        // Save the user to database
        return await newUser.save();
    } catch (error) {
        throw error;
    }
};

/**
 * Update user streak
 * @param {string} userID - The user ID
 * @param {number} lastStreakCount - The current streak count
 * @returns {Promise} - Promise resolving to updated user
 */
const updateUserStreak = async (userID, lastStreakCount) => {
    try {
        const date = new Date();
        const streak_count = parseInt(lastStreakCount) + 1;
        
        const updatedUser = await User.findOneAndUpdate(
            { userID: userID },
            { 
                $set: { 
                    streak: {
                        last_streak_date: date,
                        last_streak_count: streak_count,
                    },
                } 
            },
            { new: true }
        );

        if(updatedUser === null) {
            throw new Error("User not found");
        }
        else if(updatedUser.streak.last_streak_count !== streak_count) {
            throw new Error("Failed to update user streak");
        }

        return updatedUser;
    } catch (error) {
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
    updateUserStreak
};