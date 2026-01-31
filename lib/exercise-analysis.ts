// Exercise-specific analysis that generates grounded feedback
// Only reports on what is actually visible in the video

import {
  type PoseFrame,
  getKeypoint,
  getVisibleBodyPartGroups,
  detectShakiness,
  detectRangeOfMotion,
  checkOverheadPosition,
  analyzeElbowAngles,
  analyzeKneeAngles,
  analyzeHipAlignment,
  calculateAngle,
  isLowerBackVisible,
} from './pose-detection'

export interface FeedbackItem {
  type: 'success' | 'warning' | 'tip'
  title: string
  description: string
}

export interface AnalysisResult {
  score: number
  feedback: FeedbackItem[]
  visibleParts: string[]
  confidence: number
}

// Helper to add feedback only if we have data to support it
function addFeedbackIfGrounded(
  feedback: FeedbackItem[],
  condition: boolean,
  item: FeedbackItem
) {
  if (condition) {
    feedback.push(item)
  }
}

export function analyzeShoulderPress(frames: PoseFrame[]): AnalysisResult {
  const feedback: FeedbackItem[] = []
  let score = 50 // Base score
  const issues: string[] = []
  
  if (frames.length === 0) {
    return {
      score: 0,
      feedback: [{
        type: 'warning',
        title: 'No pose detected',
        description: 'Could not detect your body in the video. Please ensure you are visible in the frame and try again.',
      }],
      visibleParts: [],
      confidence: 0,
    }
  }
  
  // Get visible body parts from first frame with good detection
  const sampleFrame = frames.find(f => f.keypoints.length > 0) || frames[0]
  const visibleParts = getVisibleBodyPartGroups(sampleFrame.keypoints)
  
  // Check what we can actually analyze
  const canSeeShoulders = visibleParts.includes('shoulders')
  const canSeeArms = visibleParts.includes('arms')
  const canSeeHands = visibleParts.includes('hands')
  const canSeeTorso = visibleParts.includes('torso')
  const canSeeHips = visibleParts.includes('hips')
  
  // Calculate average confidence
  const avgConfidence = frames.reduce((sum, f) => {
    const scores = f.keypoints.map(k => k.score)
    return sum + (scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0)
  }, 0) / frames.length
  
  // Only analyze if we can see arms and shoulders
  if (!canSeeShoulders || !canSeeArms) {
    feedback.push({
      type: 'warning',
      title: 'Limited visibility',
      description: `Cannot fully analyze shoulder press - ${!canSeeShoulders ? 'shoulders' : 'arms'} not clearly visible. Please position yourself so your upper body is in frame.`,
    })
    return { score: 30, feedback, visibleParts, confidence: avgConfidence }
  }
  
  // 1. Check for shakiness in hands/wrists
  const leftWristShake = detectShakiness(frames, 'left_wrist')
  const rightWristShake = detectShakiness(frames, 'right_wrist')
  
  if (leftWristShake.isShaky || rightWristShake.isShaky) {
    const shakySide = leftWristShake.variance > rightWristShake.variance ? 'left' : 'right'
    feedback.push({
      type: 'warning',
      title: 'Hand stability',
      description: `Detected shaking in your ${shakySide} hand during the movement. This may indicate the weight is too heavy or you're fatiguing. Consider reducing weight or taking a rest.`,
    })
    score -= 15
    issues.push('shakiness')
  } else if (canSeeHands) {
    feedback.push({
      type: 'success',
      title: 'Stable hands',
      description: 'Your hands remained steady throughout the movement, showing good control.',
    })
    score += 10
  }
  
  // 2. Check range of motion
  const overhead = checkOverheadPosition(frames)
  const leftWristROM = detectRangeOfMotion(frames, 'left_wrist')
  const rightWristROM = detectRangeOfMotion(frames, 'right_wrist')
  
  if (!overhead.reachesOverhead) {
    feedback.push({
      type: 'warning',
      title: 'Limited range of motion',
      description: 'Your hands did not reach a full overhead position. For a complete shoulder press, extend your arms fully above your shoulders at the top of the movement.',
    })
    score -= 20
    issues.push('rom')
  } else {
    const hasGoodROM = leftWristROM.hasFullRange || rightWristROM.hasFullRange
    if (hasGoodROM) {
      feedback.push({
        type: 'success',
        title: 'Good range of motion',
        description: 'You achieved full overhead extension with your arms. Great job completing the full movement!',
      })
      score += 15
    }
  }
  
  // 3. Check elbow angles
  const leftElbow = analyzeElbowAngles(frames, 'left')
  const rightElbow = analyzeElbowAngles(frames, 'right')
  
  if (leftElbow.hasData || rightElbow.hasData) {
    const elbowData = leftElbow.hasData ? leftElbow : rightElbow
    
    // At lockout, elbow should be near 180 degrees
    if (elbowData.maxAngle < 160) {
      feedback.push({
        type: 'tip',
        title: 'Elbow extension',
        description: `Your elbows reached about ${Math.round(elbowData.maxAngle)} degrees at the top. For full range of motion, aim to fully extend (straighten) your elbows overhead.`,
      })
    }
    
    // Starting position should have elbows around 90 degrees
    if (elbowData.minAngle > 110) {
      feedback.push({
        type: 'tip',
        title: 'Starting position',
        description: 'Your starting position shows limited elbow bend. Begin with elbows at about 90 degrees for a fuller range of motion.',
      })
    }
  }
  
  // 4. Check hip/lower back ONLY if visible
  if (canSeeHips && canSeeTorso) {
    const lastFrameWithHips = [...frames].reverse().find(f => 
      getKeypoint(f.keypoints, 'left_hip') && getKeypoint(f.keypoints, 'right_hip')
    )
    
    if (lastFrameWithHips && isLowerBackVisible(lastFrameWithHips.keypoints)) {
      const hipAlignment = analyzeHipAlignment(frames)
      
      if (hipAlignment.hasData && !hipAlignment.isLevel) {
        feedback.push({
          type: 'warning',
          title: 'Hip alignment',
          description: 'Detected uneven hips during the movement. Try to keep your hips level and avoid shifting weight to one side.',
        })
        score -= 10
      }
    }
  } else {
    // Explicitly note that we cannot assess lower back
    feedback.push({
      type: 'tip',
      title: 'Lower back not visible',
      description: 'Your hips/lower back were not visible in the frame, so we cannot assess core stability or back position. Position the camera to show your full torso for more complete feedback.',
    })
  }
  
  // 5. Check shoulder symmetry
  const shoulderSymmetryFrames = frames.filter(f => 
    getKeypoint(f.keypoints, 'left_shoulder') && getKeypoint(f.keypoints, 'right_shoulder')
  )
  
  if (shoulderSymmetryFrames.length > 0) {
    let asymmetricCount = 0
    for (const frame of shoulderSymmetryFrames) {
      const leftShoulder = getKeypoint(frame.keypoints, 'left_shoulder')!
      const rightShoulder = getKeypoint(frame.keypoints, 'right_shoulder')!
      const heightDiff = Math.abs(leftShoulder.y - rightShoulder.y)
      if (heightDiff > 0.05) asymmetricCount++
    }
    
    if (asymmetricCount > shoulderSymmetryFrames.length * 0.5) {
      feedback.push({
        type: 'warning',
        title: 'Shoulder imbalance',
        description: 'One shoulder appears higher than the other during the press. Focus on pressing evenly with both arms.',
      })
      score -= 10
    } else {
      feedback.push({
        type: 'success',
        title: 'Shoulder alignment',
        description: 'Your shoulders remained level throughout the movement, showing good balance.',
      })
      score += 5
    }
  }
  
  // Clamp score
  score = Math.max(0, Math.min(100, score))
  
  return {
    score,
    feedback,
    visibleParts,
    confidence: avgConfidence,
  }
}

export function analyzeSquat(frames: PoseFrame[]): AnalysisResult {
  const feedback: FeedbackItem[] = []
  let score = 50
  
  if (frames.length === 0) {
    return {
      score: 0,
      feedback: [{
        type: 'warning',
        title: 'No pose detected',
        description: 'Could not detect your body in the video. Please ensure you are visible in the frame and try again.',
      }],
      visibleParts: [],
      confidence: 0,
    }
  }
  
  const sampleFrame = frames.find(f => f.keypoints.length > 0) || frames[0]
  const visibleParts = getVisibleBodyPartGroups(sampleFrame.keypoints)
  
  const canSeeHips = visibleParts.includes('hips')
  const canSeeLegs = visibleParts.includes('legs')
  const canSeeFeet = visibleParts.includes('feet')
  
  const avgConfidence = frames.reduce((sum, f) => {
    const scores = f.keypoints.map(k => k.score)
    return sum + (scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0)
  }, 0) / frames.length
  
  if (!canSeeLegs) {
    feedback.push({
      type: 'warning',
      title: 'Legs not visible',
      description: 'Cannot analyze squat form - your legs are not visible in the frame. Please position the camera to capture your full body.',
    })
    return { score: 20, feedback, visibleParts, confidence: avgConfidence }
  }
  
  // Analyze knee angles
  const leftKnee = analyzeKneeAngles(frames, 'left')
  const rightKnee = analyzeKneeAngles(frames, 'right')
  
  if (leftKnee.hasData || rightKnee.hasData) {
    const kneeData = leftKnee.hasData ? leftKnee : rightKnee
    
    // Good squat depth: knee angle should get below 90 degrees
    if (kneeData.minAngle > 100) {
      feedback.push({
        type: 'warning',
        title: 'Squat depth',
        description: `Your lowest knee angle was about ${Math.round(kneeData.minAngle)} degrees. For proper depth, aim to bend your knees to 90 degrees or below (hips at or below knee level).`,
      })
      score -= 15
    } else if (kneeData.minAngle <= 90) {
      feedback.push({
        type: 'success',
        title: 'Good squat depth',
        description: 'You achieved proper squat depth with your hips at or below knee level. Excellent!',
      })
      score += 20
    }
    
    // Check range of motion
    const angleRange = kneeData.maxAngle - kneeData.minAngle
    if (angleRange < 30) {
      feedback.push({
        type: 'warning',
        title: 'Limited movement',
        description: 'Very little knee bend detected. Ensure you are performing the full squatting motion - bending and straightening your knees.',
      })
      score -= 15
    }
  } else {
    feedback.push({
      type: 'warning',
      title: 'Could not track knees',
      description: 'Knee positions could not be reliably tracked. Ensure your legs are clearly visible throughout the movement.',
    })
  }
  
  // Check hip movement
  if (canSeeHips) {
    const hipROM = detectRangeOfMotion(frames, 'left_hip')
    if (hipROM.movementRange < 0.1) {
      feedback.push({
        type: 'warning',
        title: 'Limited hip movement',
        description: 'Your hips did not move much vertically. In a proper squat, your hips should lower significantly as you descend.',
      })
      score -= 10
    }
  } else {
    feedback.push({
      type: 'tip',
      title: 'Hips not visible',
      description: 'Your hip position was not clearly visible, limiting our ability to assess depth and hip hinge. Try to show your full body in frame.',
    })
  }
  
  // Check for knee tracking (if we can see both knees and ankles)
  const kneeAnkleFrames = frames.filter(f => 
    getKeypoint(f.keypoints, 'left_knee') && 
    getKeypoint(f.keypoints, 'left_ankle') &&
    getKeypoint(f.keypoints, 'right_knee') &&
    getKeypoint(f.keypoints, 'right_ankle')
  )
  
  if (kneeAnkleFrames.length > frames.length * 0.3) {
    let caveInCount = 0
    for (const frame of kneeAnkleFrames) {
      const leftKnee = getKeypoint(frame.keypoints, 'left_knee')!
      const leftAnkle = getKeypoint(frame.keypoints, 'left_ankle')!
      const rightKnee = getKeypoint(frame.keypoints, 'right_knee')!
      const rightAnkle = getKeypoint(frame.keypoints, 'right_ankle')!
      
      // Check if knees are caving inward (knees closer together than ankles)
      const kneeWidth = Math.abs(leftKnee.x - rightKnee.x)
      const ankleWidth = Math.abs(leftAnkle.x - rightAnkle.x)
      
      if (kneeWidth < ankleWidth * 0.85) {
        caveInCount++
      }
    }
    
    if (caveInCount > kneeAnkleFrames.length * 0.3) {
      feedback.push({
        type: 'warning',
        title: 'Knee tracking',
        description: 'Your knees appear to be caving inward during the squat. Focus on pushing your knees out in line with your toes.',
      })
      score -= 15
    } else {
      feedback.push({
        type: 'success',
        title: 'Good knee tracking',
        description: 'Your knees are tracking well over your toes without caving inward.',
      })
      score += 10
    }
  }
  
  score = Math.max(0, Math.min(100, score))
  
  return {
    score,
    feedback,
    visibleParts,
    confidence: avgConfidence,
  }
}

export function analyzePosture(frames: PoseFrame[]): AnalysisResult {
  const feedback: FeedbackItem[] = []
  let score = 50
  
  if (frames.length === 0) {
    return {
      score: 0,
      feedback: [{
        type: 'warning',
        title: 'No pose detected',
        description: 'Could not detect your body in the video. Please ensure you are visible in the frame and try again.',
      }],
      visibleParts: [],
      confidence: 0,
    }
  }
  
  const sampleFrame = frames.find(f => f.keypoints.length > 0) || frames[0]
  const visibleParts = getVisibleBodyPartGroups(sampleFrame.keypoints)
  
  const canSeeHead = visibleParts.includes('head')
  const canSeeShoulders = visibleParts.includes('shoulders')
  const canSeeTorso = visibleParts.includes('torso')
  
  const avgConfidence = frames.reduce((sum, f) => {
    const scores = f.keypoints.map(k => k.score)
    return sum + (scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0)
  }, 0) / frames.length
  
  if (!canSeeShoulders) {
    feedback.push({
      type: 'warning',
      title: 'Upper body not visible',
      description: 'Cannot analyze posture - your shoulders and upper body need to be visible.',
    })
    return { score: 20, feedback, visibleParts, confidence: avgConfidence }
  }
  
  // Check shoulder level
  const shoulderFrames = frames.filter(f => 
    getKeypoint(f.keypoints, 'left_shoulder') && getKeypoint(f.keypoints, 'right_shoulder')
  )
  
  if (shoulderFrames.length > 0) {
    let unevenCount = 0
    for (const frame of shoulderFrames) {
      const left = getKeypoint(frame.keypoints, 'left_shoulder')!
      const right = getKeypoint(frame.keypoints, 'right_shoulder')!
      if (Math.abs(left.y - right.y) > 0.04) unevenCount++
    }
    
    if (unevenCount > shoulderFrames.length * 0.5) {
      feedback.push({
        type: 'warning',
        title: 'Uneven shoulders',
        description: 'One shoulder appears higher than the other. This could indicate muscle imbalance or habitual posture. Focus on leveling your shoulders.',
      })
      score -= 15
    } else {
      feedback.push({
        type: 'success',
        title: 'Level shoulders',
        description: 'Your shoulders are well-aligned and level. Good posture foundation!',
      })
      score += 15
    }
  }
  
  // Check head position relative to shoulders (forward head posture)
  if (canSeeHead && canSeeShoulders) {
    const headShoulderFrames = frames.filter(f => 
      getKeypoint(f.keypoints, 'nose') && 
      getKeypoint(f.keypoints, 'left_shoulder') &&
      getKeypoint(f.keypoints, 'right_shoulder')
    )
    
    if (headShoulderFrames.length > 0) {
      let forwardHeadCount = 0
      for (const frame of headShoulderFrames) {
        const nose = getKeypoint(frame.keypoints, 'nose')!
        const leftShoulder = getKeypoint(frame.keypoints, 'left_shoulder')!
        const rightShoulder = getKeypoint(frame.keypoints, 'right_shoulder')!
        
        // This is a side-view check - not always applicable from front view
        // We can check if head is significantly forward of shoulder midpoint
        const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2
        const headOffset = Math.abs(nose.x - shoulderMidX)
        
        // If viewing from side, significant forward head would show
        if (headOffset > 0.15) forwardHeadCount++
      }
      
      if (forwardHeadCount > headShoulderFrames.length * 0.5) {
        feedback.push({
          type: 'tip',
          title: 'Head position',
          description: 'Your head may be positioned forward of your shoulders. If viewing from the side, try to align your ear over your shoulder.',
        })
      }
    }
  }
  
  // Check for shoulder rounding (if we can see enough of torso)
  if (canSeeTorso) {
    feedback.push({
      type: 'tip',
      title: 'Shoulder position',
      description: 'For better posture assessment of shoulder rounding, a side view recording would be helpful. From the front, keep your shoulders pulled back gently.',
    })
  }
  
  score = Math.max(0, Math.min(100, score))
  
  return {
    score,
    feedback,
    visibleParts,
    confidence: avgConfidence,
  }
}

export function analyzeLunge(frames: PoseFrame[]): AnalysisResult {
  const feedback: FeedbackItem[] = []
  let score = 50
  
  if (frames.length === 0) {
    return {
      score: 0,
      feedback: [{
        type: 'warning',
        title: 'No pose detected',
        description: 'Could not detect your body in the video. Please ensure you are visible in the frame and try again.',
      }],
      visibleParts: [],
      confidence: 0,
    }
  }
  
  const sampleFrame = frames.find(f => f.keypoints.length > 0) || frames[0]
  const visibleParts = getVisibleBodyPartGroups(sampleFrame.keypoints)
  
  const canSeeLegs = visibleParts.includes('legs')
  const canSeeHips = visibleParts.includes('hips')
  
  const avgConfidence = frames.reduce((sum, f) => {
    const scores = f.keypoints.map(k => k.score)
    return sum + (scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0)
  }, 0) / frames.length
  
  if (!canSeeLegs) {
    feedback.push({
      type: 'warning',
      title: 'Legs not visible',
      description: 'Cannot analyze lunge form - your legs are not visible in the frame.',
    })
    return { score: 20, feedback, visibleParts, confidence: avgConfidence }
  }
  
  // Analyze knee angles for both legs
  const leftKnee = analyzeKneeAngles(frames, 'left')
  const rightKnee = analyzeKneeAngles(frames, 'right')
  
  if (leftKnee.hasData && rightKnee.hasData) {
    // In a lunge, front knee should bend significantly
    const frontKneeAngle = Math.min(leftKnee.minAngle, rightKnee.minAngle)
    
    if (frontKneeAngle > 110) {
      feedback.push({
        type: 'warning',
        title: 'Lunge depth',
        description: 'Your front knee is not bending enough. Aim for about 90 degrees at the bottom of the lunge.',
      })
      score -= 15
    } else if (frontKneeAngle <= 95) {
      feedback.push({
        type: 'success',
        title: 'Good lunge depth',
        description: 'You achieved proper depth with your front knee at about 90 degrees. Nice work!',
      })
      score += 15
    }
  } else if (leftKnee.hasData || rightKnee.hasData) {
    const kneeData = leftKnee.hasData ? leftKnee : rightKnee
    feedback.push({
      type: 'tip',
      title: 'Partial visibility',
      description: `Only one leg was clearly visible. The visible knee reached about ${Math.round(kneeData.minAngle)} degrees.`,
    })
  }
  
  // Check balance (hip stability)
  if (canSeeHips) {
    const hipAlign = analyzeHipAlignment(frames)
    if (hipAlign.hasData) {
      if (!hipAlign.isLevel) {
        feedback.push({
          type: 'warning',
          title: 'Balance',
          description: 'Your hips appear to tilt during the lunge. Focus on keeping your hips level and core engaged for better stability.',
        })
        score -= 10
      } else {
        feedback.push({
          type: 'success',
          title: 'Good hip stability',
          description: 'Your hips remained level throughout the lunge, showing good balance and core engagement.',
        })
        score += 10
      }
    }
  } else {
    feedback.push({
      type: 'tip',
      title: 'Hips not visible',
      description: 'Your hips were not clearly visible, so we could not assess your balance and stability.',
    })
  }
  
  score = Math.max(0, Math.min(100, score))
  
  return {
    score,
    feedback,
    visibleParts,
    confidence: avgConfidence,
  }
}

export function analyzeLatPulldown(frames: PoseFrame[]): AnalysisResult {
  const feedback: FeedbackItem[] = []
  let score = 50
  
  if (frames.length === 0) {
    return {
      score: 0,
      feedback: [{
        type: 'warning',
        title: 'No pose detected',
        description: 'Could not detect your body in the video. Please ensure you are visible in the frame and try again.',
      }],
      visibleParts: [],
      confidence: 0,
    }
  }
  
  const sampleFrame = frames.find(f => f.keypoints.length > 0) || frames[0]
  const visibleParts = getVisibleBodyPartGroups(sampleFrame.keypoints)
  
  const canSeeShoulders = visibleParts.includes('shoulders')
  const canSeeArms = visibleParts.includes('arms')
  
  const avgConfidence = frames.reduce((sum, f) => {
    const scores = f.keypoints.map(k => k.score)
    return sum + (scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0)
  }, 0) / frames.length
  
  if (!canSeeShoulders || !canSeeArms) {
    feedback.push({
      type: 'warning',
      title: 'Limited visibility',
      description: 'Cannot fully analyze lat pulldown - your upper body and arms need to be visible. Please position yourself so your shoulders and arms are in frame.',
    })
    return { score: 30, feedback, visibleParts, confidence: avgConfidence }
  }
  
  // 1. Check elbow movement (should move downward during pull)
  const leftElbow = analyzeElbowAngles(frames, 'left')
  const rightElbow = analyzeElbowAngles(frames, 'right')
  
  if (leftElbow.hasData || rightElbow.hasData) {
    const elbowData = leftElbow.hasData ? leftElbow : rightElbow
    
    // At bottom of pull, elbows should be bent (around 90 degrees or less)
    if (elbowData.minAngle > 110) {
      feedback.push({
        type: 'warning',
        title: 'Pull depth',
        description: `Your elbows only bent to about ${Math.round(elbowData.minAngle)} degrees. Pull the bar lower toward your upper chest, bending your elbows to about 90 degrees or less.`,
      })
      score -= 15
    } else {
      feedback.push({
        type: 'success',
        title: 'Good pull depth',
        description: 'You pulled down to a good depth with proper elbow bend, which helps engage your lats fully.',
      })
      score += 15
    }
    
    // Check range of motion
    const angleRange = elbowData.maxAngle - elbowData.minAngle
    if (angleRange < 40) {
      feedback.push({
        type: 'warning',
        title: 'Limited range of motion',
        description: 'Your elbow movement range was limited. Start with arms more extended overhead and pull all the way down for a full range of motion.',
      })
      score -= 10
    } else {
      feedback.push({
        type: 'success',
        title: 'Good range of motion',
        description: 'You demonstrated a good range of motion from extended to contracted position.',
      })
      score += 10
    }
  }
  
  // 2. Check hand/wrist shakiness
  const leftWristShake = detectShakiness(frames, 'left_wrist')
  const rightWristShake = detectShakiness(frames, 'right_wrist')
  
  if (leftWristShake.isShaky || rightWristShake.isShaky) {
    const shakySide = leftWristShake.variance > rightWristShake.variance ? 'left' : 'right'
    feedback.push({
      type: 'warning',
      title: 'Grip stability',
      description: `Your ${shakySide} hand appeared unstable during the movement. Focus on maintaining a firm grip and controlled movement, or reduce the weight.`,
    })
    score -= 10
  }
  
  // 3. Check shoulder symmetry
  const shoulderFrames = frames.filter(f => 
    getKeypoint(f.keypoints, 'left_shoulder') && getKeypoint(f.keypoints, 'right_shoulder')
  )
  
  if (shoulderFrames.length > 0) {
    let asymmetricCount = 0
    for (const frame of shoulderFrames) {
      const leftShoulder = getKeypoint(frame.keypoints, 'left_shoulder')!
      const rightShoulder = getKeypoint(frame.keypoints, 'right_shoulder')!
      const heightDiff = Math.abs(leftShoulder.y - rightShoulder.y)
      if (heightDiff > 0.06) asymmetricCount++
    }
    
    if (asymmetricCount > shoulderFrames.length * 0.4) {
      feedback.push({
        type: 'warning',
        title: 'Uneven pulling',
        description: 'One shoulder appears to be pulling more than the other. Focus on pulling evenly with both arms to prevent muscle imbalances.',
      })
      score -= 10
    } else {
      feedback.push({
        type: 'success',
        title: 'Even shoulder engagement',
        description: 'Your shoulders remained level during the pull, showing balanced muscle engagement.',
      })
      score += 5
    }
  }
  
  // 4. Check wrist vertical movement (should move down significantly)
  const wristROM = detectRangeOfMotion(frames, 'left_wrist')
  if (wristROM.movementRange < 0.15) {
    feedback.push({
      type: 'tip',
      title: 'Pulling motion',
      description: 'Limited vertical movement detected in your hands. Ensure you are starting with arms extended and pulling down through the full motion.',
    })
  }
  
  score = Math.max(0, Math.min(100, score))
  
  return {
    score,
    feedback,
    visibleParts,
    confidence: avgConfidence,
  }
}

export function analyzeLateralFly(frames: PoseFrame[]): AnalysisResult {
  const feedback: FeedbackItem[] = []
  let score = 50
  
  if (frames.length === 0) {
    return {
      score: 0,
      feedback: [{
        type: 'warning',
        title: 'No pose detected',
        description: 'Could not detect your body in the video. Please ensure you are visible in the frame and try again.',
      }],
      visibleParts: [],
      confidence: 0,
    }
  }
  
  const sampleFrame = frames.find(f => f.keypoints.length > 0) || frames[0]
  const visibleParts = getVisibleBodyPartGroups(sampleFrame.keypoints)
  
  const canSeeShoulders = visibleParts.includes('shoulders')
  const canSeeArms = visibleParts.includes('arms')
  const canSeeWrists = visibleParts.includes('wrists')
  
  const avgConfidence = frames.reduce((sum, f) => {
    const scores = f.keypoints.map(k => k.score)
    return sum + (scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0)
  }, 0) / frames.length
  
  if (!canSeeShoulders || !canSeeArms) {
    feedback.push({
      type: 'warning',
      title: 'Limited visibility',
      description: 'Cannot fully analyze lateral fly - your shoulders and arms need to be visible. Please position yourself so your upper body is in frame.',
    })
    return { score: 30, feedback, visibleParts, confidence: avgConfidence }
  }
  
  // 1. Check lateral (horizontal) wrist movement - key indicator for lateral raises
  const leftWristFrames: { x: number; y: number }[] = []
  const rightWristFrames: { x: number; y: number }[] = []
  
  for (const frame of frames) {
    const leftWrist = getKeypoint(frame.keypoints, 'left_wrist')
    const rightWrist = getKeypoint(frame.keypoints, 'right_wrist')
    if (leftWrist) leftWristFrames.push({ x: leftWrist.x, y: leftWrist.y })
    if (rightWrist) rightWristFrames.push({ x: rightWrist.x, y: rightWrist.y })
  }
  
  if (leftWristFrames.length > 2 && rightWristFrames.length > 2) {
    // Calculate horizontal range of motion
    const leftXRange = Math.max(...leftWristFrames.map(w => w.x)) - Math.min(...leftWristFrames.map(w => w.x))
    const rightXRange = Math.max(...rightWristFrames.map(w => w.x)) - Math.min(...rightWristFrames.map(w => w.x))
    
    const avgHorizontalRange = (leftXRange + rightXRange) / 2
    
    if (avgHorizontalRange < 0.1) {
      feedback.push({
        type: 'warning',
        title: 'Limited lateral movement',
        description: 'Your arms did not move outward enough. In a lateral fly, raise your arms out to the sides until they reach shoulder height.',
      })
      score -= 20
    } else if (avgHorizontalRange >= 0.2) {
      feedback.push({
        type: 'success',
        title: 'Good lateral range',
        description: 'You demonstrated good lateral movement, raising your arms out to the sides properly.',
      })
      score += 15
    }
    
    // Check if hands reached shoulder height
    const shoulderFrames = frames.filter(f => getKeypoint(f.keypoints, 'left_shoulder'))
    if (shoulderFrames.length > 0) {
      const shoulderY = shoulderFrames.map(f => getKeypoint(f.keypoints, 'left_shoulder')!.y)
      const avgShoulderY = shoulderY.reduce((a, b) => a + b, 0) / shoulderY.length
      
      const leftHighestY = Math.min(...leftWristFrames.map(w => w.y))
      const rightHighestY = Math.min(...rightWristFrames.map(w => w.y))
      const highestWristY = Math.min(leftHighestY, rightHighestY)
      
      // Wrist should reach shoulder height (lower Y value = higher position)
      if (highestWristY > avgShoulderY + 0.1) {
        feedback.push({
          type: 'warning',
          title: 'Raise height',
          description: 'Your hands did not reach shoulder height. Lift your arms until your hands are level with your shoulders.',
        })
        score -= 15
      } else {
        feedback.push({
          type: 'success',
          title: 'Good raise height',
          description: 'You raised your arms to shoulder height or above, maximizing shoulder engagement.',
        })
        score += 10
      }
    }
  }
  
  // 2. Check for shakiness (indicates weight may be too heavy)
  const leftWristShake = detectShakiness(frames, 'left_wrist')
  const rightWristShake = detectShakiness(frames, 'right_wrist')
  
  if (leftWristShake.isShaky || rightWristShake.isShaky) {
    feedback.push({
      type: 'warning',
      title: 'Shaky movement',
      description: 'Detected shaking in your hands during the raise. This often indicates the weight is too heavy. Consider using lighter dumbbells to maintain control.',
    })
    score -= 15
  } else if (canSeeWrists) {
    feedback.push({
      type: 'success',
      title: 'Controlled movement',
      description: 'Your hands remained steady throughout the movement, showing good control.',
    })
    score += 10
  }
  
  // 3. Check elbow position (should maintain slight bend)
  const leftElbow = analyzeElbowAngles(frames, 'left')
  const rightElbow = analyzeElbowAngles(frames, 'right')
  
  if (leftElbow.hasData || rightElbow.hasData) {
    const elbowData = leftElbow.hasData ? leftElbow : rightElbow
    
    // Elbows should be slightly bent (around 150-170 degrees), not fully straight or too bent
    if (elbowData.maxAngle > 175) {
      feedback.push({
        type: 'tip',
        title: 'Elbow position',
        description: 'Your elbows appear fully locked out. Keep a slight bend in your elbows throughout the movement to reduce joint strain.',
      })
    } else if (elbowData.maxAngle < 130) {
      feedback.push({
        type: 'tip',
        title: 'Elbow angle',
        description: 'Your elbows are bent quite a bit. While some bend is good, keep them relatively straight to better target the shoulders.',
      })
    } else {
      feedback.push({
        type: 'success',
        title: 'Good elbow position',
        description: 'You maintained a proper slight bend in your elbows, protecting your joints while targeting the shoulders.',
      })
      score += 5
    }
  }
  
  // 4. Check symmetry
  if (leftWristFrames.length > 2 && rightWristFrames.length > 2) {
    const leftMaxY = Math.min(...leftWristFrames.map(w => w.y))
    const rightMaxY = Math.min(...rightWristFrames.map(w => w.y))
    
    if (Math.abs(leftMaxY - rightMaxY) > 0.08) {
      feedback.push({
        type: 'warning',
        title: 'Asymmetric raise',
        description: 'One arm raised higher than the other. Focus on lifting both arms to the same height simultaneously.',
      })
      score -= 10
    } else {
      feedback.push({
        type: 'success',
        title: 'Symmetric movement',
        description: 'Both arms raised evenly, showing good balance and coordination.',
      })
      score += 5
    }
  }
  
  score = Math.max(0, Math.min(100, score))
  
  return {
    score,
    feedback,
    visibleParts,
    confidence: avgConfidence,
  }
}
