"use client"

import { Loader2, Scan, Brain, CheckCircle2 } from "lucide-react"

interface AnalyzingStateProps {
  progress: number
  status: string
}

export function AnalyzingState({ progress, status }: AnalyzingStateProps) {
  const getIcon = () => {
    if (progress < 25) return <Loader2 className="w-12 h-12 text-primary animate-spin" />
    if (progress < 50) return <Scan className="w-12 h-12 text-primary animate-pulse" />
    if (progress < 90) return <Brain className="w-12 h-12 text-primary animate-pulse" />
    return <CheckCircle2 className="w-12 h-12 text-success" />
  }

  const getStage = () => {
    if (progress < 15) return "Preparing"
    if (progress < 25) return "Loading AI Model"
    if (progress < 85) return "Detecting Pose"
    if (progress < 95) return "Analyzing Form"
    return "Complete"
  }

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-16">
      <div className="relative">
        {getIcon()}
      </div>
      
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">{getStage()}</h2>
        <p className="text-muted-foreground">{status}</p>
      </div>

      <div className="w-full max-w-md">
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2 text-center">
          {Math.round(progress)}%
        </p>
      </div>

      <div className="text-sm text-muted-foreground text-center max-w-md">
        <p>Using on-device pose detection to analyze your movement.</p>
        <p className="mt-1">No video is uploaded - all processing happens in your browser.</p>
      </div>
    </div>
  )
}
