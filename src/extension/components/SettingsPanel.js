/**
 * Settings modal (V3).
 *
 * Reads the flat `user` + `today` + `monthView` caches from storage.
 * Actions that mutate state always fire the backend call first, update
 * storage with the authoritative response, then nudge the calendar.
 *
 * Dark-mode and animation toggles flip CSS classes; full theming lives
 * in the style sheet.
 */

/**
 * Theme helpers.
 *
 * Resolution order (matches content.js:applyTheme):
 *   1. user's stored override wins (`themeOverride` = "dark" | "light")
 *   2. otherwise we match the Codeforces page itself (luminance-sniffed in
 *      content.js so the calendar never looks orphaned next to CF)
 *
 * Toggling the Dark-mode checkbox writes an explicit override; there's no
 * "system auto" path because users found it confusing when their OS theme
 * didn't match what Codeforces was showing.
 */
function isDarkActive() {
  const html = document.documentElement;
  if (html.classList.contains("cf-potd-dark-mode")) return true;
  if (html.classList.contains("cf-potd-light-mode")) return false;
  return window.detectCodeforcesTheme?.() === "dark";
}

function applyDarkPreference(wantDark) {
  const html = document.documentElement;
  html.classList.toggle("cf-potd-dark-mode", wantDark);
  html.classList.toggle("cf-potd-light-mode", !wantDark);
  window.storage.set("themeOverride", wantDark ? "dark" : "light").catch(() => {});
}

async function runButton(btn, originalText, loadingText, work, resetMs = 2000) {
  try {
    btn.textContent = loadingText;
    btn.disabled = true;
    btn.textContent = await work();
  } catch (err) {
    btn.textContent = "Failed";
    throw err;
  } finally {
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, resetMs);
  }
}

class SettingsPanel {
  constructor(user) {
    this.user = user || null;
    this.container = null;
    this.isOpen = false;
    this.keydownHandler = null;
  }

  render() {
    const panel = document.createElement("div");
    panel.className = "cf-potd-settings-panel";
    panel.style.display = "none";

    const handle = this.user?.userID || "Unknown";
    const rating = this.user?.rating ?? "—";

    panel.innerHTML = `
      <div class="settings-overlay"></div>
      <div class="settings-content">
        <div class="settings-header">
          <h3>Settings</h3>
          <button class="settings-close-btn" title="Close">×</button>
        </div>

        <div class="settings-body">
          <div class="settings-section">
            <h4>User</h4>
            <div class="info-row">
              <span class="info-label">Handle</span>
              <span id="settings-user-handle" class="info-value">${handle}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Rating</span>
              <span id="settings-user-rating" class="info-value">${rating}</span>
            </div>
          </div>

          <div class="settings-section">
            <h4>Actions</h4>
            <button id="settings-refresh-rating" class="settings-btn">Refresh rating</button>
            <button id="settings-refresh-problems" class="settings-btn">Refresh problems</button>
            <button id="settings-change-user" class="settings-btn">Change user</button>
          </div>

          <div class="settings-section">
            <h4>Preferences</h4>
            <div class="setting-toggle">
              <label>
                <input type="checkbox" id="setting-dark-mode" />
                <span>Dark mode</span>
              </label>
            </div>
            <div class="setting-toggle">
              <label>
                <input type="checkbox" id="setting-animations" checked />
                <span>Animations</span>
              </label>
            </div>
          </div>

          <div class="settings-section">
            <h4>About</h4>
            <p class="about-text">Codeforces POTD · v2.5</p>
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

    $(".settings-close-btn").addEventListener("click", () => this.close());
    $(".settings-overlay").addEventListener("click", () => this.close());
    $("#settings-refresh-rating").addEventListener("click", () => this.handleRefreshRating());
    $("#settings-refresh-problems").addEventListener("click", () => this.handleRefreshProblems());
    $("#settings-change-user").addEventListener("click", () => this.handleChangeUser());

    const darkToggle = $("#setting-dark-mode");
    darkToggle.checked = isDarkActive();
    darkToggle.addEventListener("change", (e) => applyDarkPreference(e.target.checked));

    $("#setting-animations").addEventListener("change", (e) =>
      document.documentElement.classList.toggle("cf-potd-no-animations", !e.target.checked)
    );

    this.keydownHandler = (e) => {
      if (e.key === "Escape" && this.isOpen) this.close();
    };
    document.addEventListener("keydown", this.keydownHandler);
  }

  open() {
    if (!this.container) return;
    this.container.style.display = "block";
    this.isOpen = true;
    setTimeout(() => this.container.classList.add("settings-open"), 10);
  }

  close() {
    if (!this.container) return;
    this.container.classList.remove("settings-open");
    setTimeout(() => {
      this.container.style.display = "none";
      this.isOpen = false;
    }, 300);
  }

  async handleRefreshRating() {
    const btn = this.container.querySelector("#settings-refresh-rating");
    const originalText = btn.textContent;
    try {
      await runButton(btn, originalText, "Refreshing…", async () => {
        const stored = await window.storage.get(window.storageKeys.USER);
        if (!stored?.userID) throw new Error("No user in storage");

        const prev = stored.rating;
        const { user, today } = await window.api.refreshRating(stored.userID);
        await window.storage.set(window.storageKeys.USER, user);
        await window.storage.set(window.storageKeys.TODAY, today);

        this.updateUser(user);

        if (prev !== user.rating) {
          // Rating changed → refresh the month view (different problem bucket).
          const monthView = await window.contentBridge.fetchMonthView(user);
          await window.storage.set(window.storageKeys.MONTH_VIEW, monthView);
          window.refreshCalendar?.();
          return "Updated";
        }
        window.refreshCalendar?.();
        return "No change";
      });
    } catch (err) {
      window.log.error("[settings] refreshRating:", err);
    }
  }

  async handleRefreshProblems() {
    const btn = this.container.querySelector("#settings-refresh-problems");
    const originalText = btn.textContent;
    try {
      await runButton(btn, originalText, "Refreshing…", async () => {
        const user = await window.storage.get(window.storageKeys.USER);
        if (!user?.userID) throw new Error("No user in storage");
        const monthView = await window.contentBridge.fetchMonthView(user);
        await window.storage.set(window.storageKeys.MONTH_VIEW, monthView);
        window.refreshCalendar?.();
        return "Updated";
      }, 2500);
    } catch (err) {
      window.log.error("[settings] refreshProblems:", err);
    }
  }

  async handleChangeUser() {
    // Lightweight inline swap — doesn't wipe the extension, doesn't show
    // the full onboarding form. content.js owns the prompt since it needs
    // to update the calendar in place.
    if (typeof window.promptChangeUser !== "function") {
      window.log.error("[settings] promptChangeUser not ready");
      return;
    }
    const result = await window.promptChangeUser();
    if (result?.ok) this.close();
  }

  /** Replace the user shown in the panel after an external refresh. */
  updateUser(user) {
    this.user = user;
    if (!this.container) return;
    const h = this.container.querySelector("#settings-user-handle");
    const r = this.container.querySelector("#settings-user-rating");
    if (h) h.textContent = user?.userID || "Unknown";
    if (r) r.textContent = user?.rating ?? "—";
  }

  destroy() {
    if (this.keydownHandler) document.removeEventListener("keydown", this.keydownHandler);
    this.container?.parentNode?.removeChild(this.container);
  }
}

window.SettingsPanel = SettingsPanel;
