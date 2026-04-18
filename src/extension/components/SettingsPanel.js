/**
 * SettingsPanel Component
 * Handles settings and user management
 */

class SettingsPanel {
  constructor(userData) {
    this.userData = userData;
    this.container = null;
    this.isOpen = false;
  }

  /**
   * Render the settings panel
   * @returns {HTMLElement} - The settings panel container
   */
  render() {
    const panel = document.createElement('div');
    panel.className = 'cf-potd-settings-panel';
    panel.style.display = 'none'; // Hidden by default
    
    const username = this.userData?.username || 'Unknown';
    const rating = this.userData?.rating || 800; // Default to 800 for new users
    
    panel.innerHTML = `
      <div class="settings-overlay"></div>
      <div class="settings-content">
        <div class="settings-header">
          <h3>⚙️ Settings</h3>
          <button class="settings-close-btn" title="Close">×</button>
        </div>
        
        <div class="settings-body">
          <!-- User Info Section -->
          <div class="settings-section">
            <h4>User Information</h4>
            <div class="info-row">
              <span class="info-label">Handle:</span>
              <span class="info-value">${username}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Rating:</span>
              <span class="info-value">${rating}</span>
            </div>
          </div>
          
          <!-- Actions Section -->
          <div class="settings-section">
            <h4>Actions</h4>
            <button id="settings-refresh-rating" class="settings-btn">
              🔄 Refresh Rating
            </button>
            <button id="settings-refresh-problems" class="settings-btn">
              📅 Refresh Problems
            </button>
            <button id="settings-change-user" class="settings-btn">
              👤 Change User
            </button>
          </div>
          
          <!-- Preferences Section -->
          <div class="settings-section">
            <h4>Preferences</h4>
            <div class="setting-toggle">
              <label>
                <input type="checkbox" id="setting-dark-mode" />
                <span>Dark Mode</span>
              </label>
            </div>
            <div class="setting-toggle">
              <input type="checkbox" id="setting-animations" checked />
              <span>Enable Animations</span>
            </div>
            <div class="setting-toggle">
              <label>
                <input type="checkbox" id="setting-notifications" />
                <span>Daily Reminders</span>
              </label>
            </div>
          </div>
          
          <!-- About Section -->
          <div class="settings-section">
            <h4>About</h4>
            <p class="about-text">
              Codeforces POTD Extension v2.0<br/>
              Track your daily problem-solving streak!
            </p>
            <a href="https://github.com/your-repo" target="_blank" class="settings-link">
              📖 Documentation
            </a>
          </div>
        </div>
      </div>
    `;
    
    this.container = panel;
    this.attachEventListeners();
    return panel;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Close button
    const closeBtn = this.container.querySelector('.settings-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
    
    // Overlay click to close
    const overlay = this.container.querySelector('.settings-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => this.close());
    }
    
    // Refresh rating button
    const refreshRatingBtn = this.container.querySelector('#settings-refresh-rating');
    if (refreshRatingBtn) {
      refreshRatingBtn.addEventListener('click', () => this.handleRefreshRating());
    }
    
    // Refresh problems button
    const refreshProblemsBtn = this.container.querySelector('#settings-refresh-problems');
    if (refreshProblemsBtn) {
      refreshProblemsBtn.addEventListener('click', () => this.handleRefreshProblems());
    }
    
    // Change user button
    const changeUserBtn = this.container.querySelector('#settings-change-user');
    if (changeUserBtn) {
      changeUserBtn.addEventListener('click', () => this.handleChangeUser());
    }
    
    // Dark mode toggle
    const darkModeToggle = this.container.querySelector('#setting-dark-mode');
    if (darkModeToggle) {
      darkModeToggle.addEventListener('change', (e) => this.handleDarkModeToggle(e.target.checked));
    }
    
    // Animations toggle
    const animationsToggle = this.container.querySelector('#setting-animations');
    if (animationsToggle) {
      animationsToggle.addEventListener('change', (e) => this.handleAnimationsToggle(e.target.checked));
    }
    
    // Notifications toggle
    const notificationsToggle = this.container.querySelector('#setting-notifications');
    if (notificationsToggle) {
      notificationsToggle.addEventListener('change', (e) => this.handleNotificationsToggle(e.target.checked));
    }
    
    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  /**
   * Open the settings panel
   */
  open() {
    if (this.container) {
      this.container.style.display = 'block';
      this.isOpen = true;
      // Add animation class
      setTimeout(() => {
        this.container.classList.add('settings-open');
      }, 10);
    }
  }

  /**
   * Close the settings panel
   */
  close() {
    if (this.container) {
      this.container.classList.remove('settings-open');
      setTimeout(() => {
        this.container.style.display = 'none';
        this.isOpen = false;
      }, 300); // Match CSS transition duration
    }
  }

  /**
   * Handle refresh rating
   */
  async handleRefreshRating() {
    const btn = this.container.querySelector('#settings-refresh-rating');
    const originalText = btn.textContent;
    
    try {
      btn.textContent = '⏳ Refreshing...';
      btn.disabled = true;
      
      const userData = await window.storage.get(window.storageKeys.USER_DATA);
      const handle = userData?.username;
      
      if (!handle) {
        throw new Error('No user found');
      }
      
      // Get old rating before refresh
      const oldUserInfo = await window.storage.get(window.storageKeys.USER_INFO);
      let oldRating = 800;
      if (oldUserInfo && Array.isArray(oldUserInfo) && oldUserInfo.length > 0) {
        const user = oldUserInfo[0][0] || oldUserInfo[0];
        oldRating = user?.rating || 800;
      }
      
      console.log('[SettingsPanel] Old rating:', oldRating);
      
      // Call backend to refresh rating from Codeforces API
      const API_URL = window.config.current.API_URL;
      const response = await fetch(`${API_URL}/users/refresh-rating`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userID: handle })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      let updatedUser = data.message;
      
      // Extract user from array if needed
      if (Array.isArray(updatedUser)) {
        updatedUser = updatedUser[0];
      }
      
      const newRating = updatedUser.rating || 800;
      console.log('[SettingsPanel] New rating:', newRating);
      
      await window.storage.set(window.storageKeys.USER_INFO, [updatedUser]);
      
      // Update UI
      const ratingValue = this.container.querySelector('.info-row:nth-of-type(2) .info-value');
      if (ratingValue) {
        ratingValue.textContent = newRating;
      }
      
      btn.textContent = '✅ Updated!';
      
      // If rating changed, automatically refresh problems
      if (oldRating !== newRating) {
        console.log('[SettingsPanel] Rating changed! Refreshing problems...');
        btn.textContent = '✅ Updating problems...';
        
        // Refresh problems with new rating
        await this.refreshProblemsForRating(handle, newRating);
        
        btn.textContent = '✅ All Updated!';
      }
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 2000);
      
      // Refresh calendar
      if (window.refreshCalendar) {
        window.refreshCalendar();
      }
      
    } catch (err) {
      window.errorHandler.logError('SettingsPanel_refreshRating', err);
      btn.textContent = '❌ Failed';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 2000);
    }
  }
  
  /**
   * Refresh problems for a specific rating
   * @param {string} handle - User handle
   * @param {number} rating - New rating
   */
  async refreshProblemsForRating(handle, rating) {
    try {
      const { month, year } = window.dateUtils.getCurrentMonthAndYear();
      const problemsData = await window.api.getMonthlyProblems(month, year, rating);
      
      // Format and store
      const setupForm = new window.SetupForm();
      const formattedProblems = setupForm.formatProblems(problemsData, month, year, rating);
      
      if (!formattedProblems || formattedProblems.length === 0) {
        console.warn('[SettingsPanel] No problems found for new rating');
        return;
      }
      
      await window.storage.set(window.storageKeys.PROBLEM_DATA, formattedProblems);
      console.log('[SettingsPanel] Problems refreshed for new rating:', rating);
      
    } catch (err) {
      console.error('[SettingsPanel] Error refreshing problems:', err);
      // Don't throw, just log - rating was still updated
    }
  }

  /**
   * Handle refresh problems
   */
  async handleRefreshProblems() {
    const btn = this.container.querySelector('#settings-refresh-problems');
    const originalText = btn.textContent;
    
    try {
      btn.textContent = '⏳ Refreshing...';
      btn.disabled = true;
      
      const userData = await window.storage.get(window.storageKeys.USER_DATA);
      const userInfo = await window.storage.get(window.storageKeys.USER_INFO);
      const handle = userData?.username;
      let rating = 800;
      
      if (userInfo && Array.isArray(userInfo) && userInfo.length > 0) {
        const user = userInfo[0][0] || userInfo[0];
        rating = user?.rating || 800;
      }
      
      if (!handle) {
        throw new Error('No user found');
      }
      
      console.log('[SettingsPanel] Refreshing problems with rating:', rating);
      
      const { month, year } = window.dateUtils.getCurrentMonthAndYear();
      const problemsData = await window.api.getMonthlyProblems(month, year, rating);
      
      // Format and store (reuse logic from SetupForm)
      const setupForm = new window.SetupForm();
      const formattedProblems = setupForm.formatProblems(problemsData, month, year, rating);
      
      if (!formattedProblems || formattedProblems.length === 0) {
        throw new Error(`No problems found for ${month}/${year} with rating ${rating}`);
      }
      
      await window.storage.set(window.storageKeys.PROBLEM_DATA, formattedProblems);
      
      btn.textContent = '✅ Updated!';
      console.log('[SettingsPanel] Problems refreshed successfully:', formattedProblems.length, 'problems');
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 2000);
      
      // Refresh calendar
      if (window.refreshCalendar) {
        window.refreshCalendar();
      }
      
    } catch (err) {
      window.errorHandler.logError('SettingsPanel_refreshProblems', err);
      const errorMsg = err.message || 'Failed to refresh';
      btn.textContent = '❌ ' + (errorMsg.includes('404') || errorMsg.includes('No problems') ? 'No Data' : 'Failed');
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 3000);
    }
  }

  /**
   * Handle change user
   */
  async handleChangeUser() {
    const confirmed = confirm('This will clear your current data and show the setup screen. Continue?');
    
    if (confirmed) {
      try {
        // Clear all storage
        await window.storage.clear();
        
        // Close settings
        this.close();
        
        // Reload the page to show setup form
        window.location.reload();
        
      } catch (err) {
        window.errorHandler.logError('SettingsPanel_changeUser', err);
        alert('Failed to change user. Please try again.');
      }
    }
  }

  /**
   * Handle dark mode toggle
   */
  handleDarkModeToggle(enabled) {
    // TODO: Implement dark mode in Sprint 3
    console.log('[SettingsPanel] Dark mode:', enabled);
    document.documentElement.classList.toggle('cf-potd-dark-mode', enabled);
  }

  /**
   * Handle animations toggle
   */
  handleAnimationsToggle(enabled) {
    console.log('[SettingsPanel] Animations:', enabled);
    document.documentElement.classList.toggle('cf-potd-no-animations', !enabled);
  }

  /**
   * Handle notifications toggle
   */
  handleNotificationsToggle(enabled) {
    // TODO: Implement notifications in future sprint
    console.log('[SettingsPanel] Notifications:', enabled);
  }

  /**
   * Update user data
   */
  updateUserData(userData) {
    this.userData = userData;
    
    // Update UI if already rendered
    if (this.container) {
      const usernameEl = this.container.querySelector('.info-value:first-child');
      const ratingEl = this.container.querySelector('.info-value:last-child');
      
      if (usernameEl) usernameEl.textContent = userData?.username || 'Unknown';
      if (ratingEl) ratingEl.textContent = userData?.rating || 'N/A';
    }
  }

  /**
   * Destroy the panel
   */
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

// Export for use in content.js
window.SettingsPanel = SettingsPanel;

