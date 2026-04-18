/**
 * SetupForm Component
 * Handles first-time user setup inline in the calendar space
 */

class SetupForm {
  constructor() {
    this.container = null;
  }

  /**
   * Render the setup form
   * @returns {HTMLElement} - The setup form container
   */
  render() {
    const form = document.createElement('div');
    form.className = 'cf-potd-setup-form';
    form.innerHTML = `
      <div class="setup-header">
        <h2>🎯 Welcome to Codeforces POTD!</h2>
        <p>Track your daily problem-solving streak</p>
      </div>
      
      <div class="setup-content">
        <div class="input-group">
          <label for="setup-username">Codeforces Handle</label>
          <input 
            id="setup-username" 
            type="text" 
            placeholder="Enter your handle (e.g., tourist)"
            autocomplete="off"
          >
          <span class="input-hint">We'll fetch your rating and track your progress</span>
        </div>
        
        <button id="setup-submit-btn" class="btn-primary">
          <span class="btn-text">Get Started</span>
          <span class="btn-loader" style="display: none;">
            <span class="spinner"></span> Setting up...
          </span>
        </button>
        
        <div id="setup-message" class="setup-message"></div>
      </div>
      
      <div class="setup-footer">
        <p class="footer-text">Your calendar will appear here once setup is complete</p>
      </div>
    `;
    
    this.container = form;
    this.attachEventListeners();
    return form;
  }

  /**
   * Attach event listeners to the form
   */
  attachEventListeners() {
    const submitBtn = this.container.querySelector('#setup-submit-btn');
    const usernameInput = this.container.querySelector('#setup-username');
    
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.handleSubmit());
    }
    
    // Allow Enter key to submit
    if (usernameInput) {
      usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleSubmit();
        }
      });
      
      // Auto-focus on username input
      setTimeout(() => usernameInput.focus(), 100);
    }
  }

  /**
   * Handle form submission
   */
  async handleSubmit() {
    const usernameInput = this.container.querySelector('#setup-username');
    const handle = usernameInput ? usernameInput.value.trim() : '';
    
    if (!handle) {
      this.showMessage('Please enter your Codeforces handle', 'error');
      return;
    }
    
    // Validate handle format (basic check)
    if (!/^[a-zA-Z0-9_-]+$/.test(handle)) {
      this.showMessage('Invalid handle format. Use only letters, numbers, _ and -', 'error');
      return;
    }
    
    this.showLoading(true);
    this.showMessage('Connecting to backend...', 'info');
    
    try {
      // Store the handle locally
      await window.storage.set(window.storageKeys.USER_DATA, { username: handle });
      
      // Run the setup sequence (from popup.js)
      await this.runSetupSequence(handle);
      
      this.showMessage('✅ Setup complete! Loading your calendar...', 'success');
      
      // Trigger calendar creation immediately
      this.onSetupComplete();
      
    } catch (err) {
      window.errorHandler.logError('SetupForm_handleSubmit', err);
      this.showMessage(err.message || 'Failed to setup. Please try again.', 'error');
      this.showLoading(false);
    }
  }

  /**
   * Run the setup sequence (migrated from popup.js sequence function)
   */
  async runSetupSequence(handle) {
    try {
      // Get or create user from backend
      this.showMessage('Fetching user information...', 'info');
      let userData = await window.api.getOrCreateUser(handle);
      
      // Store the complete user data from DB in userInfo
      await window.storage.set(window.storageKeys.USER_INFO, [userData]);
      
      // Store just the username for quick reference
      await window.storage.set(window.storageKeys.USER_DATA, { username: handle });
      
      // Check whether userData is an object or array
      if (Array.isArray(userData)) {
        userData = userData[0];
      }
      
      console.log('[SetupForm] User data from backend:', userData);
      
      // Get user rating
      let userRating = userData.rating || 600;
      console.log('[SetupForm] User rating:', userRating);
      
      // Get current date for month and year
      const { month: currentMonth, year: currentYear } = window.dateUtils.getCurrentMonthAndYear();
      
      // Get problems for current month and user's rating
      this.showMessage('Fetching monthly problems...', 'info');
      console.log(`[SetupForm] Fetching monthly problems for month=${currentMonth}, year=${currentYear}, rating=${userRating}`);
      
      const problemsData = await window.api.getMonthlyProblems(currentMonth, currentYear, userRating);
      console.log('[SetupForm] Monthly problems retrieved:', problemsData);
      
      // Format problems for local storage and calendar
      const formattedProblems = this.formatProblems(problemsData, currentMonth, currentYear, userRating);
      console.log('[SetupForm] Formatted problems:', formattedProblems);
      
      // Store formatted problems
      await window.storage.set(window.storageKeys.PROBLEM_DATA, formattedProblems);
      console.log('[SetupForm] Problem data stored in local storage');
      
      // Check if streak should be reset
      await window.streak.checkAndResetStreakIfNeeded(handle);
      
      return true;
    } catch (err) {
      window.errorHandler.logError('SetupForm_runSetupSequence', err);
      throw err;
    }
  }

  /**
   * Format problems for storage (migrated from popup.js)
   */
  formatProblems(problemsData, currentMonth, currentYear, userRating) {
    let formattedProblems = [];
    
    // Handle different API response formats
    
    // Format 1: Direct array of problems
    if (problemsData && Array.isArray(problemsData)) {
      formattedProblems = problemsData.map(problem => {
        const date = new Date(Date.UTC(currentYear, currentMonth - 1, problem.day));
        return {
          date: date.toISOString(),
          problem: this.extractProblemIdParts(problem.problemID) || {
            contestId: parseInt(problem.problemID),
            index: "A"
          },
          url: problem.problemURL
        };
      });
    }
    // Format 2: Problems in a ratings structure
    else if (problemsData && problemsData.ratings && problemsData.ratings[userRating]) {
      const problems = problemsData.ratings[userRating];
      Object.entries(problems).forEach(([day, problem]) => {
        const date = new Date(Date.UTC(currentYear, currentMonth - 1, parseInt(day)));
        formattedProblems.push({
          date: date.toISOString(),
          problem: this.extractProblemIdParts(problem.problemID) || {
            contestId: parseInt(problem.problemID),
            index: "A"
          },
          url: problem.problemURL
        });
      });
    }
    // Format 3: Problems inside nested data property
    else if (problemsData && problemsData.problems && Array.isArray(problemsData.problems)) {
      formattedProblems = problemsData.problems.map(problem => {
        const date = new Date(Date.UTC(currentYear, currentMonth - 1, problem.day));
        return {
          date: date.toISOString(),
          problem: this.extractProblemIdParts(problem.problemID) || {
            contestId: parseInt(problem.problemID),
            index: "A"
          },
          url: problem.problemURL
        };
      });
    }
    // Format 4: Data wrapper with nested formats
    else if (problemsData && problemsData.data) {
      if (Array.isArray(problemsData.data)) {
        formattedProblems = problemsData.data.map(problem => {
          const date = new Date(Date.UTC(currentYear, currentMonth - 1, problem.day));
          return {
            date: date.toISOString(),
            problem: this.extractProblemIdParts(problem.problemID) || {
              contestId: parseInt(problem.problemID),
              index: "A"
            },
            url: problem.problemURL
          };
        });
      }
      else if (problemsData.data.problems && Array.isArray(problemsData.data.problems)) {
        formattedProblems = problemsData.data.problems.map(problem => {
          const date = new Date(Date.UTC(currentYear, currentMonth - 1, problem.day));
          return {
            date: date.toISOString(),
            problem: this.extractProblemIdParts(problem.problemID) || {
              contestId: parseInt(problem.problemID),
              index: "A"
            },
            url: problem.problemURL
          };
        });
      }
      else if (problemsData.data.ratings && problemsData.data.ratings[userRating]) {
        const problems = problemsData.data.ratings[userRating];
        Object.entries(problems).forEach(([day, problem]) => {
          const date = new Date(Date.UTC(currentYear, currentMonth - 1, parseInt(day)));
          formattedProblems.push({
            date: date.toISOString(),
            problem: this.extractProblemIdParts(problem.problemID) || {
              contestId: parseInt(problem.problemID),
              index: "A"
            },
            url: problem.problemURL
          });
        });
      }
    }
    
    return formattedProblems;
  }

  /**
   * Extract problem ID components
   */
  extractProblemIdParts(problemId) {
    const match = problemId.match(/(\d+)([A-Z]\d*)/);
    if (match) {
      return {
        contestId: parseInt(match[1]),
        index: match[2]
      };
    }
    return null;
  }

  /**
   * Show loading state
   */
  showLoading(isLoading) {
    const btn = this.container.querySelector('#setup-submit-btn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    const input = this.container.querySelector('#setup-username');
    
    if (isLoading) {
      btnText.style.display = 'none';
      btnLoader.style.display = 'inline-flex';
      btn.disabled = true;
      input.disabled = true;
    } else {
      btnText.style.display = 'inline';
      btnLoader.style.display = 'none';
      btn.disabled = false;
      input.disabled = false;
    }
  }

  /**
   * Show message to user
   */
  showMessage(message, type = 'info') {
    const messageEl = this.container.querySelector('#setup-message');
    if (messageEl) {
      messageEl.textContent = message;
      messageEl.className = `setup-message setup-message-${type}`;
      messageEl.style.display = 'block';
    }
  }

  /**
   * Callback when setup is complete
   * Override this in the parent component
   */
  onSetupComplete() {
    console.log('[SetupForm] Setup complete, triggering calendar load');
    // This will be overridden to trigger calendar creation
    if (window.createCalendar) {
      window.createCalendar();
    }
  }

  /**
   * Destroy the form
   */
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

// Export for use in content.js
window.SetupForm = SetupForm;

