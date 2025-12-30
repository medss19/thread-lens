import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

const FORUMS_API_KEY = process.env.FORUMS_API_KEY || ""
const FORUMS_ORG_ID = process.env.FORUMS_ORG_ID || ""
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

interface RedditComment {
  author: string
  body: string
  score: number
}

interface RedditThread {
  title: string
  selftext: string
  author: string
  score: number
  num_comments: number
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400, headers: corsHeaders })
    }

    // Step 1: Fetch Reddit data
    console.log("[v0] Fetching Reddit data for:", url)
    const redditData = await fetchRedditData(url)

    // Step 2: Sync to Foru.ms
    console.log("[v0] Syncing to Foru.ms...")
    const forumThread = await syncToForums(redditData)

    // Step 3: Analyze with Gemini
    console.log("[v0] Running AI analysis...")
    const analysis = await analyzeWithGemini(redditData)

    return NextResponse.json(analysis, { headers: corsHeaders })
  } catch (error) {
    console.error("[v0] Error in analyze route:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analysis failed" }, { status: 500, headers: corsHeaders })
  }
}

async function fetchRedditData(url: string) {
  // Convert to JSON URL
  let jsonUrl = url.replace("www.reddit.com", "www.reddit.com")
  if (!jsonUrl.endsWith(".json")) {
    jsonUrl = jsonUrl.replace(/\/$/, "") + ".json"
  }

  // Add limit parameter to get more comments
  jsonUrl += "?limit=50"

  console.log("[v0] Fetching from:", jsonUrl)

  // Try using a CORS proxy
  const corsProxies = [
    `https://corsproxy.io/?${encodeURIComponent(jsonUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(jsonUrl)}`,
    jsonUrl, // Try direct as fallback
  ]

  let lastError = null

  for (const proxyUrl of corsProxies) {
    try {
      console.log("[v0] Trying:", proxyUrl.slice(0, 100))

      const response = await fetch(proxyUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        next: { revalidate: 0 },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      console.log("[v0] Reddit data received successfully")

      // Reddit returns [post_data, comments_data]
      const postData = data[0]?.data?.children?.[0]?.data as RedditThread
      const commentsData = data[1]?.data?.children || []

      if (!postData) {
        throw new Error("Invalid Reddit URL or post not found")
      }

      // Extract comments (filter out "more" items)
      const comments: RedditComment[] = commentsData
        .filter((item: any) => item.kind === "t1")
        .map((item: any) => ({
          author: item.data.author,
          body: item.data.body,
          score: item.data.score,
        }))
        .slice(0, 50)

      console.log("[v0] Parsed", comments.length, "comments")

      return {
        title: postData.title,
        selftext: postData.selftext || "",
        author: postData.author,
        score: postData.score,
        numComments: postData.num_comments,
        comments,
      }
    } catch (error) {
      console.error("[v0] Failed with proxy:", proxyUrl.slice(0, 50), error)
      lastError = error
      continue
    }
  }

  // If all proxies fail, throw the last error
  throw new Error(
    `Failed to fetch Reddit data after trying all methods: ${lastError instanceof Error ? lastError.message : "Unknown error"}`,
  )
}

async function syncToForums(redditData: any) {
  // Only sync if API credentials are provided
  if (!FORUMS_API_KEY || !FORUMS_ORG_ID) {
    console.log("[v0] Skipping Foru.ms sync - no credentials")
    return null
  }

  try {
    // Create a thread in Foru.ms
    const threadResponse = await fetch(`https://foru.ms/api/v1/thread`, {
      method: "POST",
      headers: {
        "x-api-key": FORUMS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: redditData.title,
        body: redditData.selftext || "See comments below",
        extendedData: {
          source: "reddit",
          author: redditData.author,
          score: redditData.score,
        },
      }),
    })

    if (!threadResponse.ok) {
      const errorText = await threadResponse.text()
      console.error("[v0] Foru.ms API error:", threadResponse.status, errorText)
      throw new Error(`Failed to create Foru.ms thread: ${threadResponse.status}`)
    }

    const thread = await threadResponse.json()

    // Add comments as posts
    for (const comment of redditData.comments.slice(0, 20)) {
      await fetch(`https://foru.ms/api/v1/post`, {
        method: "POST",
        headers: {
          "x-api-key": FORUMS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: comment.body,
          threadId: thread.id,
          extendedData: {
            author: comment.author,
            score: comment.score,
          },
        }),
      })
    }

    return thread
  } catch (error) {
    console.error("[v0] Foru.ms sync error:", error)
    return null
  }
}

async function analyzeWithGemini(redditData: any) {
  const threadContent = `
Title: ${redditData.title}

Original Post by u/${redditData.author} [${redditData.score} upvotes]:
${redditData.selftext || "(No post body)"}

Comments (${redditData.comments.length} analyzed out of ${redditData.numComments} total):
${redditData.comments
  .map(
    (c: RedditComment, i: number) => `
Comment #${i + 1} by u/${c.author} [${c.score} upvotes]:
${c.body}
`,
  )
  .join("\n---\n")}
  `.trim()

  const prompt = `You are an expert social media analyst. Analyze this Reddit discussion deeply and provide specific, actionable insights.

${threadContent}

Provide a JSON response with this EXACT structure (no markdown, just raw JSON):
{
  "tldr": "A detailed 3-4 sentence summary capturing the main discussion points and overall tone",
  "sentiment": {
    "overall": "positive" | "negative" | "neutral" | "mixed",
    "score": 0-100,
    "reasoning": "Brief explanation of the sentiment"
  },
  "topComments": [
    {
      "author": "username",
      "text": "comment preview (first 200 chars)",
      "score": number,
      "insight": "Why this comment is important"
    }
  ],
  "themes": [
    {
      "name": "Theme name",
      "description": "What this theme is about",
      "prevalence": "high" | "medium" | "low"
    }
  ],
  "keyOpinions": [
    {
      "opinion": "Specific viewpoint from comments",
      "support": "Quote or paraphrase supporting this",
      "sentiment": "positive" | "negative" | "neutral"
    }
  ],
  "consensus": {
    "type": "strong_consensus" | "weak_consensus" | "divided" | "controversial" | "exploratory",
    "description": "Detailed explanation of agreement/disagreement patterns",
    "agreementLevel": 0-100
  },
  "insights": [
    {
      "title": "Insight title",
      "description": "Detailed insight",
      "actionable": true/false
    }
  ],
  "controversialPoints": ["Specific points of disagreement"],
  "emergingIdeas": ["New or interesting ideas mentioned"],
  "practicalAdvice": ["Actionable advice from the discussion"]
}

CRITICAL INSTRUCTIONS:
- Extract ACTUAL content from the comments, not generic statements
- Use SPECIFIC quotes and examples from the discussion
- Identify REAL themes based on what people are actually discussing
- Be CONCRETE and SPECIFIC in all fields
- Make insights ACTIONABLE when possible
- The topComments array should include 3-5 highest-scored or most insightful comments
- Return ONLY valid JSON, no markdown code blocks`

  try {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is not set")
    }

    const googleAI = createGoogleGenerativeAI({
      apiKey: GEMINI_API_KEY,
    })

    const { text } = await generateText({
      model: googleAI("gemini-2.5-flash"),
      prompt,
      temperature: 0.7,
    })

    console.log("[v0] AI Response received:", text.slice(0, 200))

    let jsonText = text.trim()

    // Remove markdown code blocks if present
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```json?\n?/g, "").replace(/```\n?$/g, "")
    }

    // Find JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("Could not parse AI response as JSON")
    }

    const analysis = JSON.parse(jsonMatch[0])

    return {
      ...analysis,
      metadata: {
        totalComments: redditData.numComments,
        analyzedComments: redditData.comments.length,
        threadTitle: redditData.title,
        threadAuthor: redditData.author,
        threadScore: redditData.score,
      },
    }
  } catch (error) {
    console.error("[v0] Gemini analysis error:", error)
    throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
