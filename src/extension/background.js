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