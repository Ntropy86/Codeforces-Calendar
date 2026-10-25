/**
 * API service to interact with the backend
 */
window.api = {
  /**
   * Enhanced fetch with retry logic
   * @param {string} url - API URL
   * @param {Object} options - Fetch options
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} delay - Delay between retries in ms
   * @returns {Promise<Object>} Response data
   */
  async fetchWithRetry(url, options, maxRetries = 3, delay = 2000) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`API attempt ${attempt + 1} for ${url}`);
        const response = await fetch(url, options);
        
        // Handle non-2xx responses
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(`HTTP error ${response.status}: ${errorData ? JSON.stringify(errorData) : response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.warn(`Attempt ${attempt + 1} failed:`, error);
        lastError = error;
        
        // Wait before retrying
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  },

  /**
   * Create or get user information
   * @param {string} handle - Codeforces handle
   * @returns {Promise<Object>} User information
   */
  async getOrCreateUser(handle) {
    try {
      const response = await this.fetchWithRetry(`${window.config.current.API_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userID: handle })
      });
      
      console.log("API getOrCreateUser response:", response);
      
      // Extract the actual user data, not just messages
      let userData = null;
      
      if (response.message && typeof response.message === 'object') {
        // If message contains user data
        userData = response.message;
      } else if (response.user) {
        // If user data is in user property
        userData = response.user;
      } else if (response.message && Array.isArray(response.message) && response.message.length > 0) {
        userData = response.message[0];
      }
      
      if (!userData) {
        throw new Error("Failed to extract user data from response");
      }
      
      console.log("Extracted user data:", userData);
      return userData;
    } catch (error) {
      window.errorHandler.logError('getOrCreateUser', error);
      throw error;
    }
  },

  /**
   * Update user streak
   * @param {string} handle - Codeforces handle
   * @param {number} streakCount - Current streak count
   * @param {boolean} updateDate - Whether to update the streak date
   * @returns {Promise<Object>} Updated user information
   */
  async updateUserStreak(handle, streakCount, updateDate = false) {
    try {
      console.log(`Updating streak for ${handle} to ${streakCount} (updateDate: ${updateDate})`);

      // Remember which days were solved before, see ensureLocalStreakDay
      const previousStreakDays = updateDate ? await window.streak.getStreakDays() : {};

      const response = await this.fetchWithRetry(`${window.config.current.API_URL}/users`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userID: handle,
          last_streak_count: streakCount,
          updateDate: updateDate,
          date: window.dateUtils.getTodayKey() // Mark the user's local day
        })
      });

      console.log("API updateUserStreak response:", response);

      let userData = null;

      if (response.message && typeof response.message === 'object') {
        userData = response.message;
      } else if (response.user) {
        userData = response.user;
      }

      if (!userData) {
        throw new Error("Failed to extract updated user data from response");
      }

      if (updateDate) {
        userData = await this.ensureLocalStreakDay(handle, userData, previousStreakDays);
      }

      return userData;
    } catch (error) {
      window.errorHandler.logError('updateUserStreak', error);
      throw error;
    }
  },

  /**
   * A backend without timezone support ignores `date` and marks its own UTC day,
   * which for users far from UTC can be the local tomorrow or yesterday.
   * In that case mark the local day and unmark the UTC day, unless it was already solved.
   * @param {string} handle - Codeforces handle
   * @param {Object} userData - User returned by the streak update
   * @param {Object} previousStreakDays - streak_days before the update
   * @returns {Promise<Object>} Updated user information
   */
  async ensureLocalStreakDay(handle, userData, previousStreakDays) {
    const localKey = window.dateUtils.getTodayKey();
    const streakDays = (userData.streak && userData.streak.streak_days) || {};

    if (streakDays[localKey] === true) {
      return userData;
    }

    console.log(`Backend did not mark local day ${localKey}, marking it explicitly`);
    let updatedUser = await this.updateStreakDay(handle, localKey, true);

    const utcKey = window.dateUtils.getUTCTodayKey();
    if (utcKey !== localKey && previousStreakDays[utcKey] !== true) {
      updatedUser = await this.updateStreakDay(handle, utcKey, false);
    }

    return updatedUser;
  },

  /**
   * Mark a single streak day as solved or unsolved
   * @param {string} handle - Codeforces handle
   * @param {string} dateKey - Day to update (YYYY-M-D)
   * @param {boolean} solved - Whether the day is solved
   * @returns {Promise<Object>} Updated user information
   */
  async updateStreakDay(handle, dateKey, solved) {
    const response = await this.fetchWithRetry(`${window.config.current.API_URL}/users/streak-day`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userID: handle,
        day: parseInt(dateKey.split('-')[2]), // Used by backends without timezone support
        date: dateKey,
        solved: solved
      })
    });

    if (!response.message || typeof response.message !== 'object') {
      throw new Error(`Failed to update streak day: ${JSON.stringify(response)}`);
    }

    return response.message;
  },

  /**
   * Clean up old streak days
   * @param {string} handle - Codeforces handle
   * @returns {Promise<Object>} Updated user information
   */
  async cleanupOldStreakDays(handle) {
    try {
      console.log(`Cleaning up old streak days for ${handle}`);
      
      const response = await this.fetchWithRetry(`${window.config.current.API_URL}/users/cleanup-streak-days`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userID: handle
        })
      });
      
      console.log("API cleanupOldStreakDays response:", response);
      
      let userData = null;
      
      if (response.message && typeof response.message === 'object') {
        userData = response.message;
      } else if (response.user) {
        userData = response.user;
      }
      
      if (!userData) {
        throw new Error("Failed to extract updated user data from response");
      }
      
      return userData;
    } catch (error) {
      window.errorHandler.logError('cleanupOldStreakDays', error);
      throw error;
    }
  },

  /**
   * Snap a rating to the closest category the backend generates problems for
   * (mirrors RATING_CATEGORIES in filteredProblemSetService.js). Without this,
   * ratings like 900 or 1100 return an empty problem list. Ties go to the lower one.
   * @param {number} rating - Desired problem rating
   * @returns {number} Closest available rating category
   */
  closestRatingCategory(rating) {
    const categories = [
      600, 800, 1000, 1200, 1300, 1400, 1500, 1600,
      1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400,
      2500, 2600, 2700, 2800, 2900, 3000, 3100, 3200, 3300, 3400, 3500
    ];
    return categories.reduce((best, category) =>
      Math.abs(category - rating) < Math.abs(best - rating) ? category : best
    );
  },

  /**
   * Whether the problems of the current local month lack today's problem
   * @param {Object} data - Monthly problems returned by the backend
   * @param {number} month - Month (1-12)
   * @param {number} year - Year
   * @returns {boolean} True if today's problem has not been generated yet
   */
  isMissingTodaysProblem(data, month, year) {
    const { month: currentMonth, year: currentYear } = window.dateUtils.getCurrentMonthAndYear();
    if (!data || !Array.isArray(data.problems) || month !== currentMonth || year !== currentYear) {
      return false;
    }
    const today = window.dateUtils.now().getUTCDate();
    return !data.problems.some(problem => problem.day === today);
  },

  /**
   * Ask the backend to generate the problems up to its current UTC day.
   * Backends without on-demand generation only create them when their cron runs.
   * Skipped on the 1st (UTC), when those backends clear and rebuild the month.
   * @returns {Promise<void>}
   */
  async requestProblemGeneration() {
    if (new Date().getUTCDate() === 1) {
      return;
    }
    try {
      console.log("Today's problem is missing, requesting generation");
      await this.fetchWithRetry(`${window.config.current.API_URL}/problemset/filtered`, { method: 'POST' }, 1);
    } catch (error) {
      window.errorHandler.logError('requestProblemGeneration', error);
    }
  },

  /**
   * Get monthly problems for a specific rating
   * @param {number} month - Month (1-12)
   * @param {number} year - Year
   * @param {number} rating - Problem rating
   * @returns {Promise<Array>} Array of problems for the month
   */
  async getMonthlyProblems(month, year, rating) {
    try {
      const offset = 200;
      rating = this.closestRatingCategory(Math.ceil(rating / 100) * 100 + offset);
      console.log('Rating:', rating);
      const url = `${window.config.current.API_URL}/problemset/monthly?month=${month}&year=${year}&rating=${rating}`;
      console.log("Fetching monthly problems from api.js :", url);
      
      let response = await this.fetchWithRetry(url, { method: 'GET' });
      console.log("API getMonthlyProblems response: api.js", response);

      if (this.isMissingTodaysProblem(response.data, month, year)) {
        await this.requestProblemGeneration();
        response = await this.fetchWithRetry(url, { method: 'GET' });
      }

      if (response.data) {
        return response.data;
      }
      
      throw new Error(`Failed to get monthly problems: ${JSON.stringify(response)}`);
    } catch (error) {
      window.errorHandler.logError('getMonthlyProblems', error);
      throw error;
    }
  },
  
  /**
   * Verify user submissions for today's problem
   * @param {string} handle - Codeforces handle
   * @param {Object} problem - Problem details
   * @returns {Promise<Object>} Verification result
   */
  async verifySubmission(handle, problem) {
    try {
      const test_mode =false ; // WARNING: Set to true for testing

      // Fetch recent submissions from Codeforces API
      const url = test_mode? `${window.config.current.API_URL}/test/submissions`:`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=10`;      

      console.log("Fetching submissions from:", url);
      
      const response = await this.fetchWithRetry(url, { method: 'GET' });
      
      if (response.status !== "OK") {
        throw new Error(`Codeforces API error: ${response.comment || 'Unknown error'}`);
      }

      // console.log('API VERIFY SUBMISSIONS RESPONSE:', response.result ,response.result.length);
      
      // Check if any submission matches today's problem and is accepted
      if (response.result && response.result.length > 0) {
        for (const submission of response.result) {
          
          const isCorrectProblem = 
            problem && 
            submission.problem.contestId === problem.problem.contestId &&
            submission.problem.index === problem.problem.index;
          
          const isAccepted = submission.verdict === "OK";
          
          if (isCorrectProblem && isAccepted) {
          console.log('API VERIFY SUBMISSIONS:', submission.problem.contestId, submission.problem.index, submission.verdict);
          console.log('API VERIFY PROBLEMS:', problem.problem.contestId, problem.problem.index);
            return {
              verified: true,
              submission: submission
            };
          }
        }
      }
      
      return {
        verified: false,
        message: "No accepted submission found for today's problem"
      };
    } catch (error) {
      window.errorHandler.logError('verifySubmission', error);
      return {
        verified: false,
        error: error.message
      };
    }
  },

  /**
 * Update only the last_streak_date in the database
 * @param {string} handle - Codeforces handle
 * @param {string} dateString - ISO date string to set as last_streak_date
 * @returns {Promise<Object>} Updated user information
 */
async updateLastStreakDate(handle, dateString) {
  try {
    console.log(`Updating last_streak_date for ${handle} to ${dateString}`);
    
    const response = await this.fetchWithRetry(`${window.config.current.API_URL}/users/streak-date`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userID: handle,
        last_streak_date: dateString
      })
    });
    
    console.log("API updateLastStreakDate response:", response);
    
    let userData = null;
    
    if (response.message && typeof response.message === 'object') {
      userData = response.message;
    } else if (response.user) {
      userData = response.user;
    }
    
    if (!userData) {
      throw new Error("Failed to extract updated user data from response");
    }
    
    return userData;
  } catch (error) {
    window.errorHandler.logError('updateLastStreakDate', error);
    throw error;
  }
}
};