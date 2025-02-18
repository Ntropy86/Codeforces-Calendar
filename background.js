chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "injectCalendarHTML") {
    chrome.windows.getCurrent({ populate: true }, (window) => {
      const tabs = window.tabs;
      const activeTab = tabs.filter(tab => tab.active)[0];
      console.log("Active tab:", activeTab);

      // Inject content.js into the active tab.
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ["content.js"],
      });

      // Inject style.css into the active tab.
      chrome.scripting.insertCSS({
        target: { tabId: activeTab.id },
        files: ["style.css"],
      });
    });
  }
});
