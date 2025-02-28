// Render the calendar with problem hyperlinks
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

  // Retrieve all needed data from storage
  chrome.storage.local.get(["problemData", "userInfo", "userData", "streakData"], async function (result) {
    console.log("createCalendar: Retrieved storage data", result);
    
    var problemData = result.problemData || [];
    console.log("Problem data:", problemData);
    
    // Extract user handle from multiple possible sources
    var userHandle = "Unknown";
    var streakCount = 0;
    
    // Check userInfo first (backend data)
    if (result.userInfo && result.userInfo.length > 0) {
      const user = result.userInfo[0];
      console.log("User info for calendar:", user);
      
      // Check for userID field first (backend format)
      if (user.userID) {
        userHandle = user.userID;
        console.log("Using userID from userInfo:", userHandle);
      }
    }
    
    // If still Unknown, try userData (what the user entered)
    if (userHandle === "Unknown" && result.userData && result.userData.username) {
      userHandle = result.userData.username;
      console.log("Using username from userData:", userHandle);
    }
    
    // First check for streak in streakData (what we stored from popup)
    if (result.streakData && typeof result.streakData.streak === 'number') {
      streakCount = result.streakData.streak;
      console.log("Using streak from streakData:", streakCount);
    }
    // Then try userInfo object
    else if (result.userInfo && result.userInfo[0]) {
      const user = result.userInfo[0];
      
      // Check if streak data is in streak object
      if (user.streak && typeof user.streak.last_streak_count === 'number') {
        streakCount = user.streak.last_streak_count;
        console.log("Using streak from userInfo.streak.last_streak_count:", streakCount);
      }
      // Check if it's a string that needs parsing
      else if (user.streak && user.streak.last_streak_count) {
        streakCount = parseInt(user.streak.last_streak_count);
        console.log("Using parsed streak from userInfo.streak.last_streak_count:", streakCount);
      }
    }
    
    console.log("Final handle for calendar:", userHandle);
    console.log("Final streak for calendar:", streakCount);
    
    // Store the streak
    chrome.storage.local.set({ streakData: { streak: streakCount, lastCalculated: currentDate.toISOString().split('T')[0] } });

    var calendarHTML = '<table style="width:100%" class="calendar">';
    calendarHTML += '<tr><th colspan="7">' + monthNames[currentMonth] + ' ' + currentYear + '</th></tr>';
    calendarHTML += '<tr><td colspan="7">Active user: ' + userHandle + ' | Current Monthly Streak: <span id="calendar-streak">' + streakCount + '</span></td></tr>';
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
          if (problemData && problemData.length > 0) {
            var filteredProblems = problemData.filter(function (problem) {
              if (!problem || !problem.date) return false;
              var problemDate = problem.date.split("T")[0];
              return problemDate == isoDate;
            });
            
            if (filteredProblems.length > 0 && filteredProblems[0].url) {
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

// Mark today's cell as solved
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

// Update the streak UI in the calendar
function updateStreakUI(streak) {
  console.log("updateStreakUI: Updating streak UI to", streak);
  var streakElem = document.getElementById("calendar-streak");
  if (streakElem) {
    streakElem.textContent = streak;
  } else {
    console.warn("updateStreakUI: Streak element not found.");
  }
}

// Attach event listeners to submit buttons
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

// Handle submit button click
function handleSubmit(event) {
  console.log("handleSubmit: Submit button clicked.");
  chrome.storage.local.get(["userInfo", "problemData", "userData"], function(result) {
    console.log("handleSubmit: Retrieved data", result);
    
    // Get user handle from multiple possible sources
    var userHandle = "Unknown";
    
    // Check userInfo first (backend data)
    if (result.userInfo && result.userInfo.length > 0) {
      const user = result.userInfo[0];
      if (user.userID) {
        userHandle = user.userID;
      }
    }
    
    // If still Unknown, try userData (what user entered)
    if (userHandle === "Unknown" && result.userData && result.userData.username) {
      userHandle = result.userData.username;
    }
    
    if (userHandle === "Unknown") {
      console.error("handleSubmit: Could not determine user handle");
      return;
    }
    
    var problemData = result.problemData;
    if (!problemData) {
      console.error("handleSubmit: Missing problemData.");
      return;
    }
    
    var todayISO = new Date().toISOString().split("T")[0];
    var todaysProblem = problemData.find(function(problem) {
      return problem && problem.date && problem.date.split("T")[0] === todayISO;
    });
    
    if (!todaysProblem) {
      console.error("handleSubmit: Today's problem not found.");
      return;
    }
    
    pollForSubmission(userHandle, todaysProblem);
  });
}

// Poll for submissions
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

// Update streak for today's submission - using backend only
async function updateStreakForToday(userHandle) {
  const todayISO = new Date().toISOString().split("T")[0];
  chrome.storage.local.get(["lastSolvedDate", "streakData", "userInfo"], async function(result) {
    if (result.lastSolvedDate === todayISO) {
      console.log("updateStreakForToday: Today's submission already recorded (flag set).");
      return;
    }
    
    // Get current streak value from storage (backend value)
    let currentStreak = 0;
    
    // Check streakData first
    if (result.streakData && typeof result.streakData.streak === 'number') {
      currentStreak = result.streakData.streak;
    } 
    // Then userInfo 
    else if (result.userInfo && result.userInfo[0] && result.userInfo[0].streak) {
      if (typeof result.userInfo[0].streak.last_streak_count === 'number') {
        currentStreak = result.userInfo[0].streak.last_streak_count;
      } else if (result.userInfo[0].streak.last_streak_count) {
        currentStreak = parseInt(result.userInfo[0].streak.last_streak_count);
      }
    }
    
    // Increment streak by 1
    const newStreak = currentStreak + 1;
    console.log("updateStreakForToday: Incrementing streak from", currentStreak, "to", newStreak);
    
    // Update streak in local storage
    chrome.storage.local.set({ 
      lastSolvedDate: todayISO,
      streakData: { streak: newStreak, lastCalculated: todayISO } 
    }, function() {
      console.log("updateStreakForToday: Local streak updated to", newStreak);
    });
    
    // Update UI
    updateStreakUI(newStreak);
    
    // Update streak in backend
    try {
      await window.api.updateUserStreak(userHandle, newStreak);
      console.log("updateStreakForToday: Backend streak updated successfully to", newStreak);
    } catch (error) {
      console.error("updateStreakForToday: Error updating backend streak:", error);
    }
  });
}

// Initialize on load
console.log("DOMContentLoaded: Initializing calendar and submit listeners.");
createCalendar();