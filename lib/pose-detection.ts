// Pose detection using MediaPipe Pose via TensorFlow.js
// This module handles real pose detection and keypoint extraction

export interface Keypoint {
  x: number
  y: number
  score: number
  name: string
}

export interface PoseFrame {
  timestamp: number
  keypoints: Keypoint[]
  visibleKeypoints: string[]
}

export interface PoseAnalysisResult {
  frames: PoseFrame[]
  visibleBodyParts: string[]
  frameCount: number
  avgKeypointConfidence: number
}

// MoveNet keypoint names in order (17 keypoints)
export const KEYPOINT_NAMES = [
  'nose',
  'left_eye',
  'right_eye',
  'left_ear',
  'right_ear',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
]

// Body part groups for readability (MoveNet doesn't have hands/feet detail)
export const BODY_PART_GROUPS = {
  head: ['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear'],
  shoulders: ['left_shoulder', 'right_shoulder'],
  arms: ['left_elbow', 'right_elbow', 'left_wrist', 'right_wrist'],
  wrists: ['left_wrist', 'right_wrist'],
  elbows: ['left_elbow', 'right_elbow'],
  torso: ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'],
  hips: ['left_hip', 'right_hip'],
  legs: ['left_knee', 'right_knee', 'left_ankle', 'right_ankle'],
  knees: ['left_knee', 'right_knee'],
  ankles: ['left_ankle', 'right_ankle'],
}

const MIN_CONFIDENCE = 0.3

export function isBodyPartVisible(keypoints: Keypoint[], partNames: string[]): boolean {
  return partNames.some(name => {
    const kp = keypoints.find(k => k.name === name)
    return kp && kp.score >= MIN_CONFIDENCE
  })
}

export function getVisibleBodyPartGroups(keypoints: Keypoint[]): string[] {
  const visible: string[] = []
  for (const [group, parts] of Object.entries(BODY_PART_GROUPS)) {
    if (isBodyPartVisible(keypoints, parts)) {
      visible.push(group)
    }
  }
  return visible
}

export function getKeypoint(keypoints: Keypoint[], name: string): Keypoint | null {
  const kp = keypoints.find(k => k.name === name)
  return kp && kp.score >= MIN_CONFIDENCE ? kp : null
}

// Calculate angle between three points (in degrees)
export function calculateAngle(a: Keypoint, b: Keypoint, c: Keypoint): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x)
  let angle = Math.abs(radians * 180 / Math.PI)
  if (angle > 180) angle = 360 - angle
  return angle
}

// Calculate vertical alignment (how straight a line of points is)
export function calculateVerticalAlignment(points: Keypoint[]): number {
  if (points.length < 2) return 1
  const xs = points.map(p => p.x)
  const xRange = Math.max(...xs) - Math.min(...xs)
  const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length
  const yRange = Math.max(...points.map(p => Math.abs(p.y - avgY)))
  // Lower xRange relative to yRange means more vertical
  return Math.max(0, 1 - (xRange / (yRange || 1)))
}

// Calculate horizontal symmetry between left and right keypoints
export function calculateSymmetry(leftKp: Keypoint | null, rightKp: Keypoint | null, centerX: number): number {
  if (!leftKp || !rightKp) return -1 // Cannot calculate
  const leftDist = Math.abs(leftKp.x - centerX)
  const rightDist = Math.abs(rightKp.x - centerX)
  const maxDist = Math.max(leftDist, rightDist)
  if (maxDist === 0) return 1
  return 1 - Math.abs(leftDist - rightDist) / maxDist
}

// Detect shakiness by measuring position variance across frames
export function detectShakiness(frames: PoseFrame[], keypointName: string): { isShaky: boolean; variance: number } {
  const positions = frames
    .map(f => f.keypoints.find(k => k.name === keypointName))
    .filter(k => k && k.score >= MIN_CONFIDENCE) as Keypoint[]
  
  if (positions.length < 3) return { isShaky: false, variance: 0 }
  
  const avgX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length
  const avgY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length
  
  const variance = positions.reduce((sum, p) => {
    return sum + Math.sqrt(Math.pow(p.x - avgX, 2) + Math.pow(p.y - avgY, 2))
  }, 0) / positions.length
  
  // Threshold for shakiness (normalized to frame size, assuming 0-1 range)
  const isShaky = variance > 0.03
  
  return { isShaky, variance }
}

// Detect range of motion by tracking keypoint movement
export function detectRangeOfMotion(frames: PoseFrame[], keypointName: string): { 
  hasFullRange: boolean
  movementRange: number
  minY: number
  maxY: number
} {
  const positions = frames
    .map(f => f.keypoints.find(k => k.name === keypointName))
    .filter(k => k && k.score >= MIN_CONFIDENCE) as Keypoint[]
  
  if (positions.length < 3) {
    return { hasFullRange: false, movementRange: 0, minY: 0, maxY: 0 }
  }
  
  const yValues = positions.map(p => p.y)
  const minY = Math.min(...yValues)
  const maxY = Math.max(...yValues)
  const movementRange = maxY - minY
  
  // For overhead movements like shoulder press, we expect significant Y movement
  // Threshold depends on exercise type - this is a general check
  const hasFullRange = movementRange > 0.15 // 15% of frame height
  
  return { hasFullRange, movementRange, minY, maxY }
}

// Check if arms reach overhead position
export function checkOverheadPosition(frames: PoseFrame[]): {
  reachesOverhead: boolean
  highestWristY: number
  shoulderY: number
} {
  let highestWristY = 1 // Start at bottom (y increases downward in video coords)
  let shoulderY = 0.5
  
  for (const frame of frames) {
    const leftWrist = getKeypoint(frame.keypoints, 'left_wrist')
    const rightWrist = getKeypoint(frame.keypoints, 'right_wrist')
    const leftShoulder = getKeypoint(frame.keypoints, 'left_shoulder')
    const rightShoulder = getKeypoint(frame.keypoints, 'right_shoulder')
    
    if (leftWrist) highestWristY = Math.min(highestWristY, leftWrist.y)
    if (rightWrist) highestWristY = Math.min(highestWristY, rightWrist.y)
    
    if (leftShoulder && rightShoulder) {
      shoulderY = (leftShoulder.y + rightShoulder.y) / 2
    }
  }
  
  // Wrists should go above shoulders for overhead press
  const reachesOverhead = highestWristY < shoulderY - 0.05
  
  return { reachesOverhead, highestWristY, shoulderY }
}

// Check elbow angle at various points
export function analyzeElbowAngles(frames: PoseFrame[], side: 'left' | 'right'): {
  minAngle: number
  maxAngle: number
  avgAngle: number
  hasData: boolean
} {
  const angles: number[] = []
  
  const shoulderName = `${side}_shoulder`
  const elbowName = `${side}_elbow`
  const wristName = `${side}_wrist`
  
  for (const frame of frames) {
    const shoulder = getKeypoint(frame.keypoints, shoulderName)
    const elbow = getKeypoint(frame.keypoints, elbowName)
    const wrist = getKeypoint(frame.keypoints, wristName)
    
    if (shoulder && elbow && wrist) {
      angles.push(calculateAngle(shoulder, elbow, wrist))
    }
  }
  
  if (angles.length === 0) {
    return { minAngle: 0, maxAngle: 0, avgAngle: 0, hasData: false }
  }
  
  return {
    minAngle: Math.min(...angles),
    maxAngle: Math.max(...angles),
    avgAngle: angles.reduce((a, b) => a + b, 0) / angles.length,
    hasData: true,
  }
}

// Check knee angle for squats/lunges
export function analyzeKneeAngles(frames: PoseFrame[], side: 'left' | 'right'): {
  minAngle: number
  maxAngle: number
  hasData: boolean
} {
  const angles: number[] = []
  
  const hipName = `${side}_hip`
  const kneeName = `${side}_knee`
  const ankleName = `${side}_ankle`
  
  for (const frame of frames) {
    const hip = getKeypoint(frame.keypoints, hipName)
    const knee = getKeypoint(frame.keypoints, kneeName)
    const ankle = getKeypoint(frame.keypoints, ankleName)
    
    if (hip && knee && ankle) {
      angles.push(calculateAngle(hip, knee, ankle))
    }
  }
  
  if (angles.length === 0) {
    return { minAngle: 0, maxAngle: 0, hasData: false }
  }
  
  return {
    minAngle: Math.min(...angles),
    maxAngle: Math.max(...angles),
    hasData: true,
  }
}

// Check if hips/lower back are visible
export function isLowerBackVisible(keypoints: Keypoint[]): boolean {
  const leftHip = getKeypoint(keypoints, 'left_hip')
  const rightHip = getKeypoint(keypoints, 'right_hip')
  // We can only assess lower back if we can see both hips
  return leftHip !== null && rightHip !== null
}

// Analyze hip alignment
export function analyzeHipAlignment(frames: PoseFrame[]): {
  isLevel: boolean
  avgTilt: number
  hasData: boolean
} {
  const tilts: number[] = []
  
  for (const frame of frames) {
    const leftHip = getKeypoint(frame.keypoints, 'left_hip')
    const rightHip = getKeypoint(frame.keypoints, 'right_hip')
    
    if (leftHip && rightHip) {
      const tilt = Math.abs(leftHip.y - rightHip.y)
      tilts.push(tilt)
    }
  }
  
  if (tilts.length === 0) {
    return { isLevel: false, avgTilt: 0, hasData: false }
  }
  
  const avgTilt = tilts.reduce((a, b) => a + b, 0) / tilts.length
  
  return {
    isLevel: avgTilt < 0.03, // Less than 3% frame height difference
    avgTilt,
    hasData: true,
  }
}
