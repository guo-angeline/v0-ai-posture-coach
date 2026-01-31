"use client"

import { useState } from "react"
import { CameraRecorder } from "@/components/camera-recorder"
import { VideoPreview } from "@/components/video-preview"
import { PostureFeedback } from "@/components/posture-feedback"
import { ExerciseSelector, type ExerciseType } from "@/components/exercise-selector"
import { AnalyzingState } from "@/components/analyzing-state"
import { analyzeVideo } from "@/lib/video-analyzer"
import type { AnalysisResult } from "@/lib/exercise-analysis"
import { Activity } from "lucide-react"

type AppState = "select" | "record" | "preview" | "analyzing" | "feedback"

export default function Home() {
  const [appState, setAppState] = useState<AppState>("select")
  const [selectedExercise, setSelectedExercise] = useState<ExerciseType | null>(null)
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analysisStatus, setAnalysisStatus] = useState("")
  const [feedbackData, setFeedbackData] = useState<AnalysisResult | null>(null)

  console.log("[v0] Page rendered, appState:", appState)

  const handleExerciseSelect = (exercise: ExerciseType) => {
    setSelectedExercise(exercise)
  }

  const handleContinueToRecord = () => {
    if (selectedExercise) {
      setAppState("record")
    }
  }

  const handleRecordingComplete = (blob: Blob) => {
    setVideoBlob(blob)
    setAppState("preview")
  }

  const handleRetake = () => {
    setVideoBlob(null)
    setAppState("record")
  }

  const handleAnalyze = async () => {
    if (!selectedExercise || !videoBlob) return
    
    setAppState("analyzing")
    setAnalysisProgress(0)
    setAnalysisStatus("Initializing...")
    
    try {
      const result = await analyzeVideo(
        videoBlob,
        selectedExercise,
        (progress, status) => {
          setAnalysisProgress(progress)
          setAnalysisStatus(status)
        }
      )
      
      setFeedbackData(result)
      setAppState("feedback")
    } catch (error) {
      console.error("Analysis failed:", error)
      setFeedbackData({
        score: 0,
        feedback: [{
          type: "warning",
          title: "Analysis failed",
          description: "Something went wrong during analysis. Please try recording again.",
        }],
        visibleParts: [],
        confidence: 0,
      })
      setAppState("feedback")
    }
  }

  const handleStartOver = () => {
    setVideoBlob(null)
    setFeedbackData(null)
    setSelectedExercise(null)
    setAnalysisProgress(0)
    setAnalysisStatus("")
    setAppState("select")
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Activity className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">FormCoach</span>
          </div>
          <nav className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">AI-Powered Posture Analysis</span>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        {appState === "select" && (
          <ExerciseSelector
            selectedExercise={selectedExercise}
            onSelect={handleExerciseSelect}
            onContinue={handleContinueToRecord}
          />
        )}

        {appState === "record" && (
          <div className="flex flex-col items-center gap-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">Record Your Movement</h2>
              <p className="text-muted-foreground">
                Position yourself so your full body is visible. Recording is limited to 5 seconds.
              </p>
            </div>
            <CameraRecorder onRecordingComplete={handleRecordingComplete} maxDuration={5} />
          </div>
        )}

        {appState === "preview" && videoBlob && (
          <div className="flex flex-col items-center gap-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">Review Your Recording</h2>
              <p className="text-muted-foreground">
                Watch your movement and analyze when ready, or retake if needed.
              </p>
            </div>
            <VideoPreview
              videoBlob={videoBlob}
              onAnalyze={handleAnalyze}
              onRetake={handleRetake}
              isAnalyzing={false}
            />
          </div>
        )}

        {appState === "analyzing" && (
          <AnalyzingState 
            progress={analysisProgress} 
            status={analysisStatus}
          />
        )}

        {appState === "feedback" && feedbackData && (
          <PostureFeedback
            overallScore={feedbackData.score}
            feedback={feedbackData.feedback}
            visibleParts={feedbackData.visibleParts}
            confidence={feedbackData.confidence}
            onStartOver={handleStartOver}
          />
        )}
      </div>
    </main>
  )
}
