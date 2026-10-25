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

// Dates follow the user's local timezone: the day changes at the user's midnight.
// now() returns a Date whose UTC getters read the local wall clock, so the rest of
// the code can keep using getUTC*/setUTC* and Date.UTC consistently.
window.dateUtils = {
  now() {
    return this.toLocal(new Date());
  },

  // Shift a real timestamp (e.g. one stored by the backend) into local wall-clock time
  toLocal(date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  },

  // Real timestamp at local noon of a YYYY-M-D key, safe to store in the backend
  // and read back with toLocal() as the same calendar day
  timestampFromKey(key) {
    const [year, month, day] = key.split('-').map(num => parseInt(num));
    return new Date(year, month - 1, day, 12);
  },

  // Today's streak key in local time (YYYY-M-D, no padding)
  getTodayKey() {
    const now = this.now();
    return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  },

  // Today's streak key in UTC, the day a backend without timezone support marks
  getUTCTodayKey() {
    const now = new Date();
    return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  },

  getTodayISO() {
    // Format to YYYY-MM-DD in local timezone
    return this.formatDateToUTCISO(this.now());
  },

  getYesterdayISO() {
    const yesterday = this.now();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
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
    // Month and year of the user's local date
    const today = this.now();
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
    console.log("Today ISO (local timezone):", todayISOFromUtils);
    console.log("Yesterday ISO (local timezone):", yesterdayISO);
    console.log("============================");
    
    return todayISOFromUtils;
  }
};