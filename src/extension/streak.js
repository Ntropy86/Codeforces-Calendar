/**
 * Streak management functionality
 */
window.streak = {
 /**
 * Calculate the current streak dynamically from streak_days
 * @returns {Promise<number>} Current streak count
 */
async getCurrentStreak() {
  try {
    // Get streak days map
    const streakDays = await this.getStreakDays();
    console.log("Streak days in getCurrentStreak:", streakDays);
    
    if (!streakDays || Object.keys(streakDays).length === 0) {
      console.log("No streak days found in getCurrentStreak");
      return 0;
    }
    
    // Get today's date in local timezone
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Extract relevant date parts to create keys
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    
    // Create today's key in format that matches the database
    const todayKey = `${currentYear}-${currentMonth}-${currentDay}`;
    
    // Log all the keys to help debug
    const allKeys = Object.keys(streakDays);
    console.log("All streak day keys:", allKeys);
    console.log("Today's key we're looking for:", todayKey);
    
    // Check if today is solved (either format)
    const isTodaySolved = streakDays[todayKey] === true;
    
    if (!isTodaySolved) {
      console.log("Today not solved, checking yesterday and previous days");
      
      // Create yesterday's date in local timezone
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayYear = yesterday.getFullYear();
      const yesterdayMonth = yesterday.getMonth() + 1;
      const yesterdayDay = yesterday.getDate();
      const yesterdayKey = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`;
      
      console.log("Yesterday's key:", yesterdayKey);
      
      // Check if yesterday is solved
      const isYesterdaySolved = streakDays[yesterdayKey] === true;
      
      if (!isYesterdaySolved) {
        console.log("Neither today nor yesterday were solved, returning streak of 0");
        return 0;
      }
      
      // If yesterday was solved but today wasn't, count back from yesterday
      let currentDate = new Date(yesterday);
      let streakCount = 0;
      
      // Count consecutive days backward from yesterday
      while (true) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const day = currentDate.getDate();
        const dateKey = `${year}-${month}-${day}`;
        
        console.log("Checking date:", dateKey);
        
        // Check if this day is solved
        if (streakDays[dateKey] === true) {
          streakCount++;
          
          // Move to previous day
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break; // Break on first unsolved day
        }
      }
      
      console.log("Streak count calculated from yesterday:", streakCount);
      return streakCount;
    } else {
      // Today is solved, count from today
      let currentDate = new Date(today);
      let streakCount = 0;
      
      // Count consecutive days backward from today
      while (true) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const day = currentDate.getDate();
        const dateKey = `${year}-${month}-${day}`;
        
        console.log("Checking date:", dateKey);
        
        // Check if this day is solved
        if (streakDays[dateKey] === true) {
          streakCount++;
          
          // Move to previous day
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break; // Break on first unsolved day
        }
      }
      
      console.log("Streak count calculated from today:", streakCount);
      return streakCount;
    }
  } catch (error) {
    console.error("Error calculating streak:", error);
    return 0;
  }
},

/**
 * Get dates to mark as solved based on streak_days
 * @returns {Promise<Array<string>>} Array of ISO date strings to mark as solved
 */
async getDatesToMarkSolved() {
  try {
    // Get the streak days map
    const streakDays = await this.getStreakDays();
    console.log("Streak days map in getDatesToMarkSolved:", streakDays);
    
    if (!streakDays || Object.keys(streakDays).length === 0) {
      console.log("No streak days found in getDatesToMarkSolved");
      return [];
    }
    
    // Get all solved days
    const dates = [];
    for (const [key, value] of Object.entries(streakDays)) {
      // Only include days that are marked as solved (true)
      if (value === true) {
        let date;
        
        // Handle various date formats
        if (key.split('-').length === 3) {
          try {
            // Parse the key into a date
            const [year, month, day] = key.split('-').map(part => parseInt(part));
            date = new Date(year, month - 1, day); // month is 0-indexed in JS Date
            
            if (!isNaN(date.getTime())) {
              // Format date to ISO string in local timezone (YYYY-MM-DD)
              const formattedDate = window.dateUtils.formatDateToISO(date);
              dates.push(formattedDate);
            }
          } catch (e) {
            console.error("Error parsing date:", key, e);
          }
        }
      }
    }
    
    console.log("Dates to mark based on streak days:", dates);
    return dates;
  } catch (error) {
    console.error("Error getting dates to mark:", error);
    return [];
  }
},
  
  /**
 * Get the streak_days map from userInfo
 * @returns {Promise<Object>} Map of days to boolean solved status
 */
async getStreakDays() {
  try {
    const userInfo = await window.storage.get(window.storageKeys.USER_INFO);
    console.log("Raw userInfo in getStreakDays:", userInfo);
    
    if (!userInfo || !Array.isArray(userInfo) || !userInfo[0]) {
      console.log("No userInfo found in getStreakDays");
      return {};
    }
    
    // Handle the case where userInfo[0] is an array or not
    let user;
    if (Array.isArray(userInfo[0])) {
      if (userInfo[0].length === 0) {
        console.log("Empty userInfo array in getStreakDays");
        return {};
      }
      user = userInfo[0][0];
    } else {
      user = userInfo[0];
    }
    
    console.log("User in getStreakDays:", user);
    
    if (!user || !user.streak || !user.streak.streak_days) {
      console.log("No streak days found in user object");
      return {};
    }
    
    console.log("Found streak days:", user.streak.streak_days);
    return user.streak.streak_days;
  } catch (error) {
    console.error("Error getting streak days:", error);
    return {};
  }
},
  
  /**
 * Helper function to convert a date to a streak key format
 * @param {Date} date - The date object
 * @returns {string} Date key in format YYYY-MM-DD
 */
keyFromDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed
  const day = date.getDate();
  return `${year}-${month}-${day}`;
},

/**
 * Helper function to convert a streak key to a Date object
 * @param {string} key - The date key in YYYY-MM-DD format
 * @returns {Date} Date object
 */
dateFromKey(key) {
  const [year, month, day] = key.split('-').map(num => parseInt(num));
  // Create date in local timezone
  return new Date(year, month - 1, day); // month is 0-indexed in Date
},
  
  /**
   * Get the last streak date from userInfo
   * @returns {Promise<string|null>} Last streak date in ISO format or null
   */
  async getLastStreakDate() {
    try {
      // Get streak days to find the most recent solved day
      const streakDays = await this.getStreakDays();
      
      if (!streakDays || Object.keys(streakDays).length === 0) {
        return null;
      }
      
      // Find all solved days
      const solvedDays = Object.entries(streakDays)
        .filter(([dayKey, solved]) => solved === true)
        .map(([dayKey]) => dayKey);
      
      if (solvedDays.length === 0) {
        return null;
      }
      
      // Sort by date (descending)
      solvedDays.sort().reverse();
      
      // Get the most recent date
      const mostRecentDay = solvedDays[0];
      const mostRecentDate = this.dateFromKey(mostRecentDay);
      
      return mostRecentDate.toISOString().split('T')[0];
    } catch (error) {
      console.error("Error getting last streak date:", error);
      return null;
    }
  },
  
  /**
   * Clean up old streak days (older than 3 months)
   * @param {string} userHandle - User handle
   * @returns {Promise<boolean>} Success status
   */
  async cleanupOldStreakDays(userHandle) {
    try {
      const streakDays = await this.getStreakDays();
      
      if (!streakDays || Object.keys(streakDays).length === 0) {
        return true; // Nothing to clean
      }
      
      // Calculate the date 3 months ago
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      // Find days to remove (older than 3 months)
      const daysToRemove = Object.keys(streakDays).filter(dayKey => {
        const date = this.dateFromKey(dayKey);
        return date < threeMonthsAgo;
      });
      
      if (daysToRemove.length === 0) {
        return true; // Nothing to clean
      }
      
      console.log(`Cleaning up ${daysToRemove.length} old streak days`);
      
      // Call backend to remove old days
      // In a real implementation, you would call an API endpoint,
      // but for now we'll just simulate it
      
      // Remove the days from the local copy
      daysToRemove.forEach(day => {
        delete streakDays[day];
      });
      
      // For now, let's update the streak days directly in the userInfo
      const userInfo = await window.storage.get(window.storageKeys.USER_INFO);
      
      if (!userInfo || !Array.isArray(userInfo) || !userInfo[0] || !userInfo[0][0]) {
        return false;
      }
      
      userInfo[0][0].streak.streak_days = streakDays;
      await window.storage.set(window.storageKeys.USER_INFO, userInfo);
      
      return true;
    } catch (error) {
      console.error("Error cleaning up old streak days:", error);
      return false;
    }
  },
  
  /**
 * Should the streak be reset?
 * @returns {Promise<boolean>} True if streak should be reset
 */
async shouldResetStreak() {
  try {
    // Get the last streak date - ONLY FOR THE STREAK COUNTER, not clearing history
    const lastStreakDate = await this.getLastStreakDate();
    
    if (!lastStreakDate) {
      return false; // No streak to reset
    }
    
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDay = today.getDate();
    
    // Parse the last streak date
    const lastStreakDateObj = new Date(lastStreakDate);
    
    // Reset if it's the first day of the month (but only if previous streak was from last month)
    if (todayDay === 1 && lastStreakDateObj.getMonth() !== today.getMonth()) {
      console.log("Reset streak COUNTER: First day of month with streak from previous month");
      return true;
    }
    
    // Calculate days difference properly
    lastStreakDateObj.setHours(0, 0, 0, 0);
    
    // Date difference in milliseconds
    const diffTime = today.getTime() - lastStreakDateObj.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    console.log(`Days since last streak update: ${diffDays} (${lastStreakDateObj.toISOString()} to ${today.toISOString()})`);
    
    // Reset if more than 1 day has passed
    if (diffDays > 1) {
      console.log(`Reset streak COUNTER: ${diffDays} days since last streak update`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Error checking if streak should reset:", error);
    return false;
  }
},
  
  /**
   * Reset the streak to zero
   * @param {string} userHandle - User handle
   * @returns {Promise<Object>} Reset result
   */
  async resetStreak(userHandle) {
    try {
      console.log("Resetting streak for user:", userHandle);
      
      // Clean up old streak days
      await this.cleanupOldStreakDays(userHandle);
      
      // Update backend with reset streak (0)
      const updatedUser = await window.api.updateUserStreak(userHandle, 0);
      console.log("Streak reset in backend:", updatedUser);
      
      // Update userInfo in local storage with fresh data from backend
      await window.storage.set(window.storageKeys.USER_INFO, [updatedUser]);
      
      // Trigger calendar refresh
      if (typeof window.refreshCalendar === 'function') {
        window.refreshCalendar();
      }
      
      return {
        success: true,
        streakReset: true,
        newStreak: 0
      };
    } catch (error) {
      window.errorHandler.logError('resetStreak', error);
      return {
        success: false,
        reason: "error",
        error: error.message
      };
    }
  },
  
  /**
 * Validate and update streak
 * @param {string} userHandle - User handle
 * @param {Object} todaysProblem - Today's problem details
 * @returns {Promise<Object>} Result of streak update
 */
async validateAndUpdateStreak(userHandle, todaysProblem) {
  try {
    const today = window.dateUtils.getTodayISO();
    
    // Check if streak should be reset - THIS ONLY AFFECTS THE COUNTER, NOT THE HISTORY
    const shouldReset = await this.shouldResetStreak();
    
    // Verify submission with Codeforces API
    const verificationResult = await window.api.verifySubmission(userHandle, todaysProblem);
    
    if (!verificationResult.verified) {
      console.log("Submission not verified:", verificationResult.message);
      return { 
        success: false, 
        reason: "not_verified",
        details: verificationResult
      };
    }
    
    // Clean up old streak days
    await this.cleanupOldStreakDays(userHandle);
    
    // Calculate new streak value based on whether we should reset the counter
    let newStreak;
    if (shouldReset) {
      // For a reset, start at 1 (today's solve)
      newStreak = 1;
      console.log("Resetting streak counter due to gap in solving");
    } else {
      // Otherwise increment
      const currentStreak = await this.getCurrentStreak();
      newStreak = currentStreak + 1;
    }
    
    // We always want to update the date for a successful validation
    const updateDate = true;
    
    // Update backend with new streak count and mark today as solved
    const updatedUser = await window.api.updateUserStreak(userHandle, newStreak, updateDate);
    console.log("Updated user from backend:", updatedUser);
    
    // Update userInfo in local storage with fresh data from backend
    await window.storage.set(window.storageKeys.USER_INFO, [updatedUser]);
    
    // Mark today as solved
    await window.storage.set(window.storageKeys.LAST_SOLVED_DATE, today);
    
    // Trigger calendar refresh
    if (typeof window.refreshCalendar === 'function') {
      window.refreshCalendar();
    }

    await this.syncStreakDaysWithDatabase(userHandle);
    
    return { 
      success: true, 
      newStreak: newStreak,
      previousStreak: shouldReset ? 0 : newStreak - 1,
      wasReset: shouldReset
    };
  } catch (error) {
    window.errorHandler.logError('validateAndUpdateStreak', error);
    return { 
      success: false, 
      reason: "error",
      error: error.message
    };
  }
},
  
  /**
   * Check streak status and reset if needed
   * @param {string} userHandle - User handle
   * @returns {Promise<Object>} Check result
   */
  async checkAndResetStreakIfNeeded(userHandle) {
    try {
      if (!userHandle) {
        return {
          success: false,
          reason: "missing_handle"
        };
      }
      
      const shouldReset = await this.shouldResetStreak();
      
      if (shouldReset) {
        console.log("Auto-resetting streak due to gap in solving");
        return await this.resetStreak(userHandle);
      }
      
      // Clean up old streak days periodically
      const today = new Date();
      if (today.getDate() === 1) {
        // On the first day of the month, clean up old streak days
        await this.cleanupOldStreakDays(userHandle);
      }
      
      return {
        success: true,
        streakMaintained: true,
        currentStreak: await this.getCurrentStreak()
      };
    } catch (error) {
      window.errorHandler.logError('checkAndResetStreakIfNeeded', error);
      return {
        success: false,
        reason: "error",
        error: error.message
      };
    }
  },

/**
 * Synchronize streak_days with last_streak_date in the database
 * @param {string} userHandle - The user's handle
 * @returns {Promise<boolean>} Success status
 */
async syncStreakDaysWithDatabase(userHandle) {
  try {
    console.log("Syncing streak_days with database for:", userHandle);
    
    // Get streak days
    const streakDays = await this.getStreakDays();
    console.log("Streak days for sync:", streakDays);
    
    if (!streakDays || Object.keys(streakDays).length === 0) {
      console.log("No streak days found for sync");
      return false;
    }
    
    // Get the current last_streak_date from userInfo
    const userInfo = await window.storage.get(window.storageKeys.USER_INFO);
    let currentLastStreakDate = null;
    
    if (userInfo && Array.isArray(userInfo) && userInfo.length > 0) {
      if (Array.isArray(userInfo[0]) && userInfo[0].length > 0) {
        if (userInfo[0][0].streak && userInfo[0][0].streak.last_streak_date) {
          currentLastStreakDate = new Date(userInfo[0][0].streak.last_streak_date);
          console.log("Current last_streak_date:", currentLastStreakDate.toISOString());
        }
      } else if (userInfo[0] && userInfo[0].streak && userInfo[0].streak.last_streak_date) {
        currentLastStreakDate = new Date(userInfo[0].streak.last_streak_date);
        console.log("Current last_streak_date:", currentLastStreakDate.toISOString());
      }
    }
    
    // If we have a current last_streak_date, check if that day is marked as false
    if (currentLastStreakDate) {
      const currentDateKey = this.keyFromDate(currentLastStreakDate);
      console.log("Current date key:", currentDateKey);
      
      // If the current last_streak_date is marked as false, we need to update it
      if (streakDays[currentDateKey] === false) {
        console.log("Current last_streak_date is marked as false, finding new most recent solved day");
        
        // Find the most recent solved day that's marked as true
        const solvedDays = Object.entries(streakDays)
          .filter(([key, value]) => value === true)
          .map(([key]) => {
            const date = this.dateFromKey(key);
            return { key, date };
          })
          .sort((a, b) => b.date - a.date); // Sort descending by date
        
        console.log("Solved days found:", solvedDays);
        
        if (solvedDays.length > 0) {
          const mostRecentSolvedDay = solvedDays[0];
          console.log("Most recent solved day:", mostRecentSolvedDay.key, mostRecentSolvedDay.date.toISOString());
          
          // Update last_streak_date in the database
          try {
            const updatedUser = await window.api.updateLastStreakDate(
              userHandle,
              mostRecentSolvedDay.date.toISOString()
            );
            
            console.log("Database last_streak_date updated:", updatedUser);
            
            // Update userInfo in local storage
            await window.storage.set(window.storageKeys.USER_INFO, [updatedUser]);
            
            return true;
          } catch (error) {
            console.error("Error updating last_streak_date:", error);
            return false;
          }
        } else {
          console.log("No solved days found, can't update last_streak_date");
          return false;
        }
      } else {
        console.log("Current last_streak_date is already marked as true, no update needed");
        return true;
      }
    } else {
      console.log("No current last_streak_date found");
      
      // If we don't have a current last_streak_date, find the most recent solved day
      const solvedDays = Object.entries(streakDays)
        .filter(([key, value]) => value === true)
        .map(([key]) => {
          const date = this.dateFromKey(key);
          return { key, date };
        })
        .sort((a, b) => b.date - a.date); // Sort descending by date
      
      if (solvedDays.length > 0) {
        const mostRecentSolvedDay = solvedDays[0];
        console.log("Most recent solved day:", mostRecentSolvedDay.key, mostRecentSolvedDay.date.toISOString());
        
        // Update last_streak_date in the database
        try {
          const updatedUser = await window.api.updateLastStreakDate(
            userHandle,
            mostRecentSolvedDay.date.toISOString()
          );
          
          console.log("Database last_streak_date updated:", updatedUser);
          
          // Update userInfo in local storage
          await window.storage.set(window.storageKeys.USER_INFO, [updatedUser]);
          
          return true;
        } catch (error) {
          console.error("Error updating last_streak_date:", error);
          return false;
        }
      } else {
        console.log("No solved days found, can't update last_streak_date");
        return false;
      }
    }
  } catch (error) {
    console.error("Error syncing streak with database:", error);
    return false;
  }
}
};

