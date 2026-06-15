export type MealRecord = {
  pageId: string;
  mealType: string;
  kcal: number;
  P: number;
  F: number;
  C: number;
  memo: string;
  imageUrl: string | null;
  title: string;
  recordedAt: string;
  details?: {
    fiber: number;
    salt: number;
    iron: number;
    calcium: number;
    vitaminC: number;
  } | null;
};

export type TodayData = {
  customer: {
    name: string;
    goals: { kcal: number; P: number; F: number; C: number };
    currentWeight: number | null;
    targetWeight: number | null;
    targetDate: string | null;
  };
  today: {
    date: string;
    totals: { kcal: number; P: number; F: number; C: number };
    mealsByType: Record<string, MealRecord[]>;
    recordCount: number;
    weight?: string;
    exercised?: string;
    exerciseContent?: string;
    dailyNote?: string;
    dailyNoteEnabled?: boolean;
  };
  stats: {
    streakDays: number;
    bestStreakDays: number;
    last30RecordedDays: number;
    monthlyRecordedDays: number;
  } | null;
};

export type PredictionData = {
  prediction: {
    predictedWeight: number;
    monthlyChange: number;
    confidenceLevel: 'high' | 'medium' | 'low';
    willReachGoal: boolean | null;
    comment: string;
    recommendations: string[];
  } | null;
  reason?: string;
  message?: string;
  dataPoints: {
    recordedDays: number;
    weightDays: number;
    exerciseDays: number;
  };
};
