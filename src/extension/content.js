/**
 * Main content script for Codeforces POTD extension
 */

// Track if calendar is already being refreshed to prevent loops
// Use window property instead of local variable to avoid redeclaration errors
if (typeof window.cfPotdIsRefreshing === 'undefined') {
  window.cfPotdIsRefreshing = false;
}

// Define createCalendar function first before it's referenced
async function createCalendar() {
  console.log("createCalendar: Called");
  try {
    window.dateUtils.logDateDebugInfo();
    
    const currentDate = new Date();
    const slicedDate = window.dateUtils.getTodayISO(); // Use the updated UTC method
    console.log("Current date (ISO UTC):", slicedDate);

    const currentYear = currentDate.getUTCFullYear(); // Use UTC year
    const currentMonth = currentDate.getUTCMonth(); // Use UTC month
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
      if (result.userInfo[0] && Array.isArray(result.userInfo[0]) && result.userInfo[0].length > 0) {
        const user = result.userInfo[0][0];
        console.log("User info for calendar:", user);
        
        // Check for userID field first (backend format)
        if (user && user.userID) {
          userHandle = user.userID;
          console.log("Using userID from userInfo:", userHandle);
        }
      }
    }
    
    // If still Unknown, try userData (what the user entered)
    if (userHandle === "Unknown" && result.userData && result.userData.username) {
      userHandle = result.userData.username;
      console.log("Using username from userData:", userHandle);
    }

    // Synchronize streak days with database last_streak_date
    if (userHandle !== "Unknown") {
      try {
        await window.streak.syncStreakDaysWithDatabase(userHandle);
      } catch (error) {
        window.errorHandler.logError('createCalendar_syncStreak', error);
      }
    }
    
    // Check if streak should be reset and do it automatically
    if (userHandle !== "Unknown") {
      try {
        const shouldReset = await window.streak.shouldResetStreak();
        if (shouldReset) {
          console.log("Streak was automatically reset due to gap in solving");
          // Only reset the streak count, don't update the streak date
          const streakCount = 0;
          const updatedUser = await window.api.updateUserStreak(userHandle, streakCount);
          
          // Update local storage with the reset user data
          if (updatedUser) {
            await window.storage.set(window.storageKeys.USER_INFO, [updatedUser]);
            console.log("Streak reset in backend:", updatedUser);
          }
        }
      } catch (error) {
        window.errorHandler.logError('createCalendar_streakCheck', error);
      }
    }

    if (!window.cfPotdIsRefreshing && userHandle !== "Unknown") {
      try {
        const todayISO = window.dateUtils.getTodayISO(); // This now uses the UTC method
        console.log("Today's ISO date for submission check:", todayISO);
        
        const todaysProblem = problemData.find(function(problem) {
          if (!problem || !problem.date) return false;
          const problemDate = problem.date.split("T")[0];
          return problemDate === todayISO;
        });
        
        console.log("TODAYYYYYY", userHandle, todayISO, todaysProblem ? "Found today's problem" : "No problem for today");
        
        if (todaysProblem) {
          // Check if already verified to avoid unnecessary API calls
          const lastSolvedDate = await window.storage.get(window.storageKeys.LAST_SOLVED_DATE);
          if (lastSolvedDate !== todayISO) {
            console.log("Checking for today's submission, not verified yet");
            // Use our API wrapper with retry logic to check submission
            const result = await window.api.verifySubmission(userHandle, todaysProblem);
            console.log("RESULT checkForTodaySubmission: Submission verification result", result);
            
            if (result.verified) {
              console.log('TODAY Submission verified! Updating streak...');
              
              // Mark the date as already checked to avoid redundant checks
              await window.storage.set(window.storageKeys.LAST_SOLVED_DATE, todayISO);
              
              // Update streak but don't trigger a refresh - we'll update the UI directly
              await updateStreakAfterVerification(userHandle, todaysProblem);
            }
          } else {
            console.log(`Today's submission already verified (${todayISO})`);
          }
        }
      } catch (error) {
        console.error("Error checking today's submission:", error);
      }
    }
    
    // Get streak count directly from userInfo (the database source of truth)
    let streakCount = 0;
    try {
      // Get the streak count dynamically instead of using the stored value
      streakCount = await window.streak.getCurrentStreak();
      console.log("Dynamically calculated streak for calendar:", streakCount);
    } catch (error) {
      console.error("Error getting dynamic streak count:", error);
      
      // Fallback to stored streak count if needed
      if (result.userInfo && Array.isArray(result.userInfo) && result.userInfo.length > 0 && result.userInfo[0].length > 0) {
        const user = result.userInfo[0][0];
        if (user && user.streak && user.streak.last_streak_count !== undefined) {
          if (typeof user.streak.last_streak_count === 'number') {
            streakCount = user.streak.last_streak_count;
          } else {
            streakCount = parseInt(user.streak.last_streak_count);
          }
          console.log("Falling back to stored streak count:", streakCount);
        }
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
          <th>Sun</th>
          <th>Mon</th>
          <th>Tue</th>
          <th>Wed</th>
          <th>Thu</th>
          <th>Fri</th>
          <th>Sat</th>
        </tr>
    `;

    // Determine first day and number of days in the month using UTC
    const firstDay = new Date(Date.UTC(currentYear, currentMonth, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();
    let day = 1;
    const referenceDate = currentDate.getUTCDate(); // today's day-of-month in UTC

    for (let i = 0; i < 6; i++) {
      calendarHTML += "<tr>";
      for (let j = 0; j < 7; j++) {
        if (i === 0 && j < firstDay) {
          calendarHTML += "<td></td>"; // Empty cell, no content
        } else if (day > daysInMonth) {
          calendarHTML += "<td></td>"; // Empty cell for days beyond this month
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
      if (day > daysInMonth && i < 5) {
        // Add empty row at the end if needed for consistent layout
        calendarHTML += "<tr>" + "<td></td>".repeat(7) + "</tr>";
      }
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
  } finally {
    // Reset the refreshing flag
    window.cfPotdIsRefreshing = false;
  }
  
  // Mark calendar based on streak data
  markCalendarBasedOnStreak();
}

// Define refreshCalendar after createCalendar is defined
window.refreshCalendar = function() {
  console.log("Refreshing calendar due to streak changes");
  
  // If already refreshing, don't start another refresh
  if (window.cfPotdIsRefreshing) {
    console.log("Calendar refresh already in progress, skipping");
    return;
  }
  
  // Set the refreshing flag to prevent loops
  window.cfPotdIsRefreshing = true;
  
  // Get the existing calendar and remove it
  const existingCalendar = document.querySelector(".cf-potd-container");
  if (existingCalendar) {
    existingCalendar.remove();
  }
  
  // Create a new calendar - the isRefreshing flag will prevent submission checks
  createCalendar();
};

// Update streak after verification without triggering a calendar refresh
async function updateStreakAfterVerification(userHandle, todaysProblem) {
  try {
    // Check if streak should be reset - THIS ONLY AFFECTS THE COUNTER, NOT THE HISTORY
    const shouldReset = await window.streak.shouldResetStreak();
    
    // Calculate new streak value based on whether we should reset the counter
    let newStreak;
    if (shouldReset) {
      // For a reset, start at 1 (today's solve)
      newStreak = 1;
      console.log("Resetting streak counter due to gap in solving");
    } else {
      // Otherwise increment
      const currentStreak = await window.streak.getCurrentStreak();
      newStreak = currentStreak + 1;
    }
    
    // We always want to update the date for a successful validation
    const updateDate = true;
    
    // Update backend with new streak count and mark today as solved
    const updatedUser = await window.api.updateUserStreak(userHandle, newStreak, updateDate);
    console.log("Updated user from backend:", updatedUser);
    
    // Update userInfo in local storage with fresh data from backend
    await window.storage.set(window.storageKeys.USER_INFO, [updatedUser]);
    
    // Update the streak UI in the calendar
    updateStreakUI(newStreak);
    
    // Mark today's cell as solved
    markCalendarTick();
    
    console.log(`Streak ${shouldReset ? "reset and " : ""}updated to ${newStreak}`);
    
    // Sync streak days with database
    await window.streak.syncStreakDaysWithDatabase(userHandle);
    
    return {
      success: true,
      newStreak: newStreak,
      wasReset: shouldReset
    };
  } catch (error) {
    console.error("Error updating streak after verification:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Mark today's cell as solved
function markCalendarTick() {
  console.log("markCalendarTick: Marking today's cell as solved.");
  const todayISO = window.dateUtils.getTodayISO();
  console.log("Today's ISO date for markCalendarTick:", todayISO);
  
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

// Mark calendar cells based on streak data
async function markCalendarBasedOnStreak() {
  console.log("markCalendarBasedOnStreak: Marking cells based on streak data");
  
  try {
    // Get dates to mark as solved from streak service
    const datesToMark = await window.streak.getDatesToMarkSolved();
    console.log("Dates to mark as solved:", datesToMark);
    
    // Get all calendar cells
    const calendarCells = document.querySelectorAll(".calendar td");
    console.log("Calendar cells found:", calendarCells.length);
    
    if (datesToMark.length === 0) {
      console.log("No dates to mark as solved - checking directly from userInfo");
      
      // As a fallback, try to get the user info directly
      const userInfo = await window.storage.get(window.storageKeys.USER_INFO);
      console.log("Raw userInfo in markCalendarBasedOnStreak:", userInfo);
      
      // Try to extract streak days directly
      let streakDays = {};
      
      if (userInfo && Array.isArray(userInfo) && userInfo.length > 0) {
        if (Array.isArray(userInfo[0]) && userInfo[0].length > 0) {
          const user = userInfo[0][0];
          if (user && user.streak && user.streak.streak_days) {
            streakDays = user.streak.streak_days;
            console.log("Directly extracted streak days:", streakDays);
          }
        } else if (userInfo[0] && userInfo[0].streak && userInfo[0].streak.streak_days) {
          streakDays = userInfo[0].streak.streak_days;
          console.log("Directly extracted streak days:", streakDays);
        }
      }
      
      // Mark days based on directly extracted streak days
      if (Object.keys(streakDays).length > 0) {
        calendarCells.forEach(function(cell) {
          const cellDate = cell.getAttribute("data-date");
          if (cellDate) {
            const cellParts = cellDate.split('-');
            const cellYear = cellParts[0];
            const cellMonth = cellParts[1].replace(/^0/, ''); // Remove leading zero
            const cellDay = cellParts[2].replace(/^0/, ''); // Remove leading zero
            
            // Check different formats of the day key
            const keyFormats = [
              `${cellYear}-${cellMonth}-${cellDay}`,
              `${cellYear}-${parseInt(cellMonth)}-${parseInt(cellDay)}`,
              `${cellYear}-${cellMonth.padStart(2, '0')}-${cellDay.padStart(2, '0')}`
            ];
            
            // Check if any key format is found in streakDays
            const isMarked = keyFormats.some(key => streakDays[key] === true);
            
            if (isMarked) {
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
              
              console.log("Marked cell for", cellDate);
            }
          }
        });
        
        return;
      }
    }
    
    // If we get here, we're using the dates from getDatesToMarkSolved
    // Mark each cell that matches a date to mark
    calendarCells.forEach(function(cell) {
      const cellDate = cell.getAttribute("data-date");
      
      if (cellDate && datesToMark.includes(cellDate)) {
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
        
        console.log("Marked cell for", cellDate);
      }
    });
  } catch (error) {
    window.errorHandler.logError('markCalendarBasedOnStreak', error);
  }
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