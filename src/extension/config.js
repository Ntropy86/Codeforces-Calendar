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

// Update window.dateUtils to handle timezone properly
window.dateUtils = {
  getTodayISO() {
    // Get current date in user's local timezone
    const now = new Date();
    // Format to YYYY-MM-DD in local timezone
    return this.formatDateToISO(now);
  },
  
  getYesterdayISO() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return this.formatDateToISO(yesterday);
  },
  
  // Helper to format a date to ISO string in local timezone (YYYY-MM-DD)
  formatDateToISO(date) {
    const year = date.getFullYear();
    // Add 1 to month since getMonth() is 0-indexed
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  
  getCurrentMonthAndYear() {
    const today = new Date();
    return {
      month: today.getMonth() + 1, // 1-indexed month
      year: today.getFullYear()
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
    console.log("Today ISO (our method):", todayISOFromUtils);
    console.log("Yesterday ISO (our method):", yesterdayISO);
    console.log("============================");
    
    return todayISOFromUtils;
  }
};
