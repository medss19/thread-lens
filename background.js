// Chrome extension service worker - no imports needed, chrome is global

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId })
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    if (tab.url.includes("reddit.com/r/")) {
      chrome.action.setBadgeText({ text: "✓", tabId: tabId })
      chrome.action.setBadgeBackgroundColor({ color: "#ec4899", tabId: tabId })
    } else {
      chrome.action.setBadgeText({ text: "", tabId: tabId })
    }
  }
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getRedditData") {
    console.log("[ThreadLens] Received Reddit data request:", request)
    sendResponse({ success: true })
  }
  return true
})
