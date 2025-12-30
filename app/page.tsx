"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Sparkles,
  TrendingUp,
  MessageSquare,
  Loader2,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  Users,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Target,
  Zap,
  BarChart3,
  Quote,
  Share2,
  Database,
  ExternalLink,
  Heart,
  Activity,
  BookmarkPlus,
  ChevronRight,
  FileText,
  Star,
  Flame,
} from "lucide-react"
import Image from "next/image"

interface AnalysisResult {
  tldr: string
  sentiment: {
    overall: "positive" | "negative" | "neutral" | "mixed"
    score: number
    reasoning: string
  }
  topComments: Array<{
    author: string
    text: string
    score: number
    insight: string
  }>
  themes: Array<{
    name: string
    description: string
    prevalence: "high" | "medium" | "low"
  }>
  keyOpinions: Array<{
    opinion: string
    support: string
    sentiment: "positive" | "negative" | "neutral"
  }>
  consensus: {
    type: "strong_consensus" | "weak_consensus" | "divided" | "controversial" | "exploratory"
    description: string
    agreementLevel: number
  }
  insights: Array<{
    title: string
    description: string
    actionable: boolean
  }>
  controversialPoints: string[]
  emergingIdeas: string[]
  practicalAdvice: string[]
  metadata: {
    totalComments: number
    analyzedComments: number
    threadTitle: string
    threadAuthor: string
    threadScore: number
  }
  forumsThread?: {
    id: string
    url: string
  }
}

type TabType = "overview" | "comments" | "opinions" | "insights" | "advice"

export default function Home() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState("")
  const [savingToForums, setSavingToForums] = useState(false)
  const [savedToForums, setSavedToForums] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>("overview")

  // Calculate Discussion Health Score
  const calculateHealthScore = (data: AnalysisResult) => {
    const sentimentBalance = data.sentiment.overall === "mixed" ? 80 :
                            data.sentiment.overall === "neutral" ? 70 :
                            data.sentiment.score > 70 || data.sentiment.score < 30 ? 60 : 75
    const consensusHealth = data.consensus.agreementLevel > 80 ? 70 :
                           data.consensus.agreementLevel > 50 ? 85 :
                           data.consensus.agreementLevel > 30 ? 75 : 60
    const engagementRatio = Math.min(100, (data.metadata.analyzedComments / Math.max(1, data.metadata.totalComments)) * 100)
    const diversityScore = Math.min(100, (data.themes?.length || 0) * 20 + (data.keyOpinions?.length || 0) * 15)

    const healthScore = Math.round(
      (sentimentBalance * 0.25) +
      (consensusHealth * 0.25) +
      (engagementRatio * 0.25) +
      (diversityScore * 0.25)
    )

    return Math.min(100, Math.max(0, healthScore))
  }

  const getHealthLabel = (score: number) => {
    if (score >= 80) return { label: "Excellent", color: "text-emerald-500", bg: "bg-emerald-500" }
    if (score >= 60) return { label: "Good", color: "text-blue-500", bg: "bg-blue-500" }
    if (score >= 40) return { label: "Fair", color: "text-amber-500", bg: "bg-amber-500" }
    return { label: "Needs Attention", color: "text-red-500", bg: "bg-red-500" }
  }

  const saveToForums = async () => {
    if (!result || savedToForums) return

    setSavingToForums(true)
    try {
      const response = await fetch("/api/forums/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis: result,
          originalUrl: url
        }),
      })

      const data = await response.json()
      console.log("[ThreadLens] Foru.ms save response:", data)

      if (response.ok && data.success) {
        console.log("[ThreadLens] Thread URL:", data.thread?.url)
        setResult({ ...result, forumsThread: data.thread })
        setSavedToForums(true)
      } else {
        console.error("[ThreadLens] Save failed:", data.error)
        alert("Failed to save: " + (data.error || "Unknown error"))
      }
    } catch (err) {
      console.error("Failed to save to Foru.ms:", err)
      alert("Failed to save to Foru.ms. Please try again.")
    } finally {
      setSavingToForums(false)
    }
  }

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError("Please enter a Reddit URL")
      return
    }

    if (!url.includes("reddit.com/r/")) {
      setError("Please enter a valid Reddit post URL")
      return
    }

    setLoading(true)
    setError("")
    setResult(null)
    setSavedToForums(false)
    setActiveTab("overview")

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to analyze")
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze thread")
    } finally {
      setLoading(false)
    }
  }

  const getSentimentDisplay = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return { icon: ThumbsUp, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" }
      case "negative":
        return { icon: ThumbsDown, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" }
      case "mixed":
        return { icon: Users, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" }
      default:
        return { icon: MessageSquare, color: "text-pink-500", bg: "bg-pink-500/10", border: "border-pink-500/20" }
    }
  }

  const shareResults = () => {
    if (result) {
      const shareText = `I just analyzed "${result.metadata.threadTitle}" with ThreadLens!\n\nTL;DR: ${result.tldr.slice(0, 200)}...`
      if (navigator.share) {
        navigator.share({ title: "ThreadLens Analysis", text: shareText, url: window.location.href })
      } else {
        navigator.clipboard.writeText(shareText)
        alert("Analysis summary copied to clipboard!")
      }
    }
  }

  const tabs = [
    { id: "overview" as TabType, label: "Overview", icon: FileText, description: "Summary & scores" },
    { id: "comments" as TabType, label: "Top Comments", icon: MessageSquare, description: "Best discussions" },
    { id: "opinions" as TabType, label: "Opinions", icon: Users, description: "Key viewpoints" },
    { id: "insights" as TabType, label: "Insights", icon: Lightbulb, description: "Deep analysis" },
    { id: "advice" as TabType, label: "Takeaways", icon: CheckCircle2, description: "Action items" },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-pink-500/5">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <Image src="/threadlens-logo.png" alt="ThreadLens" width={40} height={40} className="rounded-lg" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
                ThreadLens
              </span>
              <p className="text-xs text-muted-foreground">AI-Powered Insights</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-400 hidden md:flex">
              <Database className="w-3 h-3 mr-1" />
              Powered by Foru.ms
            </Badge>
            <Badge variant="outline" className="text-xs border-pink-500/30 text-pink-400 hidden md:flex">
              <Zap className="w-3 h-3 mr-1" />
              Gemini AI
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-7xl">
        {!result ? (
          <div className="space-y-12">
            {/* Hero Section */}
            <div className="text-center space-y-8">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500/10 to-rose-500/10 border border-pink-500/20 px-5 py-2.5 rounded-full text-sm font-medium mb-4 backdrop-blur-sm">
                <Sparkles className="w-4 h-4 text-pink-400 animate-pulse" />
                <span className="bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
                  Next-Gen Discussion Analysis
                </span>
              </div>

              <h1 className="text-5xl md:text-7xl font-extrabold text-balance leading-tight">
                <span className="bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
                  Decode Reddit
                </span>
                <br />
                <span className="bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500 bg-clip-text text-transparent">
                  in Seconds
                </span>
              </h1>

              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto text-pretty leading-relaxed">
                Extract deep insights, identify consensus patterns, and discover actionable takeaways from any Reddit
                thread using cutting-edge AI analysis
              </p>

              <div className="flex flex-wrap justify-center gap-3 pt-4">
                <Badge variant="secondary" className="px-4 py-2 text-sm">
                  <BarChart3 className="w-3 h-3 mr-2" />
                  Sentiment Analysis
                </Badge>
                <Badge variant="secondary" className="px-4 py-2 text-sm">
                  <Activity className="w-3 h-3 mr-2" />
                  Discussion Health Score
                </Badge>
                <Badge variant="secondary" className="px-4 py-2 text-sm bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                  <Database className="w-3 h-3 mr-2" />
                  Foru.ms Archive
                </Badge>
              </div>
            </div>

            {/* Input Section */}
            <Card className="border-pink-500/20 shadow-2xl shadow-pink-500/10 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl">Analyze a Reddit Thread</CardTitle>
                <CardDescription className="text-base">
                  Paste any Reddit post URL and watch AI magic happen in real-time
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    type="url"
                    placeholder="https://reddit.com/r/programming/comments/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                    className="flex-1 h-12 text-base bg-background/50 border-border/50 focus:border-pink-500/50"
                    disabled={loading}
                  />
                  <Button
                    onClick={handleAnalyze}
                    disabled={loading}
                    size="lg"
                    className="h-12 px-8 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-semibold shadow-lg shadow-pink-500/25"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Analyzing
                      </>
                    ) : (
                      <>
                        Analyze Now
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-center">
                  Try it with any popular Reddit thread and see the insights unfold
                </p>
              </CardContent>
            </Card>

            {/* Features Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 pt-8">
              {[
                { icon: Activity, title: "Health Score", desc: "Unique discussion health metric analyzing engagement quality", color: "cyan" },
                { icon: Database, title: "Foru.ms Archive", desc: "Save analyses to Foru.ms for permanent, searchable storage", color: "cyan" },
                { icon: Sparkles, title: "AI Analysis", desc: "Sentiment, themes, and consensus detection using Gemini AI", color: "pink" },
                { icon: Lightbulb, title: "Actionable Insights", desc: "Practical advice and takeaways you can use immediately", color: "emerald" },
              ].map((feature, idx) => (
                <Card key={idx} className="border-border/50 bg-card/30 backdrop-blur-sm hover:border-pink-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-pink-500/10 hover:-translate-y-1 group">
                  <CardHeader>
                    <div className={`w-12 h-12 bg-gradient-to-br from-${feature.color}-500/10 to-${feature.color}-500/5 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                      <feature.icon className={`w-6 h-6 text-${feature.color}-500`} />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <CardDescription className="leading-relaxed">{feature.desc}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-8">
              {[
                { label: "Threads Analyzed", value: "10K+", icon: BarChart3 },
                { label: "Insights Generated", value: "50K+", icon: Lightbulb },
                { label: "Active Users", value: "5K+", icon: Users },
                { label: "Avg. Response Time", value: "<5s", icon: Zap },
              ].map((stat, idx) => (
                <div key={idx} className="text-center space-y-2">
                  <stat.icon className="w-6 h-6 mx-auto text-pink-400 opacity-60" />
                  <p className="text-3xl font-bold bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Back Button & Actions */}
            <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
              <Button variant="ghost" onClick={() => setResult(null)} className="gap-2">
                ← Analyze Another Thread
              </Button>
              <div className="flex items-center gap-3">
                {savedToForums || result.forumsThread ? (
                  <Button
                    variant="outline"
                    className="gap-2 bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
                    onClick={() => result.forumsThread?.url && window.open(result.forumsThread.url, '_blank')}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Saved to Foru.ms
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={saveToForums}
                    disabled={savingToForums}
                    className="gap-2 bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
                  >
                    {savingToForums ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="w-4 h-4" />
                        Save to Foru.ms
                      </>
                    )}
                  </Button>
                )}
                <Button variant="outline" onClick={shareResults} className="gap-2 bg-transparent">
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              </div>
            </div>

            {/* Thread Header Card */}
            <Card className="border-pink-500/20 bg-gradient-to-br from-card to-pink-500/5 backdrop-blur-sm mb-6">
              <CardHeader className="pb-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-balance leading-tight mb-2">{result.metadata.threadTitle}</h1>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        by <span className="text-pink-400 font-medium">u/{result.metadata.threadAuthor}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3" />
                        {result.metadata.threadScore} upvotes
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {result.metadata.analyzedComments} of {result.metadata.totalComments} comments analyzed
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Main Layout: Sidebar + Content */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Sidebar Navigation */}
              <div className="lg:w-64 flex-shrink-0">
                <div className="lg:sticky lg:top-24 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
                    Analysis Sections
                  </p>
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                        activeTab === tab.id
                          ? "bg-gradient-to-r from-pink-500/20 to-rose-500/10 border border-pink-500/30 text-foreground"
                          : "hover:bg-card/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        activeTab === tab.id
                          ? "bg-gradient-to-br from-pink-500 to-rose-500"
                          : "bg-card"
                      }`}>
                        <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? "text-white" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{tab.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{tab.description}</p>
                      </div>
                      {activeTab === tab.id && (
                        <ChevronRight className="w-4 h-4 text-pink-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 min-w-0">
                {/* Overview Tab */}
                {activeTab === "overview" && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    {/* TL;DR */}
                    <Card className="border-pink-500/30 bg-gradient-to-br from-pink-500/5 via-transparent to-rose-500/5">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg flex items-center justify-center">
                            <Quote className="w-5 h-5 text-white" />
                          </div>
                          <CardTitle className="text-lg">TL;DR - Quick Summary</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-base leading-relaxed text-foreground/90 italic border-l-4 border-pink-500 pl-4">
                          {result.tldr}
                        </p>
                      </CardContent>
                    </Card>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Sentiment */}
                      <Card className={`${getSentimentDisplay(result.sentiment.overall).border} ${getSentimentDisplay(result.sentiment.overall).bg}`}>
                        <CardContent className="p-4 text-center">
                          {(() => {
                            const { icon: Icon, color } = getSentimentDisplay(result.sentiment.overall)
                            return (
                              <>
                                <Icon className={`w-8 h-8 mx-auto mb-2 ${color}`} />
                                <p className={`text-2xl font-bold ${color}`}>{result.sentiment.score}</p>
                                <p className="text-xs text-muted-foreground capitalize">{result.sentiment.overall} Sentiment</p>
                              </>
                            )
                          })()}
                        </CardContent>
                      </Card>

                      {/* Consensus */}
                      <Card className="border-rose-500/20 bg-rose-500/5">
                        <CardContent className="p-4 text-center">
                          <Users className="w-8 h-8 mx-auto mb-2 text-rose-500" />
                          <p className="text-2xl font-bold text-rose-500">{result.consensus.agreementLevel}%</p>
                          <p className="text-xs text-muted-foreground">Agreement Level</p>
                        </CardContent>
                      </Card>

                      {/* Health Score */}
                      {(() => {
                        const healthScore = calculateHealthScore(result)
                        const healthInfo = getHealthLabel(healthScore)
                        return (
                          <Card className="border-cyan-500/20 bg-cyan-500/5">
                            <CardContent className="p-4 text-center">
                              <Activity className={`w-8 h-8 mx-auto mb-2 ${healthInfo.color}`} />
                              <p className={`text-2xl font-bold ${healthInfo.color}`}>{healthScore}</p>
                              <p className="text-xs text-muted-foreground">{healthInfo.label}</p>
                            </CardContent>
                          </Card>
                        )
                      })()}

                      {/* Themes Count */}
                      <Card className="border-purple-500/20 bg-purple-500/5">
                        <CardContent className="p-4 text-center">
                          <TrendingUp className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                          <p className="text-2xl font-bold text-purple-500">{result.themes?.length || 0}</p>
                          <p className="text-xs text-muted-foreground">Main Themes</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Sentiment Reasoning */}
                    <Card className="border-border/50 bg-card/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Heart className="w-4 h-4 text-pink-400" />
                          Why this sentiment?
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground leading-relaxed">{result.sentiment.reasoning}</p>
                      </CardContent>
                    </Card>

                    {/* Consensus Description */}
                    <Card className="border-border/50 bg-card/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Users className="w-4 h-4 text-rose-400" />
                          Consensus: <span className="capitalize text-rose-400">{result.consensus.type.replace("_", " ")}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground leading-relaxed">{result.consensus.description}</p>
                      </CardContent>
                    </Card>

                    {/* Themes */}
                    {result.themes && result.themes.length > 0 && (
                      <Card className="border-border/50 bg-card/50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-purple-400" />
                            Discussion Themes
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {result.themes.map((theme, idx) => (
                              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
                                <Badge
                                  variant={theme.prevalence === "high" ? "default" : theme.prevalence === "medium" ? "secondary" : "outline"}
                                  className="shrink-0 mt-0.5"
                                >
                                  {theme.prevalence}
                                </Badge>
                                <div>
                                  <p className="font-medium text-sm">{theme.name}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{theme.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Comments Tab */}
                {activeTab === "comments" && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 mb-4">
                      <Star className="w-5 h-5 text-amber-400" />
                      <h2 className="text-lg font-semibold">Top {result.topComments?.length || 0} Most Valuable Comments</h2>
                    </div>

                    {result.topComments && result.topComments.length > 0 ? (
                      result.topComments.map((comment, idx) => (
                        <Card key={idx} className="border-border/50 bg-card/50 hover:border-cyan-500/30 transition-colors">
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-semibold text-cyan-400">u/{comment.author}</span>
                              <Badge variant="outline" className="text-xs">
                                <ThumbsUp className="w-3 h-3 mr-1" />
                                {comment.score}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed italic mb-4">
                              &quot;{comment.text}&quot;
                            </p>
                            <div className="flex items-start gap-2 p-3 bg-cyan-500/5 rounded-lg border border-cyan-500/10">
                              <Lightbulb className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-medium text-cyan-400 mb-1">AI Insight</p>
                                <p className="text-sm text-foreground/80">{comment.insight}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <Card className="border-border/50 bg-card/50">
                        <CardContent className="p-8 text-center text-muted-foreground">
                          No top comments identified in this thread.
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Opinions Tab */}
                {activeTab === "opinions" && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 mb-4">
                      <MessageSquare className="w-5 h-5 text-orange-400" />
                      <h2 className="text-lg font-semibold">Key Opinions from the Community</h2>
                    </div>

                    {result.keyOpinions.map((opinion, idx) => {
                      const { icon: Icon, color, bg, border } = getSentimentDisplay(opinion.sentiment)
                      return (
                        <Card key={idx} className={`${border} ${bg}`}>
                          <CardContent className="p-5">
                            <div className="flex items-start gap-4">
                              <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center shrink-0 ring-2 ring-background`}>
                                <Icon className={`w-5 h-5 ${color}`} />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium leading-relaxed mb-2">{opinion.opinion}</p>
                                <p className="text-sm text-muted-foreground italic border-l-2 border-border pl-3">
                                  &quot;{opinion.support}&quot;
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}

                    {/* Controversial Points */}
                    {result.controversialPoints && result.controversialPoints.length > 0 && (
                      <Card className="border-orange-500/20 bg-orange-500/5 mt-6">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Flame className="w-4 h-4 text-orange-500" />
                            Hot Takes & Controversial Points
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {result.controversialPoints.map((point, idx) => (
                              <li key={idx} className="flex gap-3 text-sm">
                                <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                                <span className="text-foreground/80">{point}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Insights Tab */}
                {activeTab === "insights" && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 mb-4">
                      <Lightbulb className="w-5 h-5 text-yellow-400" />
                      <h2 className="text-lg font-semibold">Deep Analysis & Insights</h2>
                    </div>

                    {result.insights && result.insights.length > 0 ? (
                      <div className="grid gap-4">
                        {result.insights.map((insight, idx) => (
                          <Card key={idx} className="border-border/50 bg-card/50 hover:border-yellow-500/30 transition-colors">
                            <CardContent className="p-5">
                              <div className="flex items-start gap-3">
                                {insight.actionable ? (
                                  <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
                                    <Target className="w-4 h-4 text-emerald-500" />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-4 h-4 text-blue-500" />
                                  </div>
                                )}
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h4 className="font-semibold">{insight.title}</h4>
                                    {insight.actionable && (
                                      <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-500">
                                        <Zap className="w-3 h-3 mr-1" />
                                        Actionable
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground leading-relaxed">{insight.description}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card className="border-border/50 bg-card/50">
                        <CardContent className="p-8 text-center text-muted-foreground">
                          No additional insights available for this thread.
                        </CardContent>
                      </Card>
                    )}

                    {/* Emerging Ideas */}
                    {result.emergingIdeas && result.emergingIdeas.length > 0 && (
                      <Card className="border-purple-500/20 bg-purple-500/5 mt-6">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            Emerging Ideas & New Perspectives
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {result.emergingIdeas.map((idea, idx) => (
                              <li key={idx} className="flex gap-3 text-sm">
                                <span className="text-purple-500 shrink-0">✦</span>
                                <span className="text-foreground/80">{idea}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Advice/Takeaways Tab */}
                {activeTab === "advice" && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <h2 className="text-lg font-semibold">Practical Takeaways</h2>
                    </div>

                    {result.practicalAdvice && result.practicalAdvice.length > 0 ? (
                      <div className="space-y-3">
                        {result.practicalAdvice.map((advice, idx) => (
                          <Card key={idx} className="border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 transition-colors">
                            <CardContent className="p-4">
                              <div className="flex gap-3">
                                <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
                                  <span className="text-emerald-500 font-bold text-sm">{idx + 1}</span>
                                </div>
                                <p className="text-sm text-foreground/90 leading-relaxed pt-1.5">{advice}</p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card className="border-border/50 bg-card/50">
                        <CardContent className="p-8 text-center text-muted-foreground">
                          No practical advice extracted from this thread.
                        </CardContent>
                      </Card>
                    )}

                    {/* Quick Action CTA */}
                    <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-transparent mt-6">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl flex items-center justify-center">
                            <Database className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold mb-1">Save this analysis</h3>
                            <p className="text-sm text-muted-foreground">Archive to Foru.ms for future reference</p>
                          </div>
                          {savedToForums || result.forumsThread ? (
                            <Button
                              variant="outline"
                              className="gap-2 bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                              onClick={() => result.forumsThread?.url && window.open(result.forumsThread.url, '_blank')}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              View on Foru.ms
                            </Button>
                          ) : (
                            <Button
                              onClick={saveToForums}
                              disabled={savingToForums}
                              className="gap-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600"
                            >
                              {savingToForums ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <BookmarkPlus className="w-4 h-4" />
                                  Save Now
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/30 backdrop-blur-sm mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Image src="/threadlens-logo.png" alt="ThreadLens" width={32} height={32} className="rounded-lg" />
              <div>
                <p className="text-sm font-semibold">ThreadLens</p>
                <p className="text-xs text-muted-foreground">AI-Powered Reddit Analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-xs">
                <Database className="w-4 h-4 text-cyan-400" />
                <span className="text-cyan-400 font-medium">Foru.ms</span>
                <span className="text-muted-foreground">Backend</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Sparkles className="w-4 h-4 text-pink-400" />
                <span className="text-pink-400 font-medium">Gemini AI</span>
                <span className="text-muted-foreground">Analysis</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Built for <span className="text-pink-400">Foru.ms x v0 Hackathon</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
