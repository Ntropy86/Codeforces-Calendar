document.addEventListener("DOMContentLoaded", main);

// Main initialization function
async function main() {
  try {
    setupEventListeners();
    await restoreUserData();
    await checkAndDisplayStreak();
  } catch (err) {
    window.errorHandler.logError('main', err);
    showError("Failed to initialize. Please reload the extension.");
  }
}

// Set up UI event listeners
function setupEventListeners() {
  const usernameButton = document.getElementById("userNameBtn");
  
  if (usernameButton) {
    usernameButton.addEventListener("click", recordUsername);
  }
}

// Restore user data from storage
async function restoreUserData() {
  const usernameElement = document.getElementById("userName");
  const userData = await window.storage.get(window.storageKeys.USER_DATA);
  
  if (userData && userData.username && usernameElement) {
    usernameElement.value = userData.username;
    
    // If we have a username, update the button text to make it clear it can be used for reload
    const userNameBtn = document.getElementById("userNameBtn");
    if (userNameBtn) {
      userNameBtn.textContent = "Refresh!";
    }
  }
}

// Check and display current streak
async function checkAndDisplayStreak() {
  try {
    const streakCount = await window.streak.getCurrentStreak();
    updateStreakUI(streakCount);
  } catch (error) {
    window.errorHandler.logError('checkAndDisplayStreak', error);
  }
}

// Update the streak UI
function updateStreakUI(streak) {
  const streakElement = document.getElementById("streakElement");
  
  if (streakElement) {
    if (streak > 0) {
      streakElement.innerHTML = `
        <div class="streak-container">
          <div class="streak-icon">🔥</div>
          <div class="streak-details">
            <div class="streak-count">${streak}</div>
            <div class="streak-label">day streak</div>
          </div>
          <div class="streak-progress">
            <div class="progress-bar" style="width: ${Math.min(streak * 10, 100)}%"></div>
          </div>
        </div>
      `;
    } else {
      streakElement.innerHTML = `
        <div class="streak-container">
          <div class="streak-message">Solve today's problem to start your streak!</div>
        </div>
      `;
    }
  }
}

// Show error message in UI
function showError(message) {
  const statusMessage = document.getElementById("statusMessage");
  if (statusMessage) {
    statusMessage.textContent = message;
    statusMessage.className = "status-message error-message";
  }
  
  const usernameButton = document.getElementById("userNameBtn");
  if (usernameButton) {
    usernameButton.innerHTML = "Try Again";
  }
}

// Show success message in UI
function showSuccess(message) {
  const statusMessage = document.getElementById("statusMessage");
  if (statusMessage) {
    statusMessage.textContent = message;
    statusMessage.className = "status-message success-message";
  }
}

// Show warning message in UI
function showMessage(message, className = "status-message") {
  const statusMessage = document.getElementById("statusMessage");
  if (statusMessage) {
    statusMessage.textContent = message;
    statusMessage.className = className;
  }
}

// Show loading status in UI
function showLoading(message) {
  const statusMessage = document.getElementById("statusMessage");
  if (statusMessage) {
    statusMessage.textContent = message;
    statusMessage.className = "status-message";
  }
  
  const usernameButton = document.getElementById("userNameBtn");
  if (usernameButton) {
    usernameButton.innerHTML = "Loading...";
  }
}

// Record username and proceed with the sequence
async function recordUsername() {
  const usernameElement = document.getElementById("userName");
  const handle = usernameElement ? usernameElement.value.trim() : "";
  
  if (!handle) {
    showError("Please enter a Codeforces handle");
    return;
  }
  
  showLoading("Connecting to backend...");
  
  try {
    // Store the handle locally
    await window.storage.set(window.storageKeys.USER_DATA, { username: handle });
    
    // Proceed with the main sequence
    await sequence(handle);
    
    // Update UI after success
    const usernameButton = document.getElementById("userNameBtn");
    if (usernameButton) {
      usernameButton.innerHTML = "Success!";
      
      // Change the button text back to "Refresh!" after a short delay
      setTimeout(() => {
        if (usernameButton) {
          usernameButton.innerHTML = "Refresh!";
        }
      }, 2000);
    }
    
    showSuccess("Ready to use! Visit Codeforces to see your calendar.");
  } catch (err) {
    window.errorHandler.logError('recordUsername', err);
    showError(err.message || "Failed to process your request");
  }
}

// Extract problem ID components
function extractProblemIdParts(problemId) {
  // This regex matches a pattern like "1234A" or "999B2"
  const match = problemId.match(/(\d+)([A-Z]\d*)/);
  if (match) {
    return {
      contestId: parseInt(match[1]),
      index: match[2]
    };
  }
  return null;
}

// Main sequence triggered by popup
async function sequence(handle) {
  try {
    // Get or create user from backend (source of truth)
    showLoading("Getting user information...");
    const userData = await window.api.getOrCreateUser(handle);
    console.log("User data retrieved from backend:", userData);
    
    // Store the complete user data from DB in userInfo
    await window.storage.set(window.storageKeys.USER_INFO, [userData]);
    
    // Store just the username for quick reference
    await window.storage.set(window.storageKeys.USER_DATA, { username: handle });
    
    // Get streak directly from userData (backend data)
    let streakCount = 0;
    if (userData && userData.streak && userData.streak.last_streak_count !== undefined) {
      if (typeof userData.streak.last_streak_count === 'number') {
        streakCount = userData.streak.last_streak_count;
      } else {
        streakCount = parseInt(userData.streak.last_streak_count);
      }
      console.log("Streak from backend:", streakCount);
    }
    
    // Get user rating
    let userRating = userData.rating || 800; // Default to 1200 if rating isn't available
    const offset = 200;
    userRating = userRating / 100 * 100 + 100 + offset;
    // Get current date for month and year
    const { month: currentMonth, year: currentYear } = window.dateUtils.getCurrentMonthAndYear();
    
    // Get problems for current month and user's rating
    showLoading("Fetching monthly problems...");
    console.log(`Fetching monthly problems for month=${currentMonth}, year=${currentYear}, rating=${userRating}`);
    
    const problemsData = await window.api.getMonthlyProblems(currentMonth, currentYear, userRating);
    console.log("Monthly problems retrieved:", problemsData);
    
    // Format problems for local storage and calendar
    const formattedProblems = formatProblems(problemsData, currentMonth, currentYear, userRating);
    console.log("Formatted problems:", formattedProblems);
    
    // Store formatted problems
    await window.storage.set(window.storageKeys.PROBLEM_DATA, formattedProblems);
    console.log("Problem data stored in local storage");
    
    // Check if streak should be reset
    await window.streak.checkAndResetStreakIfNeeded(handle);
    
    // Update the UI with streak data - use dynamic calculation
    const dynamicStreakCount = await window.streak.getCurrentStreak();
    updateStreakUI(dynamicStreakCount);
    
    // Inject calendar into Codeforces
    chrome.runtime.sendMessage({ action: "injectCalendarHTML" });
    
    return true;
  } catch (err) {
    window.errorHandler.logError('sequence', err);
    throw err;
  }
}

// Format problems for storage and display - Updated to use UTC
function formatProblems(problemsData, currentMonth, currentYear, userRating) {
  let formattedProblems = [];

  // Handle different API response formats
  
  // Format 1: Direct array of problems
  if (problemsData && Array.isArray(problemsData)) {
    formattedProblems = problemsData.map(problem => {
      // Use UTC date creation for consistency
      const date = new Date(Date.UTC(currentYear, currentMonth - 1, problem.day));
      return {
        date: date.toISOString(),
        problem: extractProblemIdParts(problem.problemID) || {
          contestId: parseInt(problem.problemID),
          index: "A"
        },
        url: problem.problemURL
      };
    });
  }
  // Format 2: Problems in a ratings structure
  else if (problemsData && problemsData.ratings && problemsData.ratings[userRating]) {
    const problems = problemsData.ratings[userRating];
    Object.entries(problems).forEach(([day, problem]) => {
      // Use UTC date creation for consistency
      const date = new Date(Date.UTC(currentYear, currentMonth - 1, parseInt(day)));
      formattedProblems.push({
        date: date.toISOString(),
        problem: extractProblemIdParts(problem.problemID) || {
          contestId: parseInt(problem.problemID),
          index: "A"
        },
        url: problem.problemURL
      });
    });
  }
  // Format 3: Problems inside nested data property
  else if (problemsData && problemsData.problems && Array.isArray(problemsData.problems)) {
    formattedProblems = problemsData.problems.map(problem => {
      // Use UTC date creation for consistency
      const date = new Date(Date.UTC(currentYear, currentMonth - 1, problem.day));
      return {
        date: date.toISOString(),
        problem: extractProblemIdParts(problem.problemID) || {
          contestId: parseInt(problem.problemID),
          index: "A"
        },
        url: problem.problemURL
      };
    });
  }
  // Format 4: Data wrapper with nested formats
  else if (problemsData && problemsData.data) {
    if (Array.isArray(problemsData.data)) {
      formattedProblems = problemsData.data.map(problem => {
        // Use UTC date creation for consistency
        const date = new Date(Date.UTC(currentYear, currentMonth - 1, problem.day));
        return {
          date: date.toISOString(),
          problem: extractProblemIdParts(problem.problemID) || {
            contestId: parseInt(problem.problemID),
            index: "A"
          },
          url: problem.problemURL
        };
      });
    }
    else if (problemsData.data.problems && Array.isArray(problemsData.data.problems)) {
      formattedProblems = problemsData.data.problems.map(problem => {
        // Use UTC date creation for consistency
        const date = new Date(Date.UTC(currentYear, currentMonth - 1, problem.day));
        return {
          date: date.toISOString(),
          problem: extractProblemIdParts(problem.problemID) || {
            contestId: parseInt(problem.problemID),
            index: "A"
          },
          url: problem.problemURL
        };
      });
    }
    else if (problemsData.data.ratings && problemsData.data.ratings[userRating]) {
      const problems = problemsData.data.ratings[userRating];
      Object.entries(problems).forEach(([day, problem]) => {
        // Use UTC date creation for consistency
        const date = new Date(Date.UTC(currentYear, currentMonth - 1, parseInt(day)));
        formattedProblems.push({
          date: date.toISOString(),
          problem: extractProblemIdParts(problem.problemID) || {
            contestId: parseInt(problem.problemID),
            index: "A"
          },
          url: problem.problemURL
        });
      });
    }
  }
  
  return formattedProblems;
}