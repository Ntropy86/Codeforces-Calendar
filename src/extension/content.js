/**
 * Content script — calendar-only architecture.
 *
 * Renders the POTD calendar in the Codeforces sidebar, handles the onboarding
 * setup form for first-time users, and owns the settings panel. Background
 * syncs with our backend are fire-and-forget so the UI is never blocked.
 */

if (typeof window.cfPotdIsRefreshing === "undefined") {
  window.cfPotdIsRefreshing = false;
}

let settingsPanelInstance = null;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// ---------- storage helpers ----------

/**
 * userInfo in storage is sometimes `[user]`, sometimes `[[user]]` depending
 * on who wrote it last. Tolerate both until the data layer is flattened in
 * the standardize-data sprint.
 */
function unwrapUser(userInfo) {
  if (!userInfo) return null;
  if (Array.isArray(userInfo) && userInfo.length > 0) {
    return Array.isArray(userInfo[0]) ? userInfo[0][0] : userInfo[0];
  }
  if (typeof userInfo === "object") return userInfo;
  return null;
}

function extractUserRating(userInfo) {
  return unwrapUser(userInfo)?.rating ?? null;
}

function extractUserHandle(userInfo, userData) {
  return unwrapUser(userInfo)?.userID || userData?.username || "Unknown";
}

// ---------- bootstrapping ----------

async function initializeExtension() {
  window.log.debug("[cf-potd] initializing");

  try {
    const userData = await window.storage.get(window.storageKeys.USER_DATA);
    const userInfo = await window.storage.get(window.storageKeys.USER_INFO);
    const problemData = await window.storage.get(window.storageKeys.PROBLEM_DATA);

    const hasUser = userData && userData.username;
    const hasData = userInfo && problemData;

    if (!hasUser || !hasData) {
      showSetupForm();
      return;
    }

    // Fast path: render from cache, then reconcile with backend.
    await createCalendar();
    await initializeSettingsPanel();
    syncUserInBackground();
  } catch (error) {
    window.errorHandler.logError("initializeExtension", error);
  }
}

/**
 * Silently reconcile the stored user with the backend.
 *
 * Our POST /users endpoint always pulls the latest rating from Codeforces,
 * so if the rating has drifted we refresh problems for the new rating bucket
 * and re-render. Failures are non-fatal — the extension keeps working with
 * cached data when the backend is unreachable.
 */
async function syncUserInBackground() {
  try {
    const userData = await window.storage.get(window.storageKeys.USER_DATA);
    const handle = userData?.username;
    if (!handle) return;

    const oldRating = extractUserRating(
      await window.storage.get(window.storageKeys.USER_INFO)
    );

    const freshUser = await window.api.getOrCreateUser(handle);
    const newRating = freshUser?.rating ?? null;
    await window.storage.set(window.storageKeys.USER_INFO, [freshUser]);

    if (oldRating === newRating) {
      window.log.debug(`[cf-potd] rating unchanged (${newRating})`);
      return;
    }

    console.log(`[cf-potd] rating drift ${oldRating} -> ${newRating}, refreshing`);

    try {
      const { month, year } = window.dateUtils.getCurrentMonthAndYear();
      const problemsData = await window.api.getMonthlyProblems(month, year, newRating);
      const formattedProblems = new window.SetupForm()
        .formatProblems(problemsData, month, year, newRating);
      if (formattedProblems && formattedProblems.length > 0) {
        await window.storage.set(window.storageKeys.PROBLEM_DATA, formattedProblems);
      }
    } catch (err) {
      console.warn("[cf-potd] problem refresh after rating change failed:", err.message);
    }

    if (settingsPanelInstance) {
      settingsPanelInstance.updateUserData({ username: handle, rating: newRating });
    }
    if (window.refreshCalendar) window.refreshCalendar();
  } catch (err) {
    console.warn("[cf-potd] background sync failed (non-critical):", err.message);
  }
}

// ---------- setup form ----------

function showSetupForm() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) {
    console.error("[cf-potd] sidebar not found, cannot show setup form");
    return;
  }

  const setupForm = new window.SetupForm();
  setupForm.onSetupComplete = async () => {
    try {
      setupForm.destroy();
      // Let the DOM settle before re-rendering where the form just was.
      await new Promise((resolve) => setTimeout(resolve, 100));
      await createCalendar();
      await initializeSettingsPanel();
    } catch (error) {
      console.error("[cf-potd] setup completion failed:", error);
      alert("Error loading calendar. Please refresh the page.");
    }
  };

  sidebar.insertAdjacentElement("afterbegin", setupForm.render());
}

// ---------- settings panel ----------

async function initializeSettingsPanel() {
  if (settingsPanelInstance) settingsPanelInstance.destroy();

  const userData = await window.storage.get(window.storageKeys.USER_DATA);
  const userInfo = await window.storage.get(window.storageKeys.USER_INFO);

  settingsPanelInstance = new window.SettingsPanel({
    username: userData?.username || "Unknown",
    rating: extractUserRating(userInfo)
  });
  document.body.appendChild(settingsPanelInstance.render());
}

function addSettingsIcon() {
  const calendarHeader = document.querySelector(".calendar-header th");
  if (!calendarHeader) {
    console.warn("[cf-potd] calendar header not found");
    return;
  }
  if (calendarHeader.querySelector(".calendar-settings-icon")) return;

  const settingsBtn = document.createElement("button");
  settingsBtn.className = "calendar-settings-icon";
  settingsBtn.innerHTML = "⚙️";
  settingsBtn.title = "Settings";
  settingsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (settingsPanelInstance) settingsPanelInstance.open();
  });

  const headerText = calendarHeader.innerHTML;
  calendarHeader.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span>${headerText}</span>
      <span style="margin-left: auto;"></span>
    </div>
  `;
  calendarHeader.querySelector("span:last-child").appendChild(settingsBtn);
}

// ---------- calendar ----------

async function createCalendar() {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getUTCFullYear();
    const currentMonth = currentDate.getUTCMonth();
    const displayMonth = currentMonth + 1;

    const result = await window.storage.getMultiple([
      window.storageKeys.PROBLEM_DATA,
      window.storageKeys.USER_INFO,
      window.storageKeys.USER_DATA
    ]);

    const problemData = result.problemData || [];
    const userHandle = extractUserHandle(result.userInfo, result.userData);

    if (userHandle !== "Unknown") {
      try {
        await window.streak.syncStreakDaysWithDatabase(userHandle);
      } catch (error) {
        window.errorHandler.logError("createCalendar_syncStreak", error);
      }

      try {
        if (await window.streak.shouldResetStreak()) {
          console.log("[cf-potd] auto-resetting streak due to gap");
          const updatedUser = await window.api.updateUserStreak(userHandle, 0);
          if (updatedUser) {
            await window.storage.set(window.storageKeys.USER_INFO, [updatedUser]);
          }
        }
      } catch (error) {
        window.errorHandler.logError("createCalendar_streakCheck", error);
      }
    }

    if (!window.cfPotdIsRefreshing && userHandle !== "Unknown") {
      await maybeVerifyTodaysSubmission(userHandle, problemData);
    }

    const streakCount = await computeStreakCount(result.userInfo);

    const calendarHTML = buildCalendarHTML({
      currentYear, currentMonth, displayMonth,
      userHandle, streakCount, problemData,
      referenceDate: currentDate.getUTCDate()
    });

    injectCalendar(calendarHTML);
  } catch (error) {
    window.errorHandler.logError("createCalendar", error);
  } finally {
    window.cfPotdIsRefreshing = false;
  }

  markCalendarBasedOnStreak();
}

async function maybeVerifyTodaysSubmission(userHandle, problemData) {
  try {
    const todayISO = window.dateUtils.getTodayISO();
    const todaysProblem = problemData.find((p) => {
      if (!p || !p.date) return false;
      return p.date.split("T")[0] === todayISO;
    });
    if (!todaysProblem) return;

    const lastSolvedDate = await window.storage.get(window.storageKeys.LAST_SOLVED_DATE);
    if (lastSolvedDate === todayISO) {
      window.log.debug(`[cf-potd] today already verified (${todayISO})`);
      return;
    }

    const result = await window.api.verifySubmission(userHandle, todaysProblem);
    if (result.verified) {
      console.log("[cf-potd] today's submission verified, updating streak");
      await window.storage.set(window.storageKeys.LAST_SOLVED_DATE, todayISO);
      await updateStreakAfterVerification(userHandle, todaysProblem);
    }
  } catch (error) {
    console.error("[cf-potd] submission check failed:", error);
  }
}

async function computeStreakCount(userInfo) {
  try {
    return await window.streak.getCurrentStreak();
  } catch (error) {
    console.error("[cf-potd] streak calc failed, falling back to cached:", error.message);
    const user = unwrapUser(userInfo);
    const cached = user?.streak?.last_streak_count;
    if (cached === undefined) return 0;
    return typeof cached === "number" ? cached : parseInt(cached, 10) || 0;
  }
}

function buildCalendarHTML({ currentYear, currentMonth, displayMonth, userHandle, streakCount, problemData, referenceDate }) {
  const firstDay = new Date(Date.UTC(currentYear, currentMonth, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();

  const problemByDate = new Map();
  for (const p of problemData) {
    if (p && p.date) problemByDate.set(p.date.split("T")[0], p);
  }

  let html = `
    <div class="cf-potd-container">
      <table class="calendar">
        <tr class="calendar-header">
          <th colspan="7">${MONTH_NAMES[currentMonth]} ${currentYear}</th>
        </tr>
        <tr class="user-info-row">
          <td colspan="7">
            <div class="user-info">
              <a href="https://codeforces.com/profile/${userHandle}" target="_blank" class="user-handle">${userHandle}</a>
              <div class="streak-container">
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
  for (let i = 0; i < 6; i++) {
    html += "<tr>";
    for (let j = 0; j < 7; j++) {
      if (i === 0 && j < firstDay) {
        html += "<td></td>";
      } else if (day > daysInMonth) {
        html += "<td></td>";
      } else {
        const formattedMonth = displayMonth.toString().padStart(2, "0");
        const formattedDay = day.toString().padStart(2, "0");
        const isoDate = `${currentYear}-${formattedMonth}-${formattedDay}`;

        const cellClass = day < referenceDate ? "past"
          : day === referenceDate ? "today"
          : "future";

        const url = problemByDate.get(isoDate)?.url || "";
        const cellContent = (url && day <= referenceDate)
          ? `<a href="${url}" target="_blank">${day}</a>`
          : day;

        html += `<td class="${cellClass}" data-date="${isoDate}">${cellContent}</td>`;
        day++;
      }
    }
    html += "</tr>";
    if (day > daysInMonth && i < 5) {
      html += "<tr>" + "<td></td>".repeat(7) + "</tr>";
    }
  }
  html += "</table></div>";
  return html;
}

function injectCalendar(calendarHTML) {
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
  if (!sidebar) {
    console.error("[cf-potd] sidebar element not found");
    return;
  }

  const existing = sidebar.querySelector(".calendar");
  if (existing) {
    existing.closest(".cf-potd-container")?.remove();
  }
  sidebar.insertAdjacentHTML("afterbegin", calendarHTML);
  addSettingsIcon();
}

window.refreshCalendar = function () {
  if (window.cfPotdIsRefreshing) return;
  window.cfPotdIsRefreshing = true;

  document.querySelector(".cf-potd-container")?.remove();
  createCalendar();
};

// ---------- streak post-verification ----------

async function updateStreakAfterVerification(userHandle) {
  try {
    const shouldReset = await window.streak.shouldResetStreak();
    const newStreak = shouldReset
      ? 1
      : (await window.streak.getCurrentStreak()) + 1;

    const updatedUser = await window.api.updateUserStreak(userHandle, newStreak, true);
    await window.storage.set(window.storageKeys.USER_INFO, [updatedUser]);

    updateStreakUI(newStreak);
    markCalendarTick();

    await window.streak.syncStreakDaysWithDatabase(userHandle);
    return { success: true, newStreak, wasReset: shouldReset };
  } catch (error) {
    console.error("[cf-potd] updateStreakAfterVerification failed:", error);
    return { success: false, error: error.message };
  }
}

function appendCheckmark(cell) {
  if (cell.innerHTML.includes("✔")) return;
  const anchor = cell.querySelector("a");
  if (anchor) {
    anchor.insertAdjacentHTML("afterend", ' <span class="checkmark">✔</span>');
  } else {
    cell.innerHTML += ' <span class="checkmark">✔</span>';
  }
}

function markCalendarTick() {
  const todayISO = window.dateUtils.getTodayISO();
  document.querySelectorAll(".calendar td").forEach((cell) => {
    if (cell.getAttribute("data-date") === todayISO) {
      cell.classList.add("solved");
      appendCheckmark(cell);
    }
  });
}

/**
 * Mark cells for every date the user has solved, based on streak data.
 * Uses getDatesToMarkSolved() first; falls back to reading streak_days
 * directly from storage if that returns empty (handles upgrade paths where
 * the two data sources temporarily disagree).
 */
async function markCalendarBasedOnStreak() {
  try {
    const datesToMark = await window.streak.getDatesToMarkSolved();
    const cells = document.querySelectorAll(".calendar td");

    if (datesToMark.length === 0) {
      const streakDays = unwrapUser(
        await window.storage.get(window.storageKeys.USER_INFO)
      )?.streak?.streak_days || {};

      if (Object.keys(streakDays).length === 0) return;

      cells.forEach((cell) => {
        const cellDate = cell.getAttribute("data-date");
        if (!cellDate) return;
        const [y, m, d] = cellDate.split("-");
        const keys = [
          `${y}-${m.replace(/^0/, "")}-${d.replace(/^0/, "")}`,
          `${y}-${parseInt(m, 10)}-${parseInt(d, 10)}`,
          `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
        ];
        if (keys.some((k) => streakDays[k] === true)) {
          cell.classList.add("solved");
          appendCheckmark(cell);
        }
      });
      return;
    }

    cells.forEach((cell) => {
      const cellDate = cell.getAttribute("data-date");
      if (cellDate && datesToMark.includes(cellDate)) {
        cell.classList.add("solved");
        appendCheckmark(cell);
      }
    });
  } catch (error) {
    window.errorHandler.logError("markCalendarBasedOnStreak", error);
  }
}

function updateStreakUI(streak) {
  const streakElem = document.getElementById("calendar-streak");
  if (streakElem) streakElem.textContent = streak;
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
    if (settingsPanelInstance) settingsPanelInstance.open();
    sendResponse({ success: true });
  }
  return true;
});
