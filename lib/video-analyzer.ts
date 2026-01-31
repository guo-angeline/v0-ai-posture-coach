"use client"

// Video analyzer using TensorFlow.js MoveNet via CDN
import type { PoseFrame, Keypoint } from "./pose-detection"
import {
  analyzeShoulderPress,
  analyzeSquat,
  analyzePosture,
  analyzeLunge,
  analyzeLatPulldown,
  analyzeLateralFly,
  type AnalysisResult,
} from "./exercise-analysis"

type ExerciseType = "squat" | "posture" | "lunge" | "shoulder-press" | "lat-pulldown" | "lateral-fly"

// Global state
let detector: any = null
let isLoading = false
let loadError: string | null = null

// MoveNet keypoint names (17 keypoints)
const MOVENET_KEYPOINT_NAMES = [
  "nose", "left_eye", "right_eye", "left_ear", "right_ear",
  "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
  "left_wrist", "right_wrist", "left_hip", "right_hip",
  "left_knee", "right_knee", "left_ankle", "right_ankle",
]

// Load script from CDN
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

async function loadDetector(onProgress?: (progress: number, status: string) => void): Promise<boolean> {
  if (detector) return true
  if (loadError) {
    // Reset error on retry
    loadError = null
  }
  if (isLoading) {
    // Wait for existing load to complete
    const timeout = Date.now() + 30000
    while (isLoading && Date.now() < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return detector !== null
  }

  isLoading = true
  console.log("[v0] Starting TensorFlow.js CDN loading...")

  try {
    onProgress?.(5, "Loading TensorFlow.js...")
    
    // Load TensorFlow.js core via CDN
    await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js")
    console.log("[v0] TensorFlow.js loaded")
    
    // Wait for tf to be available
    let attempts = 0
    while (!(window as any).tf && attempts < 50) {
      await new Promise(r => setTimeout(r, 100))
      attempts++
    }
    
    const tf = (window as any).tf
    if (!tf) {
      throw new Error("TensorFlow.js not available after loading")
    }
    
    onProgress?.(15, "Setting up WebGL backend...")
    await tf.ready()
    console.log("[v0] TensorFlow.js ready, backend:", tf.getBackend())
    
    onProgress?.(20, "Loading pose detection model...")
    
    // Load pose detection library via CDN
    await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js")
    console.log("[v0] Pose detection library loaded")
    
    // Wait for poseDetection to be available
    attempts = 0
    while (!(window as any).poseDetection && attempts < 50) {
      await new Promise(r => setTimeout(r, 100))
      attempts++
    }
    
    const poseDetection = (window as any).poseDetection
    if (!poseDetection) {
      throw new Error("Pose detection library not available after loading")
    }
    
    onProgress?.(30, "Creating pose detector...")
    
    // Create MoveNet detector
    detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      }
    )
    console.log("[v0] MoveNet detector created successfully")
    
    return true
  } catch (error) {
    console.error("[v0] Failed to load detector:", error)
    loadError = error instanceof Error ? error.message : "Unknown error"
    return false
  } finally {
    isLoading = false
  }
}

async function detectPoseInFrame(
  video: HTMLVideoElement,
  timestamp: number
): Promise<PoseFrame> {
  if (!detector) {
    return { timestamp, keypoints: [], visibleKeypoints: [] }
  }

  try {
    const poses = await detector.estimatePoses(video, {
      flipHorizontal: false,
    })

    if (!poses || poses.length === 0 || !poses[0].keypoints) {
      return { timestamp, keypoints: [], visibleKeypoints: [] }
    }

    const keypoints: Keypoint[] = poses[0].keypoints.map(
      (kp: any, index: number) => ({
        x: kp.x / video.videoWidth,
        y: kp.y / video.videoHeight,
        score: kp.score || 0,
        name: kp.name || MOVENET_KEYPOINT_NAMES[index] || `keypoint_${index}`,
      })
    )

    const visibleKeypoints = keypoints
      .filter((k) => k.score >= 0.3)
      .map((k) => k.name)

    return { timestamp, keypoints, visibleKeypoints }
  } catch (error) {
    console.error("[v0] Pose detection error:", error)
    return { timestamp, keypoints: [], visibleKeypoints: [] }
  }
}

export async function analyzeVideo(
  videoBlob: Blob,
  exerciseType: ExerciseType,
  onProgress?: (progress: number, status: string) => void
): Promise<AnalysisResult> {
  console.log("[v0] analyzeVideo called for:", exerciseType)
  
  // Create video element
  const video = document.createElement("video")
  video.muted = true
  video.playsInline = true

  // Load video
  onProgress?.(5, "Loading video...")
  const videoUrl = URL.createObjectURL(videoBlob)
  video.src = videoUrl

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Video load timeout")), 10000)
      video.onloadedmetadata = () => {
        clearTimeout(timeout)
        video.width = video.videoWidth
        video.height = video.videoHeight
        console.log("[v0] Video loaded:", video.videoWidth, "x", video.videoHeight, "duration:", video.duration)
        resolve()
      }
      video.onerror = () => {
        clearTimeout(timeout)
        reject(new Error("Failed to load video"))
      }
    })
  } catch (error) {
    URL.revokeObjectURL(videoUrl)
    return {
      score: 0,
      feedback: [
        {
          type: "warning",
          title: "Video loading failed",
          description: "Could not load the recorded video. Please try again.",
        },
      ],
      visibleParts: [],
      confidence: 0,
    }
  }

  // Load detector
  const loaded = await loadDetector(onProgress)

  if (!loaded) {
    URL.revokeObjectURL(videoUrl)
    return {
      score: 0,
      feedback: [
        {
          type: "warning",
          title: "Model loading failed",
          description: `Could not load the pose detection model: ${loadError}. Please refresh the page and try again.`,
        },
      ],
      visibleParts: [],
      confidence: 0,
    }
  }

  // Extract frames and detect poses
  const duration = Math.min(video.duration, 10) // Cap at 10 seconds
  const frameInterval = 0.2
  const frames: PoseFrame[] = []

  onProgress?.(40, "Analyzing movement...")
  console.log("[v0] Starting frame analysis, duration:", duration)

  // Seek to start
  video.currentTime = 0
  await new Promise<void>((resolve) => {
    const handler = () => {
      video.removeEventListener("seeked", handler)
      resolve()
    }
    video.addEventListener("seeked", handler)
  })

  let frameCount = 0
  const totalFrames = Math.ceil(duration / frameInterval)
  
  for (let time = 0; time < duration; time += frameInterval) {
    video.currentTime = time
    await new Promise<void>((resolve) => {
      const handler = () => {
        video.removeEventListener("seeked", handler)
        resolve()
      }
      video.addEventListener("seeked", handler)
    })

    // Wait for frame to render
    await new Promise((resolve) => setTimeout(resolve, 50))

    const frame = await detectPoseInFrame(video, time)
    frames.push(frame)
    frameCount++

    const progress = 40 + (frameCount / totalFrames) * 45
    onProgress?.(Math.min(progress, 85), `Analyzing frame ${frameCount}/${totalFrames}...`)
  }

  console.log("[v0] Analyzed frames:", frames.length)
  if (frames.length > 0) {
    const firstWithKeypoints = frames.find(f => f.keypoints.length > 0)
    if (firstWithKeypoints) {
      console.log("[v0] Sample keypoints:", firstWithKeypoints.keypoints.length)
      console.log("[v0] Visible parts:", firstWithKeypoints.visibleKeypoints.join(", "))
    } else {
      console.log("[v0] No keypoints detected in any frame")
    }
  }

  // Clean up
  URL.revokeObjectURL(videoUrl)

  onProgress?.(90, "Generating feedback...")

  // Run exercise-specific analysis
  let result: AnalysisResult

  switch (exerciseType) {
    case "shoulder-press":
      result = analyzeShoulderPress(frames)
      break
    case "squat":
      result = analyzeSquat(frames)
      break
    case "posture":
      result = analyzePosture(frames)
      break
    case "lunge":
      result = analyzeLunge(frames)
      break
    case "lat-pulldown":
      result = analyzeLatPulldown(frames)
      break
    case "lateral-fly":
      result = analyzeLateralFly(frames)
      break
    default:
      result = {
        score: 0,
        feedback: [
          {
            type: "warning",
            title: "Unknown exercise",
            description: "This exercise type is not yet supported.",
          },
        ],
        visibleParts: [],
        confidence: 0,
      }
  }

  onProgress?.(100, "Complete!")
  console.log("[v0] Analysis complete, score:", result.score)

  return result
}
