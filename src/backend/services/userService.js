// These are the methods that need to be updated in userService.js
// Replace the existing implementations with these UTC-based versions

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
        // Using UTC dates for consistency across timezones
        const streak_days = {};
        const today = new Date();
        const year = today.getUTCFullYear(); // Use UTC year
        const month = today.getUTCMonth() + 1; // Use UTC month (1-indexed)
        const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
        
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

const updateUserStreakDay = async (userID, day, solved = true) => {
    try {
        const date = new Date();
        const monthDay = day || date.getUTCDate();  // Use UTC date
        const monthKey = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;  // Use UTC
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

const resetUserStreakDays = async (userID) => {
    try {
        const date = new Date();
        const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
        const monthKey = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
        
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
            // Mark today as solved using UTC date
            const today = new Date();
            const year = today.getUTCFullYear();
            const month = today.getUTCMonth() + 1;
            const day = today.getUTCDate();
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

const cleanupOldStreakDays = async (userID) => {
    try {
        // Get the user to access their streak days
        const user = await User.findOne({ userID: userID });
        if (!user || !user.streak || !user.streak.streak_days) {
            throw new Error("User or streak days not found");
        }
        
        // Calculate the date 3 months ago using UTC
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setUTCMonth(threeMonthsAgo.getUTCMonth() - 3);
        
        // Helper to convert streak day key to date
        const dateFromKey = (key) => {
            const [year, month, day] = key.split('-').map(num => parseInt(num));
            const date = new Date(Date.UTC(year, month - 1, day)); // month is 0-indexed in Date
            return date;
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