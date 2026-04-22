/**
 * Background service worker.
 *
 * Intentionally small — content scripts auto-inject via the manifest and the
 * calendar UI drives its own syncs. The background just owns:
 *   1. Browser-action click → open Settings on Codeforces, or navigate there.
 *   2. Keeping the extension badge in sync with the current streak.
 */

const CF_URL_PATTERN = "codeforces.com";

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (tab.url && tab.url.includes(CF_URL_PATTERN)) {
      chrome.tabs.sendMessage(tab.id, { action: "openSettings" });
    } else {
      chrome.tabs.create({ url: "https://codeforces.com" });
    }
  } catch (err) {
    console.error("[bg] icon click failed:", err);
  }
});

async function updateExtensionBadge() {
  try {
    const { today } = await chrome.storage.local.get(["today"]);
    const streak = Number(today?.streak?.length ?? 0);

    chrome.action.setBadgeText({ text: streak > 0 ? String(streak) : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#1f8dd6" });
    chrome.action.setTitle({
      title: streak > 0
        ? `${streak} day streak — click to open settings`
        : "Codeforces POTD — click to setup or open settings"
    });
  } catch (err) {
    console.error("[bg] badge update failed:", err);
  }
}

updateExtensionBadge();

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && (changes.today || changes.user)) {
    updateExtensionBadge();
  }
});
