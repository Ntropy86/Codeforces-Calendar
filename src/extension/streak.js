/**
 * Streak management functionality
 */
window.streak = {
    /**
     * Get current streak directly from userInfo object
     * @returns {Promise<number>} Current streak count
     */
    async getCurrentStreak() {
      try {
        // Get user info from storage - this comes directly from the database
        const userInfo = await window.storage.get(window.storageKeys.USER_INFO);
        console.log("Raw userInfo in getCurrentStreak:", userInfo);
        
        let streakCount = 0;
        
        // Extract streak directly from userInfo array
        if (userInfo && Array.isArray(userInfo) && userInfo.length > 0) {
          const user = userInfo[0];
          
          // Check if streak object exists and has last_streak_count
          if (user && user.streak && user.streak.last_streak_count !== undefined) {
            if (typeof user.streak.last_streak_count === 'number') {
              streakCount = user.streak.last_streak_count;
            } else {
              streakCount = parseInt(user.streak.last_streak_count);
            }
            console.log("Found streak in userInfo:", streakCount);
          }
        }
        
        return streakCount;
      } catch (error) {
        console.error("Error getting streak:", error);
        return 0;
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
        
        // Get current streak directly from backend data
        const currentStreak = await this.getCurrentStreak();
        console.log("Current streak before update:", currentStreak);
        
        // Calculate new streak (simply increment)
        const newStreak = currentStreak + 1;
        
        // Update backend with new streak
        const updatedUser = await window.api.updateUserStreak(userHandle, newStreak);
        console.log("Updated user from backend:", updatedUser);
        
        // Update userInfo in local storage with fresh data from backend
        await window.storage.set(window.storageKeys.USER_INFO, [updatedUser]);
        
        // Mark today as solved
        await window.storage.set(window.storageKeys.LAST_SOLVED_DATE, today);
        
        return { 
          success: true, 
          newStreak: newStreak,
          previousStreak: currentStreak
        };
      } catch (error) {
        window.errorHandler.logError('validateAndUpdateStreak', error);
        return { 
          success: false, 
          reason: "error",
          error: error.message
        };
      }
    }
  };