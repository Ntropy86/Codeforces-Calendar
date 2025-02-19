// Recalculate the current monthly streak by fetching the last 50 submissions and matching them against problemData
async function recalcMonthlyStreak(userHandle, problemData) {
  try {
    const response = await fetch(`https://codeforces.com/api/user.status?handle=${userHandle}&count=50`);
    const data = await response.json();
    if (data.status !== "OK") {
      console.error("recalcMonthlyStreak: Error fetching submissions", data);
      return 0;
    }
    const submissions = data.result;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Filter submissions to those made in the current month.
    const monthSubmissions = submissions.filter(sub => {
      const subDate = new Date(sub.creationTimeSeconds * 1000);
      return subDate.getFullYear() === currentYear && subDate.getMonth() === currentMonth;
    });

    let streak = 0;
    let day = new Date(now); // start from today
    while (true) {
      const isoDay = day.toISOString().split("T")[0];
      // Find the problem scheduled for this day from stored problemData
      const todaysProblem = problemData.find(p => p.date.split("T")[0] === isoDay);
      if (!todaysProblem) break; // no problem scheduled means stop
      // Check for an accepted submission matching this day’s POTD
      const solved = monthSubmissions.some(sub => {
        const subISO = new Date(sub.creationTimeSeconds * 1000).toISOString().split("T")[0];
        return subISO === isoDay &&
               sub.problem.contestId === todaysProblem.problem.contestId &&
               sub.problem.index === todaysProblem.problem.index &&
               sub.verdict === "OK";
      });
      if (solved) {
        streak++;
      } else {
        break;
      }
      day.setDate(day.getDate() - 1);
      if (day.getMonth() !== currentMonth) break;
    }
    return streak;
  } catch (err) {
    console.error("recalcMonthlyStreak error:", err);
    return 0;
  }
}

// Render the calendar with problem hyperlinks (only for past/current dates) and recalc the monthly streak on each render.
function createCalendar() {
  console.log("createCalendar: Called");
  var currentDate = new Date();
  var slicedDate = currentDate.toISOString().split("T")[0];
  console.log("Current date (ISO):", slicedDate);

  var currentYear = currentDate.getFullYear();
  var currentMonth = currentDate.getMonth();
  var displayMonth = currentMonth + 1; // Adjust for display

  var monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Retrieve problemData and userInfo from storage; then recalc the streak.
  chrome.storage.local.get(["problemData", "userInfo"], async function (result) {
    console.log("createCalendar: Retrieved storage data", result);
    var problemData = result.problemData || [];
    var userHandle = (result.userInfo && result.userInfo[0].handle) || "Unknown";
    var streak = await recalcMonthlyStreak(userHandle, problemData);
    console.log("createCalendar: Calculated streak =", streak);

    var calendarHTML = '<table style="width:100%" class="calendar">';
    calendarHTML += '<tr><th colspan="7">' + monthNames[currentMonth] + ' ' + currentYear + '</th></tr>';
    calendarHTML += '<tr><td colspan="7">Active user: ' + userHandle + ' | Current Monthly Streak: <span id="calendar-streak">' + streak + '</span></td></tr>';
    calendarHTML += '<tr><th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th></tr>';

    // Determine first day and number of days in the month
    var firstDay = new Date(currentYear, currentMonth, 1).getDay();
    var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    var day = 1;
    var referenceDate = currentDate.getDate(); // today's day-of-month

    for (var i = 0; i < 6; i++) {
      calendarHTML += "<tr>";
      for (var j = 0; j < 7; j++) {
        if (i === 0 && j < firstDay) {
          calendarHTML += "<td></td>";
        } else if (day > daysInMonth) {
          break;
        } else {
          var formattedMonth = displayMonth.toString().padStart(2, "0");
          var formattedDay = day.toString().padStart(2, "0");
          var isoDate = currentYear + '-' + formattedMonth + '-' + formattedDay;
          
          // Reset URL for this day.
          var url = "";
          if (problemData) {
            var filteredProblems = problemData.filter(function (problem) {
              var problemDate = problem.date.split("T")[0];
              return problemDate == isoDate;
            });
            if (filteredProblems.length > 0) {
              url = filteredProblems[0].url;
            }
          }
          
          // Only hyperlink if a URL exists and the day is today or in the past.
          var cellContent = (url && day <= referenceDate) ? '<a href="' + url + '" target="_blank">' + day + '</a>' : day;
          calendarHTML += '<td data-date="' + isoDate + '">' + cellContent + '</td>';
          day++;
        }
      }
      calendarHTML += "</tr>";
      if (day > daysInMonth) break;
    }
    calendarHTML += "</table>";

    var sidebar = document.getElementById("sidebar");
    if (sidebar) {
      var existingCalendar = sidebar.querySelector(".calendar");
      if (existingCalendar) {
        sidebar.removeChild(existingCalendar);
        console.log("createCalendar: Removed existing calendar.");
      }
      sidebar.insertAdjacentHTML("afterbegin", calendarHTML);
      console.log("createCalendar: Calendar injected successfully.");
    } else {
      console.error("createCalendar: Sidebar element not found.");
    }
  });
  console.log("createCalendar: End of function (waiting for storage callback).");
  addSubmitListeners();
}

// Mark today's cell as solved by adding a check mark.
function markCalendarTick() {
  console.log("markCalendarTick: Marking today's cell as solved.");
  var todayISO = new Date().toISOString().split("T")[0];
  var calendarCells = document.querySelectorAll(".calendar td");
  calendarCells.forEach(function(cell) {
    if (cell.getAttribute("data-date") === todayISO) {
      cell.classList.add("solved");
      if (!cell.innerHTML.includes("✔")) {
        cell.innerHTML += " ✔";
      }
      console.log("markCalendarTick: Marked cell for", todayISO);
    }
  });
}

// Update the streak UI in the calendar header.
function updateStreakUI(streak) {
  console.log("updateStreakUI: Updating streak UI to", streak);
  var streakElem = document.getElementById("calendar-streak");
  if (streakElem) {
    streakElem.textContent = streak;
  } else {
    console.warn("updateStreakUI: Streak element not found.");
  }
}

// Attach event listeners to elements with the class "submit" using try/catch.
function addSubmitListeners() {
  try {
    var submitButtons = document.querySelectorAll('.submit');
    console.log("addSubmitListeners: Found", submitButtons.length, "submit buttons.");
    if (submitButtons.length === 0) {
      console.log("addSubmitListeners: No submit buttons found on this page.");
      return;
    }
    submitButtons.forEach(function(button) {
      button.addEventListener("click", handleSubmit);
    });
    console.log("addSubmitListeners: Event listeners attached.");
  } catch (error) {
    console.error("addSubmitListeners: Error attaching listeners:", error);
  }
}

// When a submit button is clicked, poll the API for today's POTD submission.
function handleSubmit(event) {
  console.log("handleSubmit: Submit button clicked.");
  chrome.storage.local.get(["userInfo", "problemData"], function(result) {
    console.log("handleSubmit: Retrieved data", result);
    var userInfo = result.userInfo;
    var problemData = result.problemData;
    if (!userInfo || !problemData) {
      console.error("handleSubmit: Missing userInfo or problemData.");
      return;
    }
    var userHandle = userInfo[0].handle;
    var todayISO = new Date().toISOString().split("T")[0];
    var todaysProblem = problemData.find(function(problem) {
      return problem.date.split("T")[0] === todayISO;
    });
    if (!todaysProblem) {
      console.error("handleSubmit: Today's problem not found.");
      return;
    }
    pollForSubmission(userHandle, todaysProblem);
  });
}

// Poll the API every 2 seconds (up to 20 seconds) for an accepted submission for today's POTD.
function pollForSubmission(userHandle, todaysProblem) {
  var attempts = 0;
  var maxAttempts = 10;
  var interval = 2000;
  console.log("pollForSubmission: Starting polling for", userHandle);
  var pollInterval = setInterval(async function() {
    attempts++;
    console.log("pollForSubmission: Attempt", attempts);
    try {
      var response = await fetch("https://codeforces.com/api/user.status?handle=" + userHandle + "&from=1&count=1");
      var data = await response.json();
      console.log("pollForSubmission: API response", data);
      if (data.status !== "OK") {
        console.error("pollForSubmission: API error", data);
        return;
      }
      if (data.result && data.result.length > 0) {
        var latestSubmission = data.result[0];
        if (latestSubmission.problem.contestId === todaysProblem.problem.contestId &&
            latestSubmission.problem.index === todaysProblem.problem.index &&
            latestSubmission.verdict === "OK") {
          console.log("pollForSubmission: Found accepted submission for today's POTD.");
          clearInterval(pollInterval);
          updateStreakForToday(userHandle);
          markCalendarTick();
        }
      }
    } catch (error) {
      console.error("pollForSubmission: Error during polling:", error);
    }
    if (attempts >= maxAttempts) {
      clearInterval(pollInterval);
      console.log("pollForSubmission: Polling ended without a successful submission.");
    }
  }, interval);
}

// Update the streak UI by recalculating the streak only if today's submission hasn't been recorded yet.
// We use the "lastSolvedDate" flag (stored in chrome.storage) to check for repetitive submissions.
async function updateStreakForToday(userHandle) {
  const todayISO = new Date().toISOString().split("T")[0];
  chrome.storage.local.get(["lastSolvedDate", "problemData"], async function(result) {
    if (result.lastSolvedDate === todayISO) {
      console.log("updateStreakForToday: Today's submission already recorded (flag set).");
      return;
    }
    var problemData = result.problemData || [];
    const newStreak = await recalcMonthlyStreak(userHandle, problemData);
    console.log("updateStreakForToday: New streak calculated:", newStreak);
    // Update the flag to prevent repetitive updates
    chrome.storage.local.set({ lastSolvedDate: todayISO }, function() {
      console.log("updateStreakForToday: lastSolvedDate updated to", todayISO);
    });
    updateStreakUI(newStreak);
  });
}


  console.log("DOMContentLoaded: Initializing calendar and submit listeners.");
  createCalendar();
 

