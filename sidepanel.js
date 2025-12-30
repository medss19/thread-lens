let currentUrl = null

const initialState = document.getElementById("initial-state")
const resultsState = document.getElementById("results-state")
const errorState = document.getElementById("error-state")
const analyzeBtn = document.getElementById("analyze-btn")
const backBtn = document.getElementById("back-btn")
const btnText = document.getElementById("btn-text")
const btnLoading = document.getElementById("btn-loading")
const resultsContent = document.getElementById("results-content")
const errorMessage = document.getElementById("error-message")

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

async function analyzeThread() {
  const tab = await getCurrentTab()

  if (!tab.url || !tab.url.includes("reddit.com/r/")) {
    showError("Please navigate to a Reddit post first")
    return
  }

  currentUrl = tab.url

  analyzeBtn.disabled = true
  btnText.style.display = "none"
  btnLoading.style.display = "flex"

  try {
    console.log("[ThreadLens] Starting analysis for:", currentUrl)

    const response = await fetch("https://thread-lens-seven.vercel.app/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentUrl }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Analysis failed")
    }

    const data = await response.json()
    console.log("[ThreadLens] Analysis complete!")

    showResults(data)
  } catch (error) {
    console.error("[ThreadLens] Error:", error)
    showError(error.message || "Failed to analyze thread. Please try again.")
  } finally {
    analyzeBtn.disabled = false
    btnText.style.display = "inline"
    btnLoading.style.display = "none"
  }
}

function showResults(data) {
  initialState.style.display = "none"
  errorState.style.display = "none"
  resultsState.style.display = "block"

  const getSentimentEmoji = (sentiment) => {
    switch (sentiment) {
      case "positive":
        return "👍"
      case "negative":
        return "👎"
      case "mixed":
        return "🤔"
      default:
        return "💬"
    }
  }

  resultsContent.innerHTML = `
    <div class="result-card" style="margin-bottom: 18px;">
      <h2 style="font-size: 17px; font-weight: 700; margin-bottom: 10px; line-height: 1.4; color: var(--foreground);">${data.metadata.threadTitle}</h2>
      <p style="color: var(--muted-foreground); font-size: 11px; display: flex; align-items: center; gap: 6px;">
        <span>📊</span>
        <span>${data.metadata.analyzedComments} of ${data.metadata.totalComments} comments analyzed</span>
      </p>
    </div>
    
    <!-- TL;DR -->
    <div class="card result-card" style="margin-bottom: 16px; background: linear-gradient(135deg, rgba(20, 184, 166, 0.1), rgba(6, 182, 212, 0.05)); border-color: rgba(20, 184, 166, 0.3);">
      <div class="section-title">
        <span style="font-size: 20px;">✨</span>
        <span class="gradient-text">TL;DR</span>
      </div>
      <p style="color: var(--foreground); line-height: 1.7; font-size: 13px; border-left: 3px solid var(--accent-teal); padding-left: 12px; font-style: italic;">${data.tldr}</p>
    </div>
    
    <!-- Sentiment & Consensus Grid -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
      <div class="card result-card" style="padding: 16px;">
        <div style="font-size: 28px; text-align: center; margin-bottom: 8px;">${getSentimentEmoji(data.sentiment.overall)}</div>
        <div style="text-align: center;">
          <p style="font-size: 20px; font-weight: 800; margin: 0; color: var(--accent-teal);">${data.sentiment.score}</p>
          <p style="font-size: 10px; text-transform: uppercase; color: var(--muted-foreground); margin: 4px 0 0 0; font-weight: 600;">Sentiment</p>
        </div>
      </div>
      
      <div class="card result-card" style="padding: 16px;">
        <div style="font-size: 28px; text-align: center; margin-bottom: 8px;">🎯</div>
        <div style="text-align: center;">
          <p style="font-size: 20px; font-weight: 800; margin: 0; color: var(--accent-cyan);">${data.consensus.agreementLevel}%</p>
          <p style="font-size: 10px; text-transform: uppercase; color: var(--muted-foreground); margin: 4px 0 0 0; font-weight: 600;">Consensus</p>
        </div>
      </div>
    </div>
    
    <!-- Consensus Type -->
    <div class="card result-card" style="margin-bottom: 16px;">
      <div class="section-title">
        <span>👥</span>
        <span>Consensus Analysis</span>
      </div>
      <span class="badge badge-consensus" style="margin-bottom: 10px;">${data.consensus.type.replace("_", " ")}</span>
      <p style="color: var(--muted-foreground); margin: 0; line-height: 1.6; font-size: 12px;">${data.consensus.description}</p>
    </div>
    
    <!-- Key Opinions -->
    <div class="card result-card" style="margin-bottom: 16px;">
      <div class="section-title">
        <span>💡</span>
        <span>Key Opinions</span>
      </div>
      <ul style="list-style: none; padding: 0; margin: 0;">
        ${data.keyOpinions
          .slice(0, 3)
          .map(
            (opinion, idx) => `
          <li style="margin-bottom: 12px; display: flex; gap: 10px; padding: 10px; background: rgba(20, 184, 166, 0.05); border-radius: 8px; border: 1px solid rgba(20, 184, 166, 0.1);">
            <span style="color: var(--accent-teal); font-weight: 800; flex-shrink: 0; font-size: 12px;">${idx + 1}</span>
            <span style="color: var(--foreground); line-height: 1.6; font-size: 12px;">${opinion.opinion}</span>
          </li>
        `,
          )
          .join("")}
      </ul>
    </div>
    
    <!-- Top Comments -->
    ${
      data.topComments && data.topComments.length > 0
        ? `
      <div class="card result-card" style="margin-bottom: 16px;">
        <div class="section-title">
          <span>⭐</span>
          <span>Top Comments</span>
        </div>
        <div style="space-y: 10px;">
          ${data.topComments
            .slice(0, 2)
            .map(
              (comment) => `
            <div style="margin-bottom: 12px; padding: 12px; background: rgba(6, 182, 212, 0.05); border-radius: 10px; border: 1px solid rgba(6, 182, 212, 0.15);">
              <p style="font-size: 10px; font-weight: 700; color: var(--accent-cyan); margin-bottom: 6px;">u/${comment.author} • ${comment.score} ⬆️</p>
              <p style="font-size: 11px; color: var(--muted-foreground); font-style: italic; line-height: 1.6; margin-bottom: 8px;">"${comment.text.slice(0, 120)}..."</p>
              <div style="display: flex; gap: 6px; align-items: start;">
                <span style="font-size: 14px;">💡</span>
                <p style="font-size: 11px; color: var(--accent-teal); margin: 0; line-height: 1.5; font-weight: 600;">${comment.insight}</p>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `
        : ""
    }
    
    <!-- Practical Advice -->
    ${
      data.practicalAdvice && data.practicalAdvice.length > 0
        ? `
      <div class="card result-card">
        <div class="section-title">
          <span>✅</span>
          <span>Practical Advice</span>
        </div>
        <ul style="list-style: none; padding: 0; margin: 0;">
          ${data.practicalAdvice
            .slice(0, 3)
            .map(
              (advice) => `
            <li style="margin-bottom: 10px; display: flex; gap: 8px; padding: 10px; background: rgba(16, 185, 129, 0.08); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.2);">
              <span style="color: #10b981; font-weight: 800; flex-shrink: 0;">→</span>
              <span style="color: var(--foreground); line-height: 1.6; font-size: 12px;">${advice}</span>
            </li>
          `,
            )
            .join("")}
        </ul>
      </div>
    `
        : ""
    }
  `
}

function showError(message) {
  errorState.style.display = "block"
  errorMessage.textContent = message

  setTimeout(() => {
    errorState.style.display = "none"
  }, 5000)
}

function goBack() {
  resultsState.style.display = "none"
  initialState.style.display = "block"
}

analyzeBtn.addEventListener("click", analyzeThread)
backBtn.addEventListener("click", goBack)

getCurrentTab().then((tab) => {
  if (tab.url && tab.url.includes("reddit.com/r/")) {
    console.log("[ThreadLens] Ready on Reddit page")
  }
})
