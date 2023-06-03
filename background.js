chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "injectCalendarHTML") {
      chrome.tabs.query({ url: "https://codeforces.com/*" }, function (tabs) {
        if (tabs.length > 0) {
          const tabId = tabs[0].id;
          chrome.tabs.sendMessage(tabId, { action: "injectCalendarHTML" }, function (response) {
            if (chrome.runtime.lastError) {
              console.error(chrome.runtime.lastError);
            } else {
              console.log(response);
            }
          });
        } else {
          console.error("No Codeforces tabs found");
        }
      });
    }
  });