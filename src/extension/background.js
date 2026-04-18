/**
 * Background service worker.
 *
 * Responsibilities (intentionally small — content scripts auto-inject via
 * the manifest, and the calendar UI drives its own data syncs on page load):
 *   1. Icon click → open Settings on Codeforces, or navigate there.
 *   2. Keep the extension action badge in sync with the current streak.
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

/**
 * Extract the current streak count from whichever shape userInfo happens to
 * have in storage right now. Content scripts sometimes store `[user]` and
 * other times `[[user]]`; tolerate both until the data layer is flattened.
 */
function extractStreakCount(userInfo) {
  if (!userInfo) return 0;
  if (Array.isArray(userInfo) && userInfo.length > 0) {
    const maybeUser = Array.isArray(userInfo[0]) ? userInfo[0][0] : userInfo[0];
    return maybeUser?.streak?.last_streak_count || 0;
  }
  return userInfo?.streak?.last_streak_count || 0;
}

async function updateExtensionBadge() {
  try {
    const { userInfo } = await chrome.storage.local.get(["userInfo"]);
    const streakCount = extractStreakCount(userInfo);

    chrome.action.setBadgeText({ text: streakCount > 0 ? String(streakCount) : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#667eea" });
    chrome.action.setTitle({
      title: streakCount > 0
        ? `${streakCount} day streak — click to open settings`
        : "Codeforces POTD — click to setup or open settings"
    });
  } catch (err) {
    console.error("[bg] badge update failed:", err);
  }
}

updateExtensionBadge();

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && (changes.userInfo || changes.userData)) {
    updateExtensionBadge();
  }
});
