// Environment configuration
window.config = {
  development: {
    API_URL: 'https://cf-backend-922736494190.asia-south2.run.app'
  },
  production: {
    API_URL: 'xyz'
  }
};


//window.config.current = window.config.production;
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

// Update window.dateUtils to handle timezone properly using UTC
window.dateUtils = {
  getTodayISO() {
    // Get current date in UTC
    const now = new Date();
    // Format to YYYY-MM-DD in UTC timezone
    return this.formatDateToUTCISO(now);
  },
  
  getYesterdayISO() {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1); // Use UTC date
    return this.formatDateToUTCISO(yesterday);
  },
  
  // Helper to format a date to ISO string in UTC timezone (YYYY-MM-DD)
  formatDateToUTCISO(date) {
    const year = date.getUTCFullYear();
    // Add 1 to month since getMonth() is 0-indexed
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  
  // Keep original local timezone method for legacy code that might need it
  formatDateToISO(date) {
    const year = date.getFullYear();
    // Add 1 to month since getMonth() is 0-indexed
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  
  getCurrentMonthAndYear() {
    // Use UTC for consistency across timezones
    const today = new Date();
    return {
      month: today.getUTCMonth() + 1, // 1-indexed month
      year: today.getUTCFullYear()
    };
  },
  
  // Move the debug function into dateUtils to avoid global scope pollution
  logDateDebugInfo() {
    const now = new Date();
    const localDate = now.toLocaleDateString();
    const isoDate = now.toISOString();
    const utcDate = now.toUTCString();
    const todayISOFromUtils = this.getTodayISO();
    const yesterdayISO = this.getYesterdayISO();
    
    console.log("===== DATE DEBUG INFO =====");
    console.log("Local Date:", localDate);
    console.log("ISO Date:", isoDate);
    console.log("UTC Date:", utcDate);
    console.log("Today ISO (UTC method):", todayISOFromUtils);
    console.log("Yesterday ISO (UTC method):", yesterdayISO);
    console.log("============================");
    
    return todayISOFromUtils;
  }
};