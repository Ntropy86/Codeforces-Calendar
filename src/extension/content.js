/**
 * Main content script for Codeforces POTD extension
 */

// Render the calendar with problem hyperlinks
async function createCalendar() {
  console.log("createCalendar: Called");
  try {
    const currentDate = new Date();
    const slicedDate = currentDate.toISOString().split("T")[0];
    console.log("Current date (ISO):", slicedDate);

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const displayMonth = currentMonth + 1; // Adjust for display

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    // Retrieve all needed data from storage
    const result = await window.storage.getMultiple([
      window.storageKeys.PROBLEM_DATA, 
      window.storageKeys.USER_INFO, 
      window.storageKeys.USER_DATA
    ]);
    
    console.log("createCalendar: Retrieved storage data", result);
    console.log("Raw userInfo:", result.userInfo);
    
    const problemData = result.problemData || [];
    console.log("Problem data:", problemData);
    
    // Extract user handle from multiple possible sources
    let userHandle = "Unknown";
    
    // Check userInfo first (backend data)
    if (result.userInfo && Array.isArray(result.userInfo) && result.userInfo.length > 0) {
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
    
    // Get streak count directly from userInfo (the database source of truth)
    let streakCount = 0;
    if (result.userInfo && Array.isArray(result.userInfo) && result.userInfo.length > 0) {
      const user = result.userInfo[0];
      console.log("User info for streak:", user);
      console.log("DEBUG :", user[0].rating);
      console.log("DEBUG :", user[0].streak.last_streak_count);
      if (user[0].streak && user[0].streak.last_streak_count !== undefined) {
        if (typeof user[0].streak.last_streak_count === 'number') {
          streakCount = user[0].streak.last_streak_count;
        } else {
          streakCount = parseInt(user[0].streak.last_streak_count);
        }
        console.log("Using streak directly from userInfo:", streakCount);
      }
    }
    console.log("Final streak for calendar:", streakCount);

    // Render the calendar HTML
    let calendarHTML = `
    <div class="cf-potd-container">
      <table class="calendar">
        <tr class="calendar-header">
          <th colspan="7">${monthNames[currentMonth]} ${currentYear}</th>
        </tr>
        <tr class="user-info-row">
          <td colspan="7">
            <div class="user-info">
              <span class="user-handle">${userHandle}</span>
              <div class="streak-container">
                <span class="streak-flame">🔥</span>
                <span id="calendar-streak" class="streak-count">${streakCount}</span>
                <span class="streak-label">day streak</span>
              </div>
            </div>
          </td>
        </tr>
        <tr class="day-header">
          <th>Sun</th>
          <th>Mon</th>
          <th>Tue</th>
          <th>Wed</th>
          <th>Thu</th>
          <th>Fri</th>
          <th>Sat</th>
        </tr>
    `;

    // Determine first day and number of days in the month
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    let day = 1;
    const referenceDate = currentDate.getDate(); // today's day-of-month

    for (let i = 0; i < 6; i++) {
      calendarHTML += "<tr>";
      for (let j = 0; j < 7; j++) {
        if (i === 0 && j < firstDay) {
          calendarHTML += "<td></td>";
        } else if (day > daysInMonth) {
          break;
        } else {
          const formattedMonth = displayMonth.toString().padStart(2, "0");
          const formattedDay = day.toString().padStart(2, "0");
          const isoDate = `${currentYear}-${formattedMonth}-${formattedDay}`;
          
          // Find problem for this day
          let url = "";
          let cellClass = "";
          
          if (day < referenceDate) {
            cellClass = "past";
          } else if (day === referenceDate) {
            cellClass = "today";
          } else {
            cellClass = "future";
          }
          
          if (problemData && problemData.length > 0) {
            const filteredProblems = problemData.filter(function(problem) {
              if (!problem || !problem.date) return false;
              const problemDate = problem.date.split("T")[0];
              return problemDate === isoDate;
            });
            
            if (filteredProblems.length > 0 && filteredProblems[0].url) {
              url = filteredProblems[0].url;
            }
          }
          
          // Only hyperlink if a URL exists and the day is today or in the past
          const cellContent = (url && day <= referenceDate) 
            ? `<a href="${url}" target="_blank">${day}</a>` 
            : day;
          
          calendarHTML += `<td class="${cellClass}" data-date="${isoDate}">${cellContent}</td>`;
          day++;
        }
      }
      calendarHTML += "</tr>";
      if (day > daysInMonth) break;
    }
    calendarHTML += "</table></div>";

    // Find or create the sidebar element
    let sidebar = document.getElementById("sidebar");
    if (!sidebar) {
      // If sidebar doesn't exist, create a new one
      const pageContent = document.querySelector('.content-with-sidebar');
      if (pageContent) {
        sidebar = document.createElement('div');
        sidebar.id = 'sidebar';
        sidebar.className = 'sidebar';
        pageContent.appendChild(sidebar);
      }
    }
    
    if (sidebar) {
      const existingCalendar = sidebar.querySelector(".calendar");
      if (existingCalendar) {
        const container = existingCalendar.closest('.cf-potd-container');
        if (container) {
          container.remove();
          console.log("createCalendar: Removed existing calendar.");
        }
      }
      sidebar.insertAdjacentHTML("afterbegin", calendarHTML);
      console.log("createCalendar: Calendar injected successfully.");
    } else {
      console.error("createCalendar: Sidebar element not found.");
    }
  } catch (error) {
    window.errorHandler.logError('createCalendar', error);
  }
  
  // Add submit listeners after calendar is created
  addSubmitListeners();
}

// Mark today's cell as solved
function markCalendarTick() {
  console.log("markCalendarTick: Marking today's cell as solved.");
  const todayISO = window.dateUtils.getTodayISO();
  const calendarCells = document.querySelectorAll(".calendar td");
  
  calendarCells.forEach(function(cell) {
    if (cell.getAttribute("data-date") === todayISO) {
      cell.classList.add("solved");
      
      // Only add checkmark if it doesn't already have one
      if (!cell.innerHTML.includes("✔")) {
        // If the cell has a link, add checkmark after the link
        if (cell.querySelector('a')) {
          cell.querySelector('a').insertAdjacentHTML('afterend', ' <span class="checkmark">✔</span>');
        } else {
          cell.innerHTML += ' <span class="checkmark">✔</span>';
        }
      }
      console.log("markCalendarTick: Marked cell for", todayISO);
    }
  });
}

// Update the streak UI in the calendar
function updateStreakUI(streak) {
  console.log("updateStreakUI: Updating streak UI to", streak);
  const streakElem = document.getElementById("calendar-streak");
  if (streakElem) {
    console.log("Found streak element, updating to:", streak);
    streakElem.textContent = streak;
  } else {
    console.warn("updateStreakUI: Streak element not found.");
  }
}

// Attach event listeners to submit buttons
function addSubmitListeners() {
  try {
    const submitButtons = document.querySelectorAll('.submit');
    console.log("addSubmitListeners: Found", submitButtons.length, "submit buttons.");
    
    if (submitButtons.length === 0) {
      console.log("addSubmitListeners: No submit buttons found on this page.");
      return;
    }
    
    // Remove existing listeners first to prevent duplicates
    submitButtons.forEach(function(button) {
      const clone = button.cloneNode(true);
      button.parentNode.replaceChild(clone, button);
    });
    
    // Add new listeners
    document.querySelectorAll('.submit').forEach(function(button) {
      button.addEventListener("click", handleSubmit);
    });
    
    console.log("addSubmitListeners: Event listeners attached.");
  } catch (error) {
    window.errorHandler.logError('addSubmitListeners', error);
  }
}

// Handle submit button click
async function handleSubmit(event) {
  console.log("handleSubmit: Submit button clicked.");
  try {
    // Get required data from storage
    const data = await window.storage.getMultiple([
      window.storageKeys.USER_INFO,
      window.storageKeys.PROBLEM_DATA,
      window.storageKeys.USER_DATA
    ]);
    
    console.log("handleSubmit: Retrieved data", data);
    
    // Get user handle from multiple possible sources
    let userHandle = "Unknown";
    
    // Check userInfo first (backend data)
    if (data.userInfo && Array.isArray(data.userInfo) && data.userInfo.length > 0) {
      const user = data.userInfo[0];
      if (user.userID) {
        userHandle = user.userID;
      }
    }
    
    // If still Unknown, try userData (what user entered)
    if (userHandle === "Unknown" && data.userData && data.userData.username) {
      userHandle = data.userData.username;
    }
    
    if (userHandle === "Unknown") {
      window.errorHandler.displayError("Could not determine user handle");
      return;
    }
    
    const problemData = data.problemData;
    if (!problemData || !Array.isArray(problemData)) {
      window.errorHandler.displayError("Missing or invalid problemData");
      return;
    }
    
    const todayISO = window.dateUtils.getTodayISO();
    const todaysProblem = problemData.find(function(problem) {
      return problem && problem.date && problem.date.split("T")[0] === todayISO;
    });
    
    if (!todaysProblem) {
      window.errorHandler.displayError("Today's problem not found");
      return;
    }
    
    // Start polling for submission
    pollForSubmission(userHandle, todaysProblem);
  } catch (error) {
    window.errorHandler.logError('handleSubmit', error);
  }
}

// Poll for submissions
function pollForSubmission(userHandle, todaysProblem) {
  const maxAttempts = 10;
  const interval = 2000;
  let attempts = 0;
  
  console.log("pollForSubmission: Starting polling for", userHandle);
  
  // Show polling status to user
  const statusDiv = document.createElement('div');
  statusDiv.className = 'cf-potd-status';
  statusDiv.textContent = 'Checking submission...';
  document.body.appendChild(statusDiv);
  
  const pollInterval = setInterval(async function() {
    attempts++;
    console.log("pollForSubmission: Attempt", attempts);
    
    // Update status indicator
    statusDiv.textContent = `Checking submission... (${attempts}/${maxAttempts})`;
    
    try {
      // Use our API wrapper with retry logic
      const result = await window.api.verifySubmission(userHandle, todaysProblem);
      
      if (result.verified) {
        console.log("pollForSubmission: Found accepted submission for today's POTD.");
        clearInterval(pollInterval);
        
        // Update status
        statusDiv.textContent = 'Submission verified! Updating streak...';
        statusDiv.style.backgroundColor = '#c8e6c9';
        
        // Update streak
        const streakResult = await window.streak.validateAndUpdateStreak(userHandle, todaysProblem);
        
        if (streakResult.success) {
          updateStreakUI(streakResult.newStreak);
          markCalendarTick();
          
          // Final status update
          statusDiv.textContent = `Streak updated to ${streakResult.newStreak}!`;
          setTimeout(() => {
            statusDiv.remove();
          }, 3000);
        } else {
          statusDiv.textContent = `Error updating streak: ${streakResult.reason}`;
          statusDiv.style.backgroundColor = '#ffcdd2';
          setTimeout(() => {
            statusDiv.remove();
          }, 3000);
        }
      }
    } catch (error) {
      console.error("pollForSubmission: Error during polling:", error);
    }
    
    if (attempts >= maxAttempts) {
      clearInterval(pollInterval);
      console.log("pollForSubmission: Polling ended without a successful submission.");
      
      // Update status
      statusDiv.textContent = 'No accepted submission found. Try again later.';
      statusDiv.style.backgroundColor = '#fff9c4';
      setTimeout(() => {
        statusDiv.remove();
      }, 3000);
    }
  }, interval);
}

// Initialize on load
console.log("DOMContentLoaded: Initializing calendar and submit listeners.");

// Check if we're on a Codeforces page
if (window.location.href.includes("codeforces.com")) {
  // Wait for page to fully load
  if (document.readyState === "complete") {
    createCalendar();
  } else {
    window.addEventListener("load", createCalendar);
  }
}