"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Video, Square, RotateCcw, Camera, CameraOff } from "lucide-react"

interface CameraRecorderProps {
  onRecordingComplete: (videoBlob: Blob) => void
  maxDuration?: number
}

export function CameraRecorder({ onRecordingComplete, maxDuration = 5 }: CameraRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  
  const [isStreaming, setIsStreaming] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [cameraPermission, setCameraPermission] = useState<"granted" | "denied" | "prompt">("prompt")

  const startCamera = useCallback(async () => {
    console.log("[v0] startCamera called, current streaming state:", isStreaming)
    try {
      setError(null)
      
      // Stop any existing stream first
      if (streamRef.current) {
        console.log("[v0] Stopping existing stream")
        for (const track of streamRef.current.getTracks()) {
          track.stop()
        }
        streamRef.current = null
      }
      
      console.log("[v0] Requesting camera access...")
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      
      console.log("[v0] Camera stream obtained")
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        console.log("[v0] Stream attached to video element")
      } else {
        console.log("[v0] WARNING: videoRef is null")
      }
      setIsStreaming(true)
      setCameraPermission("granted")
    } catch (err) {
      console.error("[v0] Camera access error:", err)
      setCameraPermission("denied")
      setError("Camera access denied. Please allow camera permissions to use this feature.")
    }
  }, [isStreaming])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsStreaming(false)
  }, [])

  const startRecording = useCallback(() => {
    if (!streamRef.current) return

    chunksRef.current = []
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: "video/webm;codecs=vp9",
    })

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data)
      }
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" })
      onRecordingComplete(blob)
      setIsRecording(false)
      setRecordingTime(0)
    }

    mediaRecorderRef.current = mediaRecorder
    mediaRecorder.start(100)
    setIsRecording(true)
  }, [onRecordingComplete])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= maxDuration) {
            stopRecording()
            return prev
          }
          return prev + 0.1
        })
      }, 100)
    }
    return () => clearInterval(interval)
  }, [isRecording, maxDuration, stopRecording])

  // Auto-start camera when component mounts
  useEffect(() => {
    console.log("[v0] CameraRecorder mounted, starting camera")
    startCamera()
    return () => {
      console.log("[v0] CameraRecorder unmounting, stopping camera")
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount/unmount

  const progress = (recordingTime / maxDuration) * 100

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="relative w-full max-w-lg aspect-[4/3] bg-secondary rounded-xl overflow-hidden border border-border">
        {/* Always render video element so ref is available, hide when not streaming */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover scale-x-[-1] ${isStreaming ? 'block' : 'hidden'}`}
        />
        {isStreaming && isRecording && (
          <>
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
              <span className="text-sm font-mono text-foreground bg-background/80 px-2 py-1 rounded">
                {recordingTime.toFixed(1)}s / {maxDuration}s
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
              <div 
                className="h-full bg-primary transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        )}
        {!isStreaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <CameraOff className="w-16 h-16" />
            <p className="text-sm">Camera not active</p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-destructive text-sm text-center max-w-md">{error}</p>
      )}

      <div className="flex items-center gap-4">
        {!isStreaming ? (
          <Button onClick={startCamera} size="lg" className="gap-2">
            <Camera className="w-5 h-5" />
            Start Camera
          </Button>
        ) : (
          <>
            {!isRecording ? (
              <>
                <Button onClick={startRecording} size="lg" className="gap-2 bg-primary hover:bg-primary/90">
                  <Video className="w-5 h-5" />
                  Record
                </Button>
                <Button onClick={stopCamera} variant="outline" size="lg" className="gap-2 bg-transparent">
                  <CameraOff className="w-5 h-5" />
                  Stop Camera
                </Button>
              </>
            ) : (
              <Button onClick={stopRecording} size="lg" variant="destructive" className="gap-2">
                <Square className="w-5 h-5" />
                Stop Recording
              </Button>
            )}
          </>
        )}
      </div>

      {cameraPermission === "prompt" && !isStreaming && (
        <p className="text-muted-foreground text-sm text-center max-w-md">
          Click &quot;Start Camera&quot; to enable your camera and begin recording your movement.
        </p>
      )}
    </div>
  )
}
