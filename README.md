# FormCoach — AI Posture & Exercise Form Analyzer

Record a 5-second video. Get instant feedback on your exercise form.

**Live:** [v0-ai-posture-coach.vercel.app](https://v0-ai-posture-coach.vercel.app)

FormCoach uses TensorFlow.js MoveNet (client-side, no server needed) to detect body keypoints from your webcam and score your exercise technique across multiple dimensions.

## Supported Exercises

| Exercise | Key Metrics |
|----------|-------------|
| **Shoulder Press** | Hand stability, range of motion, overhead position, elbow angles, hip alignment, shoulder symmetry |
| **Squat** | Depth (knee angles), hip movement, knee tracking (cave detection) |
| **Posture Check** | Shoulder level, forward head position, shoulder rounding |
| **Lunge** | Knee alignment, torso position, stride balance |
| **Lat Pulldown** | Elbow path, shoulder engagement, range of motion |
| **Lateral Fly** | Arm height, elbow bend, symmetry |

## How It Works

1. **Select** an exercise type
2. **Record** a 5-second webcam clip
3. **Preview** the recording
4. **Analyze** — TensorFlow.js MoveNet extracts 17 body keypoints per frame
5. **Review** — Scored feedback (0-100) with success / warning / tip items

Analysis is grounded: only body parts visible in-frame are evaluated. No guessing about off-screen areas.

## Tech Stack

- **Framework:** Next.js 16 + React 19
- **Pose Detection:** TensorFlow.js + MoveNet SINGLEPOSE_LIGHTNING (client-side via CDN)
- **UI:** Radix UI + shadcn/ui components
- **Styling:** Tailwind CSS 4
- **Charts:** Recharts
- **Analytics:** Vercel Analytics

## Getting Started

### Prerequisites

- Node.js 18+
- Webcam
- Modern browser with WebRTC support

### Install & Run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
app/
├── page.tsx                   # Main page — 5-step state machine (select → record → preview → analyzing → feedback)
components/
├── camera-recorder.tsx        # Webcam capture with countdown
├── video-preview.tsx          # Recorded video playback
├── posture-feedback.tsx       # Scored feedback display
├── exercise-selector.tsx      # Exercise type picker
├── analyzing-state.tsx        # Progress animation during analysis
└── ui/                        # shadcn/ui primitives (card, button)
lib/
├── pose-detection.ts          # Core math: keypoints, angles, symmetry, shakiness, ROM
├── exercise-analysis.ts       # Per-exercise analysis logic (934 lines)
└── video-analyzer.ts          # Frame extraction + pose detection + analysis pipeline
```

## Origin

Built with [v0.dev](https://v0.dev) and extended with custom pose analysis. Deployed on [Vercel](https://vercel.com).

## License

MIT
