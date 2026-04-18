/**
 * Content script (V3).
 *
 * Renders the POTD calendar inside the Codeforces sidebar. Owns the
 * onboarding form and the settings panel. Backend syncs are fire-and-forget
 * so cached storage always drives the first paint, then we reconcile.
 *
 * Data shapes in storage (see config.js):
 *   user      { userID, rating, ratingUpdatedAt, createdAt }
 *   today     { dateISO, problem, streak: { length, lastSolvedDate, includesToday } }
 *   monthView { rating, from, to, items: [{dateISO, problem}], solvedDays: { iso: true } }
 */

if (typeof window.cfPotdIsRefreshing === "undefined") {
  window.cfPotdIsRefreshing = false;
}

let settingsPanelInstance = null;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// ---------- month-view helper (shared with SetupForm/SettingsPanel) ----------

function currentMonthRange() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const last = new Date(Date.UTC(y, m + 1, 0));
  const fmt = window.dateUtils.formatDateToUTCISO;
  return { from: fmt(first), to: fmt(last), year: y, monthIdx: m };
}

async function fetchMonthView(user) {
  const { from, to } = currentMonthRange();
  const [problems, submissions] = await Promise.all([
    window.api.getProblemsInRange(user.rating, from, to),
    window.api.getSubmissions(user.userID, from, to)
  ]);
  return {
    rating: user.rating,
    from,
    to,
    items: problems.items || [],
    solvedDays: submissions.solvedDays || {}
  };
}

window.contentBridge = { fetchMonthView };

// ---------- bootstrapping ----------

async function initializeExtension() {
  window.log.debug("[cf-potd] initializing");

  try {
    await applyTheme();

    const user = await window.storage.get(window.storageKeys.USER);
    if (!user?.userID) {
      showSetupForm();
      return;
    }

    await createCalendar();
    await initializeSettingsPanel();
    syncWithBackend();
  } catch (err) {
    window.log.error("[cf-potd] init failed:", err);
  }
}

/**
 * Theme resolution (order matters):
 *   1. User override in storage wins (`themeOverride` = "dark" | "light").
 *   2. Otherwise we match Codeforces' own page theme so the calendar never
 *      looks orphaned next to a light CF page (or vice versa).
 *
 * The `prefers-color-scheme` media query is deliberately NOT consulted —
 * users found it confusing when their system preferred dark but CF itself
 * was rendering light, producing a dark calendar stapled to a white page.
 */
async function applyTheme() {
  const override = await window.storage.get("themeOverride");
  const html = document.documentElement;
  if (override === "dark") {
    html.classList.add("cf-potd-dark-mode");
    html.classList.remove("cf-potd-light-mode");
    return;
  }
  if (override === "light") {
    html.classList.add("cf-potd-light-mode");
    html.classList.remove("cf-potd-dark-mode");
    return;
  }
  const cfIsDark = detectCodeforcesTheme() === "dark";
  html.classList.toggle("cf-potd-dark-mode", cfIsDark);
  html.classList.toggle("cf-potd-light-mode", !cfIsDark);
}

/**
 * Detect whether Codeforces is currently rendering in a dark theme by
 * sampling the body's computed background luminance. More robust than
 * sniffing class names — works with both CF's native dark and any
 * third-party darkening extensions the user has installed.
 */
function detectCodeforcesTheme() {
  try {
    const bg = getComputedStyle(document.body).backgroundColor;
    const m = bg.match(/rgba?\(([^)]+)\)/);
    if (!m) return "light";
    const [r, g, b] = m[1].split(",").map((s) => parseFloat(s.trim()));
    // Rec.709 relative luminance, normalized to 0–1.
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum < 0.5 ? "dark" : "light";
  } catch {
    return "light";
  }
}

window.detectCodeforcesTheme = detectCodeforcesTheme;

/**
 * Reconcile cached user/today/monthView with the backend. Runs at most once
 * per SYNC_THROTTLE_MS to avoid hitting /users on every CF navigation —
 * ratings only change after contests, so frequent syncs are wasted calls.
 *
 * The solved-today verification still runs every load (self-limiting: it
 * no-ops once today is solved), so newly-solved problems update promptly.
 */
async function syncWithBackend({ force = false } = {}) {
  try {
    const cached = await window.storage.get(window.storageKeys.USER);
    if (!cached?.userID) return;

    const { from, to } = currentMonthRange();
    const cachedView = await window.storage.get(window.storageKeys.MONTH_VIEW);
    const viewStale = !cachedView
      || cachedView.from !== from
      || cachedView.to !== to
      || cachedView.rating !== cached.rating;

    const today = await window.storage.get(window.storageKeys.TODAY);
    const todayStale = !today || today.dateISO !== window.dateUtils.getTodayISO();

    const lastSyncedAt = await window.storage.get(window.storageKeys.LAST_SYNCED_AT);
    const throttled = lastSyncedAt
      && !force && !viewStale && !todayStale
      && Date.now() - new Date(lastSyncedAt).getTime() < window.SYNC_THROTTLE_MS;

    // Still worth checking for a new AC even if we skip the user sync.
    if (throttled) {
      window.log.debug("[cf-potd] user sync throttled");
      if (!today?.streak?.includesToday) {
        maybeVerifyTodaysSubmission(cached.userID, today?.problem);
      }
      return;
    }

    const fresh = await window.api.getOrCreateUser(cached.userID);
    await window.storage.set(window.storageKeys.USER, fresh.user);
    await window.storage.set(window.storageKeys.TODAY, fresh.today);
    await window.storage.set(window.storageKeys.LAST_SYNCED_AT, new Date().toISOString());

    const ratingChanged = cached.rating !== fresh.user.rating;
    if (ratingChanged || viewStale) {
      const monthView = await fetchMonthView(fresh.user);
      await window.storage.set(window.storageKeys.MONTH_VIEW, monthView);
    }

    settingsPanelInstance?.updateUser(fresh.user);
    window.refreshCalendar?.();

    if (!fresh.today?.streak?.includesToday) {
      maybeVerifyTodaysSubmission(fresh.user.userID, fresh.today?.problem);
    }
  } catch (err) {
    window.log.warn("[cf-potd] backend sync skipped:", err.message);
  }
}

window.syncWithBackend = syncWithBackend;

/**
 * If today's POTD hasn't been recorded yet, check Codeforces directly to
 * see whether the user solved it on their own, and if so record the
 * submission server-side. Updates the streak in place.
 */
async function maybeVerifyTodaysSubmission(handle, problem) {
  if (!problem?.cfId) return;
  try {
    const check = await window.api.verifySubmission(handle, problem.cfId);
    if (!check.verified) return;

    const { streak } = await window.api.recordSubmission(handle, problem.cfId);
    const today = await window.storage.get(window.storageKeys.TODAY);
    if (today) {
      today.streak = streak;
      await window.storage.set(window.storageKeys.TODAY, today);
    }

    // Refresh solvedDays so the cell flips immediately.
    const user = await window.storage.get(window.storageKeys.USER);
    if (user) {
      const monthView = await fetchMonthView(user);
      await window.storage.set(window.storageKeys.MONTH_VIEW, monthView);
    }
    window.refreshCalendar?.();

    // Small celebratory pulse on the streak pill. Runs after refreshCalendar
    // has re-rendered so the new element picks up the class.
    requestAnimationFrame(() => {
      const pill = document.getElementById("calendar-streak-container");
      if (!pill) return;
      pill.classList.add("pulse");
      setTimeout(() => pill.classList.remove("pulse"), 500);
    });
  } catch (err) {
    window.log.warn("[cf-potd] submission verify failed:", err.message);
  }
}

// ---------- setup form ----------

function showSetupForm() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) {
    window.log.error("[cf-potd] sidebar not found");
    return;
  }

  const setupForm = new window.SetupForm();
  setupForm.onSetupComplete = async () => {
    try {
      setupForm.destroy();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await createCalendar();
      await initializeSettingsPanel();
    } catch (err) {
      window.log.error("[cf-potd] setup completion failed:", err);
      alert("Error loading calendar. Please refresh the page.");
    }
  };

  sidebar.insertAdjacentElement("afterbegin", setupForm.render());
}

// ---------- settings panel ----------

async function initializeSettingsPanel() {
  if (settingsPanelInstance) settingsPanelInstance.destroy();
  const user = await window.storage.get(window.storageKeys.USER);

  settingsPanelInstance = new window.SettingsPanel(user);
  document.body.appendChild(settingsPanelInstance.render());
}

function addSettingsIcon() {
  const calendarHeader = document.querySelector(".calendar-header th");
  if (!calendarHeader) return;
  if (calendarHeader.querySelector(".calendar-settings-icon")) return;

  const btn = document.createElement("button");
  btn.className = "calendar-settings-icon";
  btn.innerHTML = "<span aria-hidden=\"true\">⚙</span>";
  btn.setAttribute("aria-label", "Settings");
  btn.title = "Settings";
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    settingsPanelInstance?.open();
  });

  const headerText = calendarHeader.innerHTML;
  calendarHeader.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span>${headerText}</span>
      <span></span>
    </div>
  `;
  calendarHeader.querySelector("span:last-child").appendChild(btn);
}

// ---------- calendar ----------

async function createCalendar() {
  try {
    const [user, today, monthView] = await Promise.all([
      window.storage.get(window.storageKeys.USER),
      window.storage.get(window.storageKeys.TODAY),
      window.storage.get(window.storageKeys.MONTH_VIEW)
    ]);

    const handle = user?.userID || "Unknown";
    const rating = user?.rating ?? null;
    const streakCount = today?.streak?.length ?? 0;

    const { year, monthIdx } = currentMonthRange();
    const referenceDay = new Date().getUTCDate();

    const problemByDate = new Map();
    for (const item of monthView?.items || []) {
      if (item?.dateISO && item.problem) problemByDate.set(item.dateISO, item.problem);
    }
    const solvedDays = monthView?.solvedDays || {};

    const html = buildCalendarHTML({
      year,
      monthIdx,
      handle,
      rating,
      streakCount,
      problemByDate,
      solvedDays,
      referenceDay
    });
    injectCalendar(html);
  } catch (err) {
    window.log.error("[cf-potd] createCalendar failed:", err);
  } finally {
    window.cfPotdIsRefreshing = false;
  }
}

/**
 * Map a Codeforces rating to a class for the handle color.
 * Tiers mirror https://codeforces.com/blog/entry/20638.
 */
function ratingTierClass(rating) {
  if (rating == null) return "";
  if (rating < 1200) return "tier-newbie";
  if (rating < 1400) return "tier-pupil";
  if (rating < 1600) return "tier-specialist";
  if (rating < 1900) return "tier-expert";
  if (rating < 2100) return "tier-cm";
  if (rating < 2400) return "tier-master";
  return "tier-gm";
}

function buildCalendarHTML({ year, monthIdx, handle, rating, streakCount, problemByDate, solvedDays, referenceDay }) {
  const firstDay = new Date(Date.UTC(year, monthIdx, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  const displayMonth = (monthIdx + 1).toString().padStart(2, "0");

  const tier = ratingTierClass(rating);
  const ratingText = rating != null ? `· ${rating}` : "";
  const streakActive = streakCount > 0 ? " has-streak" : "";

  let html = `
    <div class="cf-potd-container">
      <table class="calendar">
        <tr class="calendar-header">
          <th colspan="7">${MONTH_NAMES[monthIdx]} ${year}</th>
        </tr>
        <tr class="user-info-row">
          <td colspan="7">
            <div class="user-info">
              <a href="https://codeforces.com/profile/${handle}" target="_blank" class="user-handle ${tier}">
                ${handle}<span class="user-rating"> ${ratingText}</span>
              </a>
              <div class="streak-container${streakActive}" id="calendar-streak-container">
                <span class="streak-flame">🔥</span>
                <span id="calendar-streak" class="streak-count">${streakCount}</span>
                <span class="streak-label">day streak</span>
              </div>
            </div>
          </td>
        </tr>
        <tr class="day-header">
          <th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th>
          <th>Thu</th><th>Fri</th><th>Sat</th>
        </tr>
  `;

  let day = 1;
  for (let row = 0; row < 6; row++) {
    html += "<tr>";
    for (let col = 0; col < 7; col++) {
      if (row === 0 && col < firstDay) {
        html += "<td></td>";
      } else if (day > daysInMonth) {
        html += "<td></td>";
      } else {
        const iso = `${year}-${displayMonth}-${day.toString().padStart(2, "0")}`;
        const when = day < referenceDay ? "past" : day === referenceDay ? "today" : "future";
        const solved = solvedDays[iso] === true;

        const problem = problemByDate.get(iso);
        const url = problem ? problemUrl(problem) : null;
        const inner = (url && day <= referenceDay)
          ? `<a href="${url}" target="_blank">${day}</a>`
          : `${day}`;
        const tick = solved ? ' <span class="checkmark">✓</span>' : "";
        const classes = [when, solved ? "solved" : ""].filter(Boolean).join(" ");

        html += `<td class="${classes}" data-date="${iso}">${inner}${tick}</td>`;
        day++;
      }
    }
    html += "</tr>";
    if (day > daysInMonth && row < 5) {
      html += "<tr>" + "<td></td>".repeat(7) + "</tr>";
    }
  }

  html += "</table></div>";
  return html;
}

function problemUrl(problem) {
  if (problem?.url) return problem.url;
  if (problem?.contestId != null && problem?.index) {
    return `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`;
  }
  return null;
}

function injectCalendar(html) {
  let sidebar = document.getElementById("sidebar");
  if (!sidebar) {
    const pageContent = document.querySelector(".content-with-sidebar");
    if (pageContent) {
      sidebar = document.createElement("div");
      sidebar.id = "sidebar";
      sidebar.className = "sidebar";
      pageContent.appendChild(sidebar);
    }
  }
  if (!sidebar) return;

  const existing = sidebar.querySelector(".calendar");
  if (existing) existing.closest(".cf-potd-container")?.remove();
  sidebar.insertAdjacentHTML("afterbegin", html);
  addSettingsIcon();
}

window.refreshCalendar = function () {
  if (window.cfPotdIsRefreshing) return;
  window.cfPotdIsRefreshing = true;
  document.querySelector(".cf-potd-container")?.remove();
  createCalendar();
};

/**
 * Switch to a different user without going through the full onboarding form.
 *
 * Shows a tiny inline prompt, POSTs to /users with the new handle (which
 * fetches their rating from Codeforces), replaces the three storage keys,
 * and re-renders in place. The settings panel stays open.
 */
window.promptChangeUser = async function promptChangeUser() {
  const newHandle = await showHandlePrompt();
  if (!newHandle) return { cancelled: true };

  try {
    const { user, today } = await window.api.getOrCreateUser(newHandle);
    const monthView = await fetchMonthView(user);

    await window.storage.set(window.storageKeys.USER, user);
    await window.storage.set(window.storageKeys.TODAY, today);
    await window.storage.set(window.storageKeys.MONTH_VIEW, monthView);
    await window.storage.set(window.storageKeys.LAST_SYNCED_AT, new Date().toISOString());

    settingsPanelInstance?.updateUser(user);
    window.refreshCalendar?.();
    return { ok: true, user };
  } catch (err) {
    window.log.error("[cf-potd] change user failed:", err);
    alert(err.message || "Could not switch user. Check the handle and try again.");
    return { ok: false, error: err };
  }
};

function showHandlePrompt() {
  return new Promise((resolve) => {
    const existing = document.querySelector(".cf-potd-handle-prompt");
    existing?.remove();

    const modal = document.createElement("div");
    modal.className = "cf-potd-handle-prompt";
    modal.innerHTML = `
      <div class="handle-prompt-overlay"></div>
      <div class="handle-prompt-card">
        <h4>Switch user</h4>
        <p>Enter a Codeforces handle. Your rating will be fetched automatically.</p>
        <input type="text" class="handle-prompt-input" placeholder="e.g. tourist" autocomplete="off" />
        <div class="handle-prompt-actions">
          <button class="handle-prompt-cancel">Cancel</button>
          <button class="handle-prompt-submit">Switch</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const input = modal.querySelector(".handle-prompt-input");
    const cancel = modal.querySelector(".handle-prompt-cancel");
    const submit = modal.querySelector(".handle-prompt-submit");
    const overlay = modal.querySelector(".handle-prompt-overlay");
    setTimeout(() => input.focus(), 50);

    function finish(value) {
      modal.remove();
      resolve(value);
    }
    function trySubmit() {
      const v = input.value.trim();
      if (!v) return input.focus();
      if (!/^[a-zA-Z0-9_.\-]+$/.test(v)) {
        input.classList.add("invalid");
        return;
      }
      finish(v);
    }

    submit.addEventListener("click", trySubmit);
    cancel.addEventListener("click", () => finish(null));
    overlay.addEventListener("click", () => finish(null));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") trySubmit();
      if (e.key === "Escape") finish(null);
      input.classList.remove("invalid");
    });
  });
}

// ---------- bootstrap ----------

if (window.location.href.includes("codeforces.com")) {
  if (document.readyState === "complete") {
    initializeExtension();
  } else {
    window.addEventListener("load", initializeExtension);
  }
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "openSettings") {
    settingsPanelInstance?.open();
    sendResponse({ success: true });
  }
  return true;
});
