// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "injectCalendarHTML") {
    chrome.windows.getCurrent({ populate: true }, (window) => {
      const tabs = window.tabs;
      const activeTab = tabs.filter(tab => tab.active)[0];
      console.log("Active tab:", activeTab);

      // Check if the active tab is a Codeforces page
      if (activeTab && activeTab.url && activeTab.url.includes("codeforces.com")) {
        // Inject content.js into the active tab
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ["config.js", "api.js", "content.js"],
        });

        // Inject style.css into the active tab
        chrome.scripting.insertCSS({
          target: { tabId: activeTab.id },
          files: ["style.css"],
        });
      } else {
        console.log("Active tab is not a Codeforces page. Not injecting scripts.");
      }
    });
  }
});