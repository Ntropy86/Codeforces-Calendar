chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "injectCalendarHTML") {
    // location.reload();
    chrome.windows.getCurrent({ populate: true }, (window) => {
      const tabs = window.tabs;
      console.log(tabs);
      
      const need = tabs.filter(tab =>{
        return tab.active;
      });
      console.log(need);
     
      chrome.scripting.executeScript({
        target: { tabId: need[0].id },
        files: ["content.js"],
      }); // Access the tabs here
    });
  }
});