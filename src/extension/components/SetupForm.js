/**
 * First-time onboarding form (V3).
 *
 * Collects the Codeforces handle and provisions the user via POST /users,
 * which returns the user record + today's problem + current streak in a
 * single round-trip. A second parallel call fetches the current month's
 * problem grid and solvedDays for the calendar to render.
 */

class SetupForm {
  constructor() {
    this.container = null;
  }

  render() {
    const form = document.createElement("div");
    form.className = "cf-potd-setup-form";
    form.innerHTML = `
      <div class="setup-header">
        <h2>Codeforces POTD</h2>
        <p>Track your daily problem-solving streak</p>
      </div>

      <div class="setup-content">
        <div class="input-group">
          <label for="setup-username">Codeforces Handle</label>
          <input
            id="setup-username"
            type="text"
            placeholder="e.g. tourist"
            autocomplete="off"
          >
          <span class="input-hint">Your rating will be fetched from Codeforces.</span>
        </div>

        <button id="setup-submit-btn" class="btn-primary">
          <span class="btn-text">Get Started</span>
          <span class="btn-loader" style="display: none;">
            <span class="spinner"></span> Setting up...
          </span>
        </button>

        <div id="setup-message" class="setup-message"></div>
      </div>
    `;

    this.container = form;
    this.attachEventListeners();
    return form;
  }

  attachEventListeners() {
    const submitBtn = this.container.querySelector("#setup-submit-btn");
    const input = this.container.querySelector("#setup-username");

    submitBtn.addEventListener("click", () => this.handleSubmit());
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.handleSubmit();
    });
    setTimeout(() => input.focus(), 100);
  }

  async handleSubmit() {
    const input = this.container.querySelector("#setup-username");
    const handle = (input?.value || "").trim();

    if (!handle) {
      return this.showMessage("Enter your Codeforces handle", "error");
    }
    if (!/^[a-zA-Z0-9_.\-]+$/.test(handle)) {
      return this.showMessage("Handle may contain only letters, digits, _, -, .", "error");
    }

    this.showLoading(true);
    this.showMessage("Setting up…", "info");

    try {
      const { user, today } = await window.api.getOrCreateUser(handle);
      await window.storage.set(window.storageKeys.USER, user);
      await window.storage.set(window.storageKeys.TODAY, today);

      // Calendar backing data for the current month.
      const monthView = await window.contentBridge.fetchMonthView(user);
      await window.storage.set(window.storageKeys.MONTH_VIEW, monthView);

      this.showMessage("Setup complete — loading calendar…", "success");
      this.onSetupComplete();
    } catch (err) {
      window.log.error("[setup]", err);
      this.showMessage(err.message || "Setup failed. Check the handle and try again.", "error");
      this.showLoading(false);
    }
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
    const el = this.container.querySelector("#setup-message");
    if (!el) return;
    el.textContent = message;
    el.className = `setup-message setup-message-${type}`;
    el.style.display = "block";
  }

  /**
   * Overridden by content.js (showSetupForm) to hand off to createCalendar()
   * and mount the settings panel. Default is a no-op — the form should never
   * be rendered without that wiring.
   */
  onSetupComplete() {}

  destroy() {
    this.container?.parentNode?.removeChild(this.container);
  }
}

window.SetupForm = SetupForm;
