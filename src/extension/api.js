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
      
      const response = await this.fetchWithRetry(`${window.config.current.API_URL}/users`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userID: handle,
          last_streak_count: streakCount,
          updateDate: updateDate
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
      
      return userData;
    } catch (error) {
      window.errorHandler.logError('updateUserStreak', error);
      throw error;
    }
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
   * Get monthly problems for a specific rating
   * @param {number} month - Month (1-12)
   * @param {number} year - Year
   * @param {number} rating - Problem rating
   * @returns {Promise<Array>} Array of problems for the month
   */
  async getMonthlyProblems(month, year, rating) {
    try {
      const offset = 200;
      rating = ((rating / 100) * 100) + 100 + offset; 
      const url = `${window.config.current.API_URL}/problemset/monthly?month=${month}&year=${year}&rating=${rating}`;
      console.log("Fetching monthly problems from:", url);
      
      const response = await this.fetchWithRetry(url, { method: 'GET' });
      console.log("API getMonthlyProblems response:", response);
      
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
      const test_mode = false; // WARNING: Set to true for testing
      // Fetch recent submissions from Codeforces API
      
      const url = test_mode? `http://localhost:4000/test/submissions`:`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=10`;      

      console.log("Fetching submissions from:", url);
      
      const response = await this.fetchWithRetry(url, { method: 'GET' });
      
      if (response.status !== "OK") {
        throw new Error(`Codeforces API error: ${response.comment || 'Unknown error'}`);
      }
      
      // Check if any submission matches today's problem and is accepted
      if (response.result && response.result.length > 0) {
        for (const submission of response.result) {
          const isCorrectProblem = 
            problem && 
            submission.problem.contestId === problem.problem.contestId &&
            submission.problem.index === problem.problem.index;
          
          const isAccepted = submission.verdict === "OK";
          
          if (isCorrectProblem && isAccepted) {
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