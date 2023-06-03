// content.js

// This script will be injected into the Codeforces homepage

// Function to inject the calendarHTML into the sidebar
function injectCalendarHTML() {
    const sidebar = document.getElementById("sidebar");
    console.log("SIDEBAR:",sidebar);
    if (sidebar) {
      const calendarHTML = `<div id="problemCalendar">
        <!-- Your calendar HTML code goes here -->
      </div>`;
      sidebar.insertAdjacentHTML("beforeend", calendarHTML);
    }
  }
  
  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "injectCalendarHTML") {
      injectCalendarHTML();
    }
  });
  