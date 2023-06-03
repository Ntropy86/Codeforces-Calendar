chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "injectCalendarHTML") {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        console.log("TAAABS",tabs);
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ["content.js"],
        });
      });
    }
  });
  