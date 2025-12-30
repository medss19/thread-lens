# ThreadLens

**AI-Powered Reddit Thread Analysis | Foru.ms x v0 Hackathon Submission**

<div align="center">
  <img src="public/threadlens-logo.png" alt="ThreadLens Logo" width="120" />

  *Transform overwhelming Reddit discussions into clear, actionable insights*
</div>

---

## The Problem

Reddit threads often contain hundreds of comments with valuable insights buried deep in the conversation. Users waste time scrolling through repetitive comments, missing key opinions, and struggling to understand the overall sentiment. There's no quick way to:

- Understand what the community *actually* thinks
- Find the most valuable comments without endless scrolling
- Get actionable takeaways from discussions
- Track discussion health and engagement quality

## Our Solution

ThreadLens uses AI to instantly analyze any Reddit thread and extract:

- **TL;DR Summary** - The essence of the discussion in 3-4 sentences
- **Sentiment Analysis** - How the community feels (score 0-100)
- **Consensus Detection** - Agreement level and patterns
- **Key Opinions** - Specific viewpoints with supporting quotes
- **Top Comments** - Most impactful comments with AI-generated insights
- **Practical Advice** - Concrete takeaways you can use immediately
- **Discussion Health Score** - A unique metric combining sentiment balance, consensus quality, engagement depth, and diversity of views

## What Makes ThreadLens Special

### Deep Foru.ms Integration

ThreadLens is built around **Foru.ms** as its core backend:

1. **Automatic Sync** - Every analyzed thread is synced to Foru.ms, creating a permanent, searchable archive
2. **Rich Metadata** - Analysis results (sentiment, consensus, health score) are stored as `extendedData` for future querying
3. **Comment Preservation** - Top comments are saved as Foru.ms posts with author attribution
4. **One-Click Save** - Users can manually save analyses to their Foru.ms account

### Discussion Health Score

Our unique metric that no other tool provides. It combines:

- **Sentiment Balance** - Healthy discussions have diverse viewpoints
- **Consensus Quality** - Neither too uniform nor too chaotic
- **Engagement Depth** - Ratio of analyzed to total comments
- **Diversity of Views** - Number of themes and distinct opinions

This helps users quickly gauge if a discussion is worth their time.

### Chrome Extension

Analyze threads without leaving Reddit:

- Side panel interface that doesn't interrupt browsing
- One-click analysis of any Reddit post
- Visual badge indicator when on analyzable pages
- Same rich insights as the web app

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 15** | Full-stack React framework with App Router |
| **Vercel AI SDK** | Streaming AI responses with `@ai-sdk/google` |
| **Google Gemini 2.5 Flash** | Fast, accurate AI analysis |
| **Foru.ms API** | Thread and comment storage backend |
| **Tailwind CSS** | Utility-first styling |
| **shadcn/ui** | Accessible, customizable components |
| **Chrome Extension (Manifest V3)** | Browser integration with side panel |

## How It Works

```
User Input (Reddit URL)
        │
        ▼
┌─────────────────────┐
│   Fetch Reddit Data │  ← JSON API with CORS proxy fallback
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│   Sync to Foru.ms   │  ← Create thread + posts with extendedData
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│   Gemini Analysis   │  ← Structured JSON response
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│   Display Results   │  ← Interactive cards, progress bars, badges
└─────────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 18+
- Gemini API key ([Get one free](https://makersuite.google.com/app/apikey))
- Foru.ms API credentials (from hackathon organizers)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/threadlens.git
cd threadlens

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

Add your credentials to `.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key
FORUMS_API_KEY=your_forums_api_key
FORUMS_ORG_ID=your_forums_org_id
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Chrome Extension

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the project root directory
5. Navigate to any Reddit post and click the ThreadLens icon

## Project Structure

```
threadlens/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts      # Main analysis endpoint
│   │   └── forums/save/route.ts  # Manual Foru.ms save
│   ├── page.tsx                  # Main UI
│   └── layout.tsx                # Root layout
├── components/ui/                # shadcn/ui components
├── public/                       # Static assets
├── manifest.json                 # Chrome extension config
├── sidepanel.html               # Extension UI
├── sidepanel.js                 # Extension logic
└── background.js                # Extension service worker
```

## Foru.ms API Usage

### Creating Threads

```typescript
const response = await fetch('https://foru.ms/api/v1/thread', {
  method: 'POST',
  headers: {
    'x-api-key': FORUMS_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: threadTitle,
    body: threadContent,
    extendedData: {
      source: 'threadlens',
      sentimentScore: 75,
      consensusLevel: 60,
      healthScore: 82,
    },
  }),
})
```

### Creating Posts

```typescript
await fetch('https://foru.ms/api/v1/post', {
  method: 'POST',
  headers: {
    'x-api-key': FORUMS_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    body: commentContent,
    threadId: thread.id,
    extendedData: {
      author: 'u/reddit_user',
      score: 1234,
    },
  }),
})
```

## Demo

**Live App**: [Deploy URL will be here after Vercel deployment]

**Sample Analysis**:
1. Visit the app
2. Paste any Reddit post URL (e.g., `https://www.reddit.com/r/jobs/comments/...`)
3. Click "Analyze Thread"
4. Explore the insights

## Future Improvements

- **Comparison Mode** - Compare sentiment across multiple threads
- **Trend Tracking** - Monitor how opinions change over time
- **Custom Alerts** - Get notified when discussions match criteria
- **Export Options** - PDF reports, Notion integration
- **Multi-Platform** - Support for Twitter/X, HackerNews, Discord

---

<div align="center">

  **Built with Foru.ms + Gemini AI + Next.js**

  *Foru.ms x v0 Hackathon 2024*

</div>
