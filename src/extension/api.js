/**
 * API service to interact with the backend
 */
window.api = {
    /**
     * Create or get user information
     * @param {string} handle - Codeforces handle
     * @returns {Promise<Object>} User information
     */
    async getOrCreateUser(handle) {
      try {
        const response = await fetch(`${window.config.current.API_URL}/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userID: handle })
        });
  
        const data = await response.json();
        console.log("API getOrCreateUser response:", data);
        
        // If 200, return the user directly
        if (response.status === 200 && data.message) {
          return data.message;
        }
        
        // If 403 (user exists), the user data might be in a different format
        if (response.status === 403) {
          // Check different possible locations of the user data
          if (data.user) return data.user;
          if (data.message && Array.isArray(data.message) && data.message.length > 0) return data.message[0];
          if (data.message && typeof data.message === 'object') return data.message;
        }
        
        throw new Error(`Failed to create/get user: ${JSON.stringify(data)}`);
      } catch (error) {
        console.error('Error in getOrCreateUser:', error);
        throw error;
      }
    },
  
    /**
     * Update user streak
     * @param {string} handle - Codeforces handle
     * @param {number} lastStreakCount - Current streak count
     * @returns {Promise<Object>} Updated user information
     */
    async updateUserStreak(handle, lastStreakCount) {
      try {
        console.log(`Updating streak for ${handle} to ${lastStreakCount}`);
        
        const response = await fetch(`${window.config.current.API_URL}/users`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userID: handle,
            last_streak_count: lastStreakCount
          })
        });
  
        const data = await response.json();
        console.log("API updateUserStreak response:", data);
        
        if (response.status === 200) {
          return data.message;
        }
        
        throw new Error(`Failed to update streak: ${JSON.stringify(data)}`);
      } catch (error) {
        console.error('Error in updateUserStreak:', error);
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
        const url = `${window.config.current.API_URL}/problemset/monthly?month=${month}&year=${year}&rating=${rating}`;
        console.log("Fetching monthly problems from:", url);
        
        const response = await fetch(url, { method: 'GET' });
        const data = await response.json();
        console.log("API getMonthlyProblems response:", data);
        
        if (response.status === 200) {
          return data.data;
        }
        
        throw new Error(`Failed to get monthly problems: ${JSON.stringify(data)}`);
      } catch (error) {
        console.error('Error in getMonthlyProblems:', error);
        throw error;
      }
    }
  };