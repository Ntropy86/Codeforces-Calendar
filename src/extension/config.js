// Environment configuration
window.config = {
  development: {
    API_URL: 'http://localhost:4000'
  },
  production: {
    API_URL: 'https://api.yourdomain.com'
  }
};

// Select environment based on build flag
// Change this to 'production' for production builds
window.config.current = window.config.development;

// Standard storage keys
window.storageKeys = {
  USER_DATA: "userData",
  USER_INFO: "userInfo",
  PROBLEM_DATA: "problemData",
  LAST_SOLVED_DATE: "lastSolvedDate"
};

// Standardized error handling
window.errorHandler = {
  logError(context, error) {
    console.error(`[${context}] Error:`, error);
    return error;
  },
  
  displayError(message, element) {
    if (element) {
      element.textContent = message;
      element.className = "status-message error-message";
    }
    console.error(message);
  }
};

// Helper functions for working with dates
window.dateUtils = {
  getTodayISO() {
    return new Date().toISOString().split('T')[0];
  },
  
  getYesterdayISO() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  },
  
  getCurrentMonthAndYear() {
    const today = new Date();
    return {
      month: today.getMonth() + 1, // 1-indexed month
      year: today.getFullYear()
    };
  }
};