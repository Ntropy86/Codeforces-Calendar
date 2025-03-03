// Background service worker for the Codeforces POTD extension

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log("Background received message:", request);
  
  if (request.action === "injectCalendarHTML") {
    injectCalendarIntoActiveTab();
  } else if (request.action === "apiCall") {
    handleApiCall(request.method, request.endpoint, request.data)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicates async response
  }
});

// Inject the calendar into the active tab if it's a Codeforces page
async function injectCalendarIntoActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      console.error("No active tab found");
      return;
    }
    
    console.log("Active tab:", tab);
    
    // Check if the active tab is a Codeforces page
    if (tab.url && tab.url.includes("codeforces.com")) {
      console.log("Injecting scripts into Codeforces page");
      
      // Inject scripts in correct order
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["config.js"]
      });
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["storage.js"]
      });
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["api.js"]
      });
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["streak.js"]
      });
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      
      // Inject style.css
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["style.css"]
      });
      
      console.log("Successfully injected all scripts and styles");
    } else {
      console.log("Active tab is not a Codeforces page. Not injecting scripts.");
    }
  } catch (error) {
    console.error("Error injecting scripts:", error);
  }
}

// Handle API calls from content scripts
async function handleApiCall(method, endpoint, data) {
  try {
    const apiUrl = chrome.runtime.getURL('config.js');
    const response = await fetch(`${apiUrl}/${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const responseData = await response.json();
    return { success: true, data: responseData };
  } catch (error) {
    console.error("API call error:", error);
    return { success: false, error: error.message };
  }
}

// Set up event listener for tab updates to inject calendar
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  // Only run when the tab is fully loaded and it's a Codeforces page
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('codeforces.com')) {
    console.log("Codeforces page fully loaded, checking if we should inject calendar");
    
    // Check if we have user data before injecting
    chrome.storage.local.get(['userData', 'userInfo'], function(result) {
      if ((result.userData && result.userData.username) || 
          (result.userInfo && result.userInfo.length > 0)) {
        console.log("User data found, injecting calendar");
        injectCalendarIntoActiveTab();
      } else {
        console.log("No user data found, not injecting calendar");
      }
    });
  }
});

// Set up periodic tasks using Chrome's alarm API
function setupPeriodicTasks() {
  // Safely check if the alarms API is available
  if (typeof chrome !== 'undefined' && chrome.alarms) {
    try {
      // Check streak status every 6 hours (4 times a day)
      chrome.alarms.create('checkStreakStatus', { periodInMinutes: 360 });
      
      // Check submissions and update streak every hour
      chrome.alarms.create('checkSubmissions', { periodInMinutes: 60 });
      
      console.log("Periodic tasks scheduled");
    } catch (error) {
      console.error("Error setting up alarms:", error);
    }
  } else {
    console.error("Chrome alarms API is not available");
  }
}

// Safely set up alarm listener
if (typeof chrome !== 'undefined' && chrome.alarms && chrome.alarms.onAlarm) {
  try {
    // Listen for alarm events
    chrome.alarms.onAlarm.addListener(async (alarm) => {
      console.log(`Alarm triggered: ${alarm.name}`);
      
      if (alarm.name === 'checkStreakStatus') {
        await handleStreakStatusCheck();
      } else if (alarm.name === 'checkSubmissions') {
        await handleSubmissionCheck();
      }
    });
    console.log("Alarm listener registered");
  } catch (error) {
    console.error("Error setting up alarm listener:", error);
  }
}

// Handle streak status check
async function handleStreakStatusCheck() {
  try {
    console.log('Running scheduled streak status check');
    
    // Get user data
    const userData = await new Promise(resolve => {
      chrome.storage.local.get(['userData', 'userInfo'], resolve);
    });
    
    if (userData.userInfo && userData.userInfo.length > 0) {
      // Get the user handle
      let userHandle = "Unknown";
      if (userData.userInfo[0] && userData.userInfo[0].length > 0) {
        const user = userData.userInfo[0][0];
        if (user && user.userID) {
          userHandle = user.userID;
        }
      } else if (userData.userData && userData.userData.username) {
        userHandle = userData.userData.username;
      }
      
      if (userHandle !== "Unknown") {
        // We need to inject the scripts to use streak functions
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && tab.url.includes('codeforces.com')) {
          // Inject required scripts
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["config.js", "storage.js", "api.js", "streak.js"]
          });
          
          // Execute streak check in the context of the tab
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: async (handle) => {
              try {
                // Check if streak should be reset
                const shouldReset = await window.streak.shouldResetStreak();
                
                if (shouldReset) {
                  console.log("Auto-resetting streak due to gap in solving");
                  await window.streak.resetStreak(handle);
                }
                
                // Clean up old streak days periodically
                const today = new Date();
                if (today.getDate() === 1) {
                  // On the first day of the month, clean up old streak days
                  await window.streak.cleanupOldStreakDays(handle);
                }
                
                return { success: true, reset: shouldReset };
              } catch (error) {
                console.error('Error in streak check:', error);
                return { success: false, error: error.message };
              }
            },
            args: [userHandle]
          });
        } else {
          console.log("No active Codeforces tab found, skipping streak check");
        }
      }
    }
  } catch (error) {
    console.error('Error in scheduled streak status check:', error);
  }
}

// Handle submission check
async function handleSubmissionCheck() {
  try {
    console.log('Running scheduled submission check');
    
    // Get user data and problem data
    const data = await new Promise(resolve => {
      chrome.storage.local.get(['userData', 'userInfo', 'problemData'], resolve);
    });
    
    if (!data.userData || !data.problemData) {
      console.log("Missing required data for submission check");
      return;
    }
    
    // Get user handle
    let userHandle = data.userData.username;
    if (!userHandle && data.userInfo && data.userInfo.length > 0) {
      if (data.userInfo[0] && data.userInfo[0].length > 0) {
        const user = data.userInfo[0][0];
        if (user && user.userID) {
          userHandle = user.userID;
        }
      }
    }
    
    if (!userHandle) {
      console.log("No user handle found, skipping submission check");
      return;
    }
    
    // We need to inject the scripts to use API functions
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.includes('codeforces.com')) {
      // Inject required scripts
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["config.js", "storage.js", "api.js", "streak.js"]
      });
      
      // Execute submission check in the context of the tab
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (handle, problems) => {
          try {
            const todayISO = window.dateUtils.getTodayISO();
            console.log("Today's ISO date for submission check:", todayISO);
            
            // Find today's problem
            const todaysProblem = problems.find(function(problem) {
              if (!problem || !problem.date) return false;
              const problemDate = problem.date.split("T")[0];
              return problemDate === todayISO;
            });
            
            if (!todaysProblem) {
              console.log("No problem found for today");
              return { success: true, verified: false, reason: "no_problem" };
            }
            
            // Check if already verified
            const lastSolvedDate = await window.storage.get(window.storageKeys.LAST_SOLVED_DATE);
            if (lastSolvedDate === todayISO) {
              console.log("Today's problem already verified");
              return { success: true, verified: true, alreadyVerified: true };
            }
            
            // Verify submission
            const result = await window.api.verifySubmission(handle, todaysProblem);
            console.log("Submission verification result:", result);
            
            if (result.verified) {
              // Update streak
              await window.streak.validateAndUpdateStreak(handle, todaysProblem);
              
              // Mark the date as already checked
              await window.storage.set(window.storageKeys.LAST_SOLVED_DATE, todayISO);
              
              return { success: true, verified: true };
            }
            
            return { success: true, verified: false };
          } catch (error) {
            console.error('Error in submission check:', error);
            return { success: false, error: error.message };
          }
        },
        args: [userHandle, data.problemData]
      });
    } else {
      console.log("No active Codeforces tab found, skipping submission check");
    }
  } catch (error) {
    console.error('Error in scheduled submission check:', error);
  }
}

// Expose debug functions for testing
function exposeDebugFunctions() {
  // Only expose if we're in a context where window is defined
  if (typeof window !== 'undefined') {
    window.debugExtension = {
      triggerStreakCheck: () => {
        console.log("Manually triggering streak check...");
        return handleStreakStatusCheck();
      },
      
      triggerSubmissionCheck: () => {
        console.log("Manually triggering submission check...");
        return handleSubmissionCheck();
      },
      
      checkAlarmStatus: async () => {
        if (chrome.alarms) {
          const alarms = await chrome.alarms.getAll();
          console.log("Current active alarms:", alarms);
          return alarms;
        } else {
          console.error("Chrome alarms API is not available");
          return [];
        }
      },
      
      resetAlarms: () => {
        if (chrome.alarms) {
          // Clear all alarms
          chrome.alarms.clearAll();
          // Set up again
          setupPeriodicTasks();
          console.log("Alarms reset");
        } else {
          console.error("Chrome alarms API is not available");
        }
      }
    };
    
    console.log("Debug functions available via window.debugExtension");
  }
}

// Safely expose debug functions
try {
  exposeDebugFunctions();
} catch (error) {
  console.error("Error exposing debug functions:", error);
}

// Set up periodic tasks when the extension starts (if possible)
if (chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    console.log("Extension starting up, setting up periodic tasks");
    setupPeriodicTasks();
  });
}

// Also set up tasks when the service worker is initialized
console.log("Background script initialized, setting up periodic tasks");
setupPeriodicTasks();