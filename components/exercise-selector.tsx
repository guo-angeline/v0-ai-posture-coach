"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dumbbell, PersonStanding, Footprints, ArrowRight, ArrowUp, ArrowDown, MoveHorizontal } from "lucide-react"

export type ExerciseType = "squat" | "posture" | "lunge" | "shoulder-press" | "lat-pulldown" | "lateral-fly"

interface ExerciseSelectorProps {
  selectedExercise: ExerciseType | null
  onSelect: (exercise: ExerciseType) => void
  onContinue: () => void
}

const exercises = [
  {
    id: "squat" as ExerciseType,
    name: "Squat Form",
    description: "Check your squat depth, knee alignment, and back position",
    icon: Dumbbell,
  },
  {
    id: "posture" as ExerciseType,
    name: "Standing Posture",
    description: "Analyze your standing posture for alignment issues",
    icon: PersonStanding,
  },
  {
    id: "lunge" as ExerciseType,
    name: "Lunge Form",
    description: "Evaluate your lunge technique and balance",
    icon: Footprints,
  },
  {
    id: "shoulder-press" as ExerciseType,
    name: "Shoulder Press",
    description: "Analyze your overhead press technique and shoulder alignment",
    icon: ArrowUp,
  },
  {
    id: "lat-pulldown" as ExerciseType,
    name: "Lat Pulldown",
    description: "Check your pulling mechanics and lat engagement",
    icon: ArrowDown,
  },
  {
    id: "lateral-fly" as ExerciseType,
    name: "Lateral Fly",
    description: "Analyze your dumbbell lateral raise form and shoulder control",
    icon: MoveHorizontal,
  },
]

export function ExerciseSelector({ selectedExercise, onSelect, onContinue }: ExerciseSelectorProps) {
  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">Select Exercise Type</h2>
        <p className="text-muted-foreground">
          Choose what movement you want to analyze
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
        {exercises.map((exercise) => {
          const Icon = exercise.icon
          const isSelected = selectedExercise === exercise.id
          
          return (
            <button
              key={exercise.id}
              type="button"
              onClick={() => onSelect(exercise.id)}
              className="text-left w-full"
            >
              <Card className={`p-6 h-full transition-all cursor-pointer ${
                isSelected 
                  ? "border-primary bg-primary/10" 
                  : "border-border hover:border-primary/50 bg-card"
              }`}>
                <div className="flex flex-col items-center text-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isSelected ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-foreground">{exercise.name}</h3>
                  <p className="text-sm text-muted-foreground">{exercise.description}</p>
                </div>
              </Card>
            </button>
          )
        })}
      </div>

      <Button 
        onClick={onContinue} 
        size="lg" 
        className="gap-2"
        disabled={!selectedExercise}
      >
        Continue
        <ArrowRight className="w-5 h-5" />
      </Button>
    </div>
  )
}
