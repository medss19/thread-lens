import { type NextRequest, NextResponse } from "next/server"

const FORUMS_API_KEY = process.env.FORUMS_API_KEY || ""
const FORUMS_ORG_ID = process.env.FORUMS_ORG_ID || ""

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

    const threadResponse = await fetch(`https://foru.ms/api/v1/thread`, {
      method: "POST",
      headers: {
        "x-api-key": FORUMS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
      }),
    })

    if (!threadResponse.ok) {
      const errorText = await threadResponse.text()
      console.error("[Foru.ms] API Error:", errorText)
      throw new Error("Failed to create Foru.ms thread")
    }

    const thread = await threadResponse.json()

    // Add top comments as posts
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
            threadId: thread.id,
            extendedData: {
              type: "top_comment",
              author: comment.author,
              score: comment.score,
            },
          }),
        })
      }
    }

    return NextResponse.json({
      success: true,
      thread: {
        id: thread.id,
        url: `https://foru.ms/thread/${thread.slug || thread.id}`,
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
