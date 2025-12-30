console.log("[ThreadLens] Content script loaded on Reddit")

function extractRedditData() {
  const url = window.location.href

  if (!url.includes("/comments/")) {
    return null
  }

  const titleElement =
    document.querySelector("h1") ||
    document.querySelector('[slot="title"]') ||
    document.querySelector('[data-test-id="post-content"] h1')
  const title = titleElement ? titleElement.textContent.trim() : "Unknown Title"

  const commentElements = document.querySelectorAll('[data-testid="comment"]')
  const commentCount = commentElements.length

  return {
    url,
    title,
    commentCount,
    timestamp: Date.now(),
  }
}

window.chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractData") {
    const data = extractRedditData()
    sendResponse({ data })
  }
  return true
})

window.addEventListener("load", () => {
  console.log("[ThreadLens] Reddit page loaded and ready")
})
