document.addEventListener("DOMContentLoaded", main);

const usernameElement = document.getElementById("userName");
const usernameButton = document.getElementById("userNameBtn");
const statusMessage = document.getElementById("statusMessage");

// Helper function to store data in Chrome storage
const storeData = async (key, value) => {
  try {
    await chrome.storage.local.set({ [key]: value });
    console.log(`Data stored successfully: ${key}`, value);
  } catch (error) {
    console.error(`Error storing data: ${key}`, error);
  }
};

// Helper function to get data from Chrome storage
const getData = async (key) => {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key];
  } catch (error) {
    console.error(`Error fetching data: ${key}`, error);
    throw error;
  }
};

// Update UI after successful user creation
const conditionalRender = async () => {
  usernameButton.innerHTML = "Success!";
  statusMessage.textContent = "Ready to use! Visit Codeforces to see your calendar.";
  statusMessage.style.color = "#2ecc71";
};

// Show error message
const showError = (message) => {
  statusMessage.textContent = message;
  statusMessage.className = "status-message error-message";
  usernameButton.innerHTML = "Try Again";
};

// Record username and proceed with the sequence
const recordUsername = async () => {
  const handle = usernameElement.value.trim();
  
  if (!handle) {
    showError("Please enter a Codeforces handle");
    return;
  }
  
  usernameButton.innerHTML = "Loading...";
  statusMessage.textContent = "Connecting to backend...";
  statusMessage.className = "status-message";
  
  try {
    // Store the handle locally
    const userData = { username: handle };
    await storeData("userData", userData);
    
    // Proceed with the main sequence
    await sequence(handle);
    
    conditionalRender();
  } catch (err) {
    console.error("Error in recordUsername:", err);
    showError(err.message || "Failed to process your request");
    usernameButton.innerHTML = "Try Again";
  }
};

// Update the streak UI
function updateStreakUI(streak) {
  let streakElement = document.getElementById("streakElement");
  if (streakElement) {
    streakElement.textContent = `Current Monthly Streak: ${streak}`;
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
const sequence = async (handle) => {
  try {
    // Get or create user from backend
    statusMessage.textContent = "Getting user information...";
    const userInfo = await window.api.getOrCreateUser(handle);
    console.log("User info retrieved:", userInfo);
    
    // Extract streak data from backend user object
    let streakCount = 0;
    if (userInfo && userInfo.streak) {
      // Access the correct property from your backend structure
      const backendStreak = userInfo.streak.last_streak_count;
      if (typeof backendStreak === 'number') {
        streakCount = backendStreak;
      } else if (backendStreak) {
        streakCount = parseInt(backendStreak);
      }
      console.log("Using streak count from backend:", streakCount);
    }

// Store streak data in local storage with exact backend value
await storeData("streakData", { 
  streak: streakCount, 
  lastCalculated: new Date().toISOString().split('T')[0] 
});
console.log("Streak data stored in local storage:", { streak: streakCount });
    
    // Store user info locally - ensure it's in the expected format
    // The content script expects an array with the user object
    await storeData("userInfo", [userInfo]);
    
    // Get user rating
    const userRating = userInfo.rating || 1200; // Default to 1200 if rating isn't available
    
    // Get current date for month and year
    const today = new Date();
    const currentMonth = today.getMonth() + 1; // Convert to 1-based month
    const currentYear = today.getFullYear();
    
    // Get problems for current month and user's rating
    statusMessage.textContent = "Fetching monthly problems...";
    console.log(`Fetching monthly problems from: http://localhost:4000/problemset/monthly?month=${currentMonth}&year=${currentYear}&rating=${userRating}`);
    const problemsData = await window.api.getMonthlyProblems(currentMonth, currentYear, userRating);
    console.log("Monthly problems retrieved:", problemsData);
    
    // Format problems for local storage and calendar
    let formattedProblems = [];

    // Direct check for problems array in response
    if (problemsData && problemsData.problems && Array.isArray(problemsData.problems)) {
      // Direct array of problems
      formattedProblems = problemsData.problems.map(problem => {
        const date = new Date(currentYear, currentMonth - 1, problem.day);
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
    // Check if we have the problems in a ratings structure
    else if (problemsData && problemsData.ratings && problemsData.ratings[userRating]) {
      const problems = problemsData.ratings[userRating];
      // Convert object with day keys to array format
      Object.entries(problems).forEach(([day, problem]) => {
        const date = new Date(currentYear, currentMonth - 1, parseInt(day));
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
    // Direct response with array and day properties
    else if (problemsData && Array.isArray(problemsData)) {
      formattedProblems = problemsData.map(problem => {
        const date = new Date(currentYear, currentMonth - 1, problem.day);
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
    // Handle the "data" wrapper some APIs use
    else if (problemsData && problemsData.data) {
      // Try again with the data property
      if (Array.isArray(problemsData.data)) {
        formattedProblems = problemsData.data.map(problem => {
          const date = new Date(currentYear, currentMonth - 1, problem.day);
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
          const date = new Date(currentYear, currentMonth - 1, problem.day);
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
          const date = new Date(currentYear, currentMonth - 1, parseInt(day));
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
    
    console.log("Formatted problems:", formattedProblems);
    
    // Store formatted problems
    await storeData("problemData", formattedProblems);
    console.log("Problem data stored in local storage");
    
    // Update the UI with streak data
    updateStreakUI(streakCount);
    
    // Inject calendar into Codeforces
    chrome.runtime.sendMessage({ action: "injectCalendarHTML" });
    
    return true;
  } catch (err) {
    console.error("Error in sequence:", err);
    throw err;
  }
};

// Initialize the popup
function main() {
  try {
    // Check if we already have a stored username
    chrome.storage.local.get(["userData"], result => {
      if (result.userData && result.userData.username) {
        usernameElement.value = result.userData.username;
      }
    });
    
    usernameButton.addEventListener("click", recordUsername);
  } catch (err) {
    console.error("Error in main:", err);
    showError("Failed to initialize. Please reload the extension.");
  }
}