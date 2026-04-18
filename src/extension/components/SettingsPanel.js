/**
 * Settings modal. Opened from the calendar header gear icon or the
 * extension's browser-action button. Exposes user info, manual refresh
 * actions, and user-facing preferences.
 *
 * Dark mode / notifications toggles currently just flip CSS classes — full
 * implementation is scheduled for the UX sprint.
 */

function unwrapUserFromStorage(userInfo) {
  if (!userInfo) return null;
  if (Array.isArray(userInfo) && userInfo.length > 0) {
    return Array.isArray(userInfo[0]) ? userInfo[0][0] : userInfo[0];
  }
  return typeof userInfo === "object" ? userInfo : null;
}

/**
 * Small helper to drive a transient button state (loading → result → reset).
 * `work` resolves with the label to show on success.
 */
async function runButtonWorkflow(btn, originalText, loadingText, work, resetMs = 2000) {
  try {
    btn.textContent = loadingText;
    btn.disabled = true;
    const resultText = await work();
    btn.textContent = resultText;
  } catch (err) {
    btn.textContent = "❌ Failed";
    throw err;
  } finally {
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, resetMs);
  }
}

class SettingsPanel {
  constructor(userData) {
    this.userData = userData;
    this.container = null;
    this.isOpen = false;
    this.keydownHandler = null;
  }

  render() {
    const panel = document.createElement("div");
    panel.className = "cf-potd-settings-panel";
    panel.style.display = "none";

    const username = this.userData?.username || "Unknown";
    // Show an em-dash for genuinely missing rating rather than defaulting
    // to a misleading 800.
    const rating = this.userData?.rating != null ? this.userData.rating : "—";

    panel.innerHTML = `
      <div class="settings-overlay"></div>
      <div class="settings-content">
        <div class="settings-header">
          <h3>⚙️ Settings</h3>
          <button class="settings-close-btn" title="Close">×</button>
        </div>

        <div class="settings-body">
          <div class="settings-section">
            <h4>User Information</h4>
            <div class="info-row">
              <span class="info-label">Handle:</span>
              <span id="settings-user-handle" class="info-value">${username}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Rating:</span>
              <span id="settings-user-rating" class="info-value">${rating}</span>
            </div>
          </div>

          <div class="settings-section">
            <h4>Actions</h4>
            <button id="settings-refresh-rating" class="settings-btn">🔄 Refresh Rating</button>
            <button id="settings-refresh-problems" class="settings-btn">📅 Refresh Problems</button>
            <button id="settings-change-user" class="settings-btn">👤 Change User</button>
          </div>

          <div class="settings-section">
            <h4>Preferences</h4>
            <div class="setting-toggle">
              <label>
                <input type="checkbox" id="setting-dark-mode" />
                <span>Dark Mode</span>
              </label>
            </div>
            <div class="setting-toggle">
              <label>
                <input type="checkbox" id="setting-animations" checked />
                <span>Enable Animations</span>
              </label>
            </div>
            <div class="setting-toggle">
              <label>
                <input type="checkbox" id="setting-notifications" />
                <span>Daily Reminders</span>
              </label>
            </div>
          </div>

          <div class="settings-section">
            <h4>About</h4>
            <p class="about-text">
              Codeforces POTD Extension v2.0<br/>
              Track your daily problem-solving streak!
            </p>
          </div>
        </div>
      </div>
    `;

    this.container = panel;
    this.attachEventListeners();
    return panel;
  }

  attachEventListeners() {
    const $ = (sel) => this.container.querySelector(sel);

    $(".settings-close-btn")?.addEventListener("click", () => this.close());
    $(".settings-overlay")?.addEventListener("click", () => this.close());
    $("#settings-refresh-rating")?.addEventListener("click", () => this.handleRefreshRating());
    $("#settings-refresh-problems")?.addEventListener("click", () => this.handleRefreshProblems());
    $("#settings-change-user")?.addEventListener("click", () => this.handleChangeUser());
    $("#setting-dark-mode")?.addEventListener("change", (e) =>
      document.documentElement.classList.toggle("cf-potd-dark-mode", e.target.checked)
    );
    $("#setting-animations")?.addEventListener("change", (e) =>
      document.documentElement.classList.toggle("cf-potd-no-animations", !e.target.checked)
    );
    // Notifications are wired but no-op until the notifications sprint.

    this.keydownHandler = (e) => {
      if (e.key === "Escape" && this.isOpen) this.close();
    };
    document.addEventListener("keydown", this.keydownHandler);
  }

  open() {
    if (!this.container) return;
    this.container.style.display = "block";
    this.isOpen = true;
    // Next tick so the CSS transition has an initial frame to animate from.
    setTimeout(() => this.container.classList.add("settings-open"), 10);
  }

  close() {
    if (!this.container) return;
    this.container.classList.remove("settings-open");
    // Match CSS transition duration so we hide only after it finishes.
    setTimeout(() => {
      this.container.style.display = "none";
      this.isOpen = false;
    }, 300);
  }

  async handleRefreshRating() {
    const btn = this.container.querySelector("#settings-refresh-rating");
    const originalText = btn.textContent;

    try {
      await runButtonWorkflow(btn, originalText, "⏳ Refreshing...", async () => {
        const userData = await window.storage.get(window.storageKeys.USER_DATA);
        const handle = userData?.username;
        if (!handle) throw new Error("No user found");

        const oldRating = unwrapUserFromStorage(
          await window.storage.get(window.storageKeys.USER_INFO)
        )?.rating ?? null;

        // getOrCreateUser always re-syncs from Codeforces, so we can lean
        // on it instead of duplicating the fetch here.
        const updatedUser = await window.api.getOrCreateUser(handle);
        const newRating = updatedUser.rating ?? null;
        await window.storage.set(window.storageKeys.USER_INFO, [updatedUser]);

        const ratingEl = this.container.querySelector("#settings-user-rating");
        if (ratingEl) ratingEl.textContent = newRating ?? "—";
        this.userData = { ...(this.userData || {}), rating: newRating };

        if (oldRating !== newRating) {
          await this.refreshProblemsForRating(handle, newRating);
          if (window.refreshCalendar) window.refreshCalendar();
          return "✅ All Updated!";
        }
        if (window.refreshCalendar) window.refreshCalendar();
        return "✅ Updated!";
      });
    } catch (err) {
      window.errorHandler.logError("SettingsPanel_refreshRating", err);
    }
  }

  async refreshProblemsForRating(handle, rating) {
    try {
      const { month, year } = window.dateUtils.getCurrentMonthAndYear();
      const problemsData = await window.api.getMonthlyProblems(month, year, rating);
      const formatted = new window.SetupForm().formatProblems(problemsData, month, year, rating);
      if (!formatted || formatted.length === 0) {
        console.warn("[settings] no problems found for rating", rating);
        return;
      }
      await window.storage.set(window.storageKeys.PROBLEM_DATA, formatted);
    } catch (err) {
      console.error("[settings] problem refresh failed:", err);
    }
  }

  async handleRefreshProblems() {
    const btn = this.container.querySelector("#settings-refresh-problems");
    const originalText = btn.textContent;

    try {
      await runButtonWorkflow(btn, originalText, "⏳ Refreshing...", async () => {
        const userData = await window.storage.get(window.storageKeys.USER_DATA);
        const userInfo = await window.storage.get(window.storageKeys.USER_INFO);
        const handle = userData?.username;
        const rating = unwrapUserFromStorage(userInfo)?.rating || 800;

        if (!handle) throw new Error("No user found");

        const { month, year } = window.dateUtils.getCurrentMonthAndYear();
        const problemsData = await window.api.getMonthlyProblems(month, year, rating);
        const formatted = new window.SetupForm().formatProblems(problemsData, month, year, rating);
        if (!formatted || formatted.length === 0) {
          throw new Error(`No problems found for ${month}/${year} with rating ${rating}`);
        }

        await window.storage.set(window.storageKeys.PROBLEM_DATA, formatted);
        if (window.refreshCalendar) window.refreshCalendar();
        return "✅ Updated!";
      }, 3000);
    } catch (err) {
      window.errorHandler.logError("SettingsPanel_refreshProblems", err);
    }
  }

  async handleChangeUser() {
    const confirmed = confirm(
      "This will clear your current data and show the setup screen. Continue?"
    );
    if (!confirmed) return;
    try {
      await window.storage.clear();
      this.close();
      window.location.reload();
    } catch (err) {
      window.errorHandler.logError("SettingsPanel_changeUser", err);
      alert("Failed to change user. Please try again.");
    }
  }

  /** Update after external state changes (e.g. background rating sync). */
  updateUserData(userData) {
    this.userData = userData;
    if (!this.container) return;

    const usernameEl = this.container.querySelector("#settings-user-handle");
    const ratingEl = this.container.querySelector("#settings-user-rating");
    if (usernameEl) usernameEl.textContent = userData?.username || "Unknown";
    if (ratingEl) ratingEl.textContent = userData?.rating != null ? userData.rating : "—";
  }

  destroy() {
    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler);
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

window.SettingsPanel = SettingsPanel;
