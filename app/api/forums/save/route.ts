import { type NextRequest, NextResponse } from "next/server"

const FORUMS_API_KEY = process.env.FORUMS_API_KEY || ""
const FORUMS_ORG_ID = process.env.FORUMS_ORG_ID || ""

// Cache the category ID to avoid repeated API calls
let cachedCategoryId: string | null = null

async function getOrCreateCategory(): Promise<string | null> {
  // Return cached category if available
  if (cachedCategoryId) {
    return cachedCategoryId
  }

  console.log("[Foru.ms] API Key (first 8 chars):", FORUMS_API_KEY.slice(0, 8))

  try {
    // First, try to get existing categories
    console.log("[Foru.ms] Fetching categories...")
    const categoriesResponse = await fetch(`https://foru.ms/api/v1/categories`, {
      method: "GET",
      headers: {
        "x-api-key": FORUMS_API_KEY,
        "Content-Type": "application/json",
      },
    })

    console.log("[Foru.ms] Categories response status:", categoriesResponse.status)
    const rawText = await categoriesResponse.text()
    console.log("[Foru.ms] Categories raw response:", rawText.slice(0, 500))

    if (categoriesResponse.ok && rawText) {
      const data = JSON.parse(rawText)
      // Try multiple possible response formats
      const categories = data.categories || data.list || (Array.isArray(data) ? data : [])
      console.log("[Foru.ms] Found", categories.length, "categories")

      if (categories.length > 0) {
        // Log first category structure to understand the format
        console.log("[Foru.ms] First category:", JSON.stringify(categories[0]))
        cachedCategoryId = categories[0].id
        console.log("[Foru.ms] Using category:", cachedCategoryId)
        return cachedCategoryId
      }
    }

    // If no categories exist and we can't create one, return null
    // The thread API might work without categoryId in some cases
    console.log("[Foru.ms] No categories available, will try without categoryId")
    return null
  } catch (error) {
    console.error("[Foru.ms] Category error:", error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { analysis, originalUrl } = await request.json()

    if (!analysis) {
      return NextResponse.json({ error: "Analysis data is required" }, { status: 400 })
    }

    // If no Foru.ms credentials, return a demo response
    if (!FORUMS_API_KEY || !FORUMS_ORG_ID) {
      console.log("[Foru.ms] Demo mode - no credentials configured")
      // Return a demo thread for hackathon demonstration
      return NextResponse.json({
        success: true,
        thread: {
          id: `demo-${Date.now()}`,
          url: `https://foru.ms/demo/thread/${Date.now()}`,
        },
        message: "Saved to Foru.ms (Demo Mode)",
      })
    }

    console.log("[Foru.ms] Credentials check - API Key exists:", !!FORUMS_API_KEY, "Org ID exists:", !!FORUMS_ORG_ID)

    // Try to get a category (optional - will try without if none available)
    const categoryId = await getOrCreateCategory()
    console.log("[Foru.ms] Category ID:", categoryId || "none - will try without")

    // Create a rich thread in Foru.ms with the analysis
    const threadContent = `
## AI Analysis Summary

**TL;DR:** ${analysis.tldr}

### Sentiment Analysis
- **Overall:** ${analysis.sentiment.overall} (Score: ${analysis.sentiment.score}/100)
- **Reasoning:** ${analysis.sentiment.reasoning}

### Consensus
- **Type:** ${analysis.consensus.type.replace("_", " ")}
- **Agreement Level:** ${analysis.consensus.agreementLevel}%
- **Description:** ${analysis.consensus.description}

### Key Themes
${analysis.themes?.map((t: any) => `- **${t.name}** (${t.prevalence}): ${t.description}`).join("\n") || "No themes identified"}

### Top Insights
${analysis.insights?.map((i: any) => `- ${i.actionable ? "✅" : "💡"} **${i.title}:** ${i.description}`).join("\n") || "No insights"}

### Practical Advice
${analysis.practicalAdvice?.map((a: string) => `- ${a}`).join("\n") || "No advice"}

---
*Analyzed by ThreadLens | Original: ${originalUrl}*
    `.trim()

    const requestBody: Record<string, any> = {
      title: `[Analysis] ${analysis.metadata.threadTitle}`,
      body: threadContent,
      extendedData: {
        source: "threadlens",
        originalUrl,
        sentimentScore: analysis.sentiment.score,
        consensusLevel: analysis.consensus.agreementLevel,
        healthScore: calculateHealthScore(analysis),
        analyzedAt: new Date().toISOString(),
      },
    }

    // Only include categoryId if we have one
    if (categoryId) {
      requestBody.categoryId = categoryId
    }

    console.log("[Foru.ms] Creating thread with title:", requestBody.title)

    const threadResponse = await fetch(`https://foru.ms/api/v1/thread`, {
      method: "POST",
      headers: {
        "x-api-key": FORUMS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    if (!threadResponse.ok) {
      const errorText = await threadResponse.text()
      console.error("[Foru.ms] API Error:", threadResponse.status, errorText)
      // Return detailed error for debugging
      return NextResponse.json(
        {
          error: `Foru.ms API Error (${threadResponse.status}): ${errorText || 'Unknown error'}`,
          details: {
            status: threadResponse.status,
            response: errorText
          }
        },
        { status: 500 }
      )
    }

    const thread = await threadResponse.json()
    console.log("[Foru.ms] Thread created - full response:", JSON.stringify(thread, null, 2))

    // Extract thread ID from various possible response formats
    const threadId = thread.id || thread._id || thread.threadId || null

    if (!threadId) {
      console.error("[Foru.ms] No thread ID in response:", thread)
      // Still return success but with a fallback URL
      return NextResponse.json({
        success: true,
        thread: {
          id: "saved",
          url: "https://foru.ms",
        },
        message: "Thread saved but ID not returned"
      })
    }

    // Add top comments as posts (don't fail if this errors)
    try {
      if (analysis.topComments && analysis.topComments.length > 0) {
        for (const comment of analysis.topComments.slice(0, 5)) {
          await fetch(`https://foru.ms/api/v1/post`, {
            method: "POST",
            headers: {
              "x-api-key": FORUMS_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              body: `**u/${comment.author}** (${comment.score} upvotes):\n> ${comment.text}\n\n**AI Insight:** ${comment.insight}`,
              threadId: threadId,
              extendedData: {
                type: "top_comment",
                author: comment.author,
                score: comment.score,
              },
            }),
          })
        }
      }
    } catch (postError) {
      console.error("[Foru.ms] Error adding comments:", postError)
      // Continue anyway - thread was created
    }

    // Build the URL - try different possible response formats from Foru.ms
    const threadUrl = thread.url ||
                      thread.link ||
                      (thread.slug ? `https://foru.ms/thread/${thread.slug}` : null) ||
                      `https://foru.ms/thread/${threadId}`

    console.log("[Foru.ms] Success! Thread ID:", threadId, "URL:", threadUrl)

    return NextResponse.json({
      success: true,
      thread: {
        id: threadId,
        url: threadUrl,
      },
    })
  } catch (error) {
    console.error("[Foru.ms] Save error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save to Foru.ms" },
      { status: 500 }
    )
  }
}

// Calculate health score for metadata
function calculateHealthScore(data: any) {
  const sentimentBalance =
    data.sentiment.overall === "mixed"
      ? 80
      : data.sentiment.overall === "neutral"
        ? 70
        : data.sentiment.score > 70 || data.sentiment.score < 30
          ? 60
          : 75
  const consensusHealth =
    data.consensus.agreementLevel > 80
      ? 70
      : data.consensus.agreementLevel > 50
        ? 85
        : data.consensus.agreementLevel > 30
          ? 75
          : 60
  const engagementRatio = Math.min(
    100,
    (data.metadata.analyzedComments / Math.max(1, data.metadata.totalComments)) * 100
  )
  const diversityScore = Math.min(100, (data.themes?.length || 0) * 20 + (data.keyOpinions?.length || 0) * 15)

  const healthScore = Math.round(
    sentimentBalance * 0.25 + consensusHealth * 0.25 + engagementRatio * 0.25 + diversityScore * 0.25
  )

  return Math.min(100, Math.max(0, healthScore))
}
