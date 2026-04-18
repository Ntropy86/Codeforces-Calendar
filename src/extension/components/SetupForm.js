/**
 * First-time onboarding form. Rendered inline in the Codeforces sidebar when
 * we don't have a stored user yet. On submit it provisions the user record
 * on our backend (which syncs rating from Codeforces), fetches this month's
 * problems, and hands control back to content.js to render the calendar.
 */

/** Extract { contestId, index } from a "1234A" style problem ID. */
function extractProblemIdParts(problemId) {
  const match = String(problemId).match(/(\d+)([A-Z]\d*)/);
  if (!match) return null;
  return { contestId: parseInt(match[1], 10), index: match[2] };
}

/** Normalize a single raw problem record into the storage shape. */
function formatProblem(problem, currentMonth, currentYear) {
  const date = new Date(Date.UTC(currentYear, currentMonth - 1, problem.day));
  return {
    date: date.toISOString(),
    problem: extractProblemIdParts(problem.problemID) || {
      contestId: parseInt(problem.problemID, 10),
      index: "A"
    },
    url: problem.problemURL
  };
}

/**
 * Handle the ratings-keyed object shape returned when the backend returns
 * all rating buckets for a month. Each value is an array of problems keyed
 * either by array index or by day.
 */
function formatRatingsBucket(bucket, currentMonth, currentYear) {
  return Object.entries(bucket).map(([day, problem]) => {
    const withDay = { ...problem, day: problem.day ?? parseInt(day, 10) };
    return formatProblem(withDay, currentMonth, currentYear);
  });
}

class SetupForm {
  constructor() {
    this.container = null;
  }

  render() {
    const form = document.createElement("div");
    form.className = "cf-potd-setup-form";
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

  attachEventListeners() {
    const submitBtn = this.container.querySelector("#setup-submit-btn");
    const usernameInput = this.container.querySelector("#setup-username");

    submitBtn?.addEventListener("click", () => this.handleSubmit());

    if (usernameInput) {
      usernameInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.handleSubmit();
      });
      setTimeout(() => usernameInput.focus(), 100);
    }
  }

  async handleSubmit() {
    const usernameInput = this.container.querySelector("#setup-username");
    const handle = usernameInput ? usernameInput.value.trim() : "";

    if (!handle) {
      this.showMessage("Please enter your Codeforces handle", "error");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(handle)) {
      this.showMessage("Invalid handle format. Use only letters, numbers, _ and -", "error");
      return;
    }

    this.showLoading(true);
    this.showMessage("Connecting to backend...", "info");

    try {
      await window.storage.set(window.storageKeys.USER_DATA, { username: handle });
      await this.runSetupSequence(handle);
      this.showMessage("✅ Setup complete! Loading your calendar...", "success");
      this.onSetupComplete();
    } catch (err) {
      window.errorHandler.logError("SetupForm_handleSubmit", err);
      this.showMessage(err.message || "Failed to setup. Please try again.", "error");
      this.showLoading(false);
    }
  }

  async runSetupSequence(handle) {
    try {
      this.showMessage("Fetching user information...", "info");
      let userData = await window.api.getOrCreateUser(handle);

      await window.storage.set(window.storageKeys.USER_INFO, [userData]);
      await window.storage.set(window.storageKeys.USER_DATA, { username: handle });

      if (Array.isArray(userData)) userData = userData[0];

      const userRating = userData.rating || 600;
      const { month, year } = window.dateUtils.getCurrentMonthAndYear();

      this.showMessage("Fetching monthly problems...", "info");
      const problemsData = await window.api.getMonthlyProblems(month, year, userRating);
      const formattedProblems = this.formatProblems(problemsData, month, year, userRating);
      await window.storage.set(window.storageKeys.PROBLEM_DATA, formattedProblems);

      await window.streak.checkAndResetStreakIfNeeded(handle);
      return true;
    } catch (err) {
      window.errorHandler.logError("SetupForm_runSetupSequence", err);
      throw err;
    }
  }

  /**
   * Unwrap the various shapes /problemset/monthly may return (legacy API
   * wrappers + current single-rating response) into a flat array of
   * formatted problems.
   */
  formatProblems(problemsData, currentMonth, currentYear, userRating) {
    if (!problemsData) return [];

    if (Array.isArray(problemsData)) {
      return problemsData.map((p) => formatProblem(p, currentMonth, currentYear));
    }

    if (Array.isArray(problemsData.problems)) {
      return problemsData.problems.map((p) => formatProblem(p, currentMonth, currentYear));
    }

    if (problemsData.ratings && problemsData.ratings[userRating]) {
      return formatRatingsBucket(problemsData.ratings[userRating], currentMonth, currentYear);
    }

    if (problemsData.data) {
      return this.formatProblems(problemsData.data, currentMonth, currentYear, userRating);
    }

    return [];
  }

  showLoading(isLoading) {
    const btn = this.container.querySelector("#setup-submit-btn");
    const btnText = btn.querySelector(".btn-text");
    const btnLoader = btn.querySelector(".btn-loader");
    const input = this.container.querySelector("#setup-username");

    btnText.style.display = isLoading ? "none" : "inline";
    btnLoader.style.display = isLoading ? "inline-flex" : "none";
    btn.disabled = isLoading;
    input.disabled = isLoading;
  }

  showMessage(message, type = "info") {
    const messageEl = this.container.querySelector("#setup-message");
    if (!messageEl) return;
    messageEl.textContent = message;
    messageEl.className = `setup-message setup-message-${type}`;
    messageEl.style.display = "block";
  }

  /** Overridden by content.js to hand off to createCalendar(). */
  onSetupComplete() {
    if (window.createCalendar) window.createCalendar();
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

window.SetupForm = SetupForm;
