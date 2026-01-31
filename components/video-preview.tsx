"use client"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Play, Pause, RotateCcw, Sparkles } from "lucide-react"

interface VideoPreviewProps {
  videoBlob: Blob
  onAnalyze: () => void
  onRetake: () => void
  isAnalyzing: boolean
}

export function VideoPreview({ videoBlob, onAnalyze, onRetake, isAnalyzing }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(videoBlob)
    setVideoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [videoBlob])

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleVideoEnd = () => {
    setIsPlaying(false)
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="relative w-full max-w-lg aspect-[4/3] bg-secondary rounded-xl overflow-hidden border border-border">
        {videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-cover scale-x-[-1]"
            onEnded={handleVideoEnd}
            playsInline
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-background/80 hover:bg-background/90 flex items-center justify-center transition-all"
            aria-label={isPlaying ? "Pause video" : "Play video"}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 text-foreground" />
            ) : (
              <Play className="w-8 h-8 text-foreground ml-1" />
            )}
          </button>
        </div>
        <div className="absolute top-4 left-4">
          <span className="text-xs font-medium text-foreground bg-primary/90 px-2 py-1 rounded">
            Preview
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={onRetake} variant="outline" size="lg" className="gap-2 bg-transparent" disabled={isAnalyzing}>
          <RotateCcw className="w-5 h-5" />
          Retake
        </Button>
        <Button onClick={onAnalyze} size="lg" className="gap-2" disabled={isAnalyzing}>
          {isAnalyzing ? (
            <>
              <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Analyze Posture
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
