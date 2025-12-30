import { type NextRequest, NextResponse } from "next/server"

const FORUMS_API_KEY = process.env.FORUMS_API_KEY || ""
const FORUMS_ORG_ID = process.env.FORUMS_ORG_ID || ""

// Cache the category ID to avoid repeated API calls
let cachedCategoryId: string | null = null

async function getOrCreateCategory(): Promise<string> {
  // Return cached category if available
  if (cachedCategoryId) {
    return cachedCategoryId
  }

  try {
    // First, try to get existing categories
    const categoriesResponse = await fetch(`https://foru.ms/api/v1/categories`, {
      method: "GET",
      headers: {
        "x-api-key": FORUMS_API_KEY,
        "Content-Type": "application/json",
      },
    })

    if (categoriesResponse.ok) {
      const data = await categoriesResponse.json()
      const categories = data.categories || data.list || []

      // Look for existing ThreadLens category
      const threadLensCategory = categories.find((c: any) =>
        c.name === "ThreadLens Analyses" || c.name === "Reddit Analyses"
      )

      if (threadLensCategory) {
        cachedCategoryId = threadLensCategory.id
        console.log("[Foru.ms] Found existing category:", cachedCategoryId)
        return cachedCategoryId!
      }

      // If there are any categories, use the first one
      if (categories.length > 0) {
        cachedCategoryId = categories[0].id
        console.log("[Foru.ms] Using first available category:", cachedCategoryId)
        return cachedCategoryId!
      }
    }

    // No categories exist, create one
    console.log("[Foru.ms] No categories found, creating ThreadLens category...")
    const createResponse = await fetch(`https://foru.ms/api/v1/category`, {
      method: "POST",
      headers: {
        "x-api-key": FORUMS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "ThreadLens Analyses",
        description: "AI-powered Reddit thread analyses from ThreadLens",
        color: "#14b8a6", // Teal color
      }),
    })

    if (createResponse.ok) {
      const newCategory = await createResponse.json()
      cachedCategoryId = newCategory.id
      console.log("[Foru.ms] Created new category:", cachedCategoryId)
      return cachedCategoryId!
    }

    // If we still can't get/create a category, throw error
    const errorText = await createResponse.text()
    throw new Error(`Failed to get or create category: ${errorText}`)
  } catch (error) {
    console.error("[Foru.ms] Category error:", error)
    throw error
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

    // Get or create a category for the thread
    const categoryId = await getOrCreateCategory()
    console.log("[Foru.ms] Using category ID:", categoryId)

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

    const requestBody = {
      title: `[Analysis] ${analysis.metadata.threadTitle}`,
      body: threadContent,
      categoryId: categoryId,
      extendedData: {
        source: "threadlens",
        originalUrl,
        sentimentScore: analysis.sentiment.score,
        consensusLevel: analysis.consensus.agreementLevel,
        healthScore: calculateHealthScore(analysis),
        analyzedAt: new Date().toISOString(),
      },
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
