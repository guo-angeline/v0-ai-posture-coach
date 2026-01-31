"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { RotateCcw, CheckCircle2, AlertTriangle, Info, TrendingUp, Eye, Cpu } from "lucide-react"

interface PostureFeedbackItem {
  type: "success" | "warning" | "tip"
  title: string
  description: string
}

interface PostureFeedbackProps {
  overallScore: number
  feedback: PostureFeedbackItem[]
  visibleParts?: string[]
  confidence?: number
  onStartOver: () => void
}

export function PostureFeedback({ 
  overallScore, 
  feedback, 
  visibleParts = [], 
  confidence = 0,
  onStartOver 
}: PostureFeedbackProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success"
    if (score >= 60) return "text-warning"
    return "text-destructive"
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent Form"
    if (score >= 60) return "Good Progress"
    if (score >= 40) return "Needs Improvement"
    return "Limited Analysis"
  }

  const getIcon = (type: PostureFeedbackItem["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
      case "tip":
        return <Info className="w-5 h-5 text-primary flex-shrink-0" />
    }
  }

  const formatBodyPart = (part: string) => {
    return part.charAt(0).toUpperCase() + part.slice(1)
  }

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl mx-auto">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <TrendingUp className="w-4 h-4" />
          Posture Score
        </div>
        <div className={`text-7xl font-bold ${getScoreColor(overallScore)}`}>
          {overallScore}
        </div>
        <p className={`text-lg font-medium mt-2 ${getScoreColor(overallScore)}`}>
          {getScoreLabel(overallScore)}
        </p>
      </div>

      {/* Detection Info */}
      {(visibleParts.length > 0 || confidence > 0) && (
        <Card className="w-full p-4 bg-secondary/50 border-border">
          <div className="flex flex-col gap-3">
            {visibleParts.length > 0 && (
              <div className="flex items-start gap-2">
                <Eye className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Detected body parts</p>
                  <p className="text-sm text-muted-foreground">
                    {visibleParts.map(formatBodyPart).join(", ")}
                  </p>
                </div>
              </div>
            )}
            {confidence > 0 && (
              <div className="flex items-start gap-2">
                <Cpu className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Detection confidence</p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(confidence * 100)}% average keypoint confidence
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="w-full space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Coach Feedback</h3>
        <div className="space-y-3">
          {feedback.map((item, index) => (
            <Card key={index} className="p-4 bg-card border-border">
              <div className="flex gap-3">
                {getIcon(item.type)}
                <div>
                  <h4 className="font-medium text-foreground">{item.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {feedback.length === 0 && (
        <Card className="w-full p-6 bg-card border-border text-center">
          <p className="text-muted-foreground">No specific feedback available. Try recording with better lighting and ensure your full body is visible.</p>
        </Card>
      )}

      <Button onClick={onStartOver} size="lg" className="gap-2 mt-4">
        <RotateCcw className="w-5 h-5" />
        Analyze Another Movement
      </Button>
    </div>
  )
}
