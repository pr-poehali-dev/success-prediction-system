export type Column = 'alpha' | 'omega';

export interface HistoryEvent {
  id: number;
  column: Column;
  timestamp: Date;
  source: 'manual' | 'screen';
}

export interface AlgorithmPrediction {
  name: string;
  prediction: Column;
  confidence: number;
  accuracy: number;
  description: string;
  weight: number;
}

export interface AIPrediction {
  prediction: Column;
  confidence: number;
  reasoning: string[];
  matchedPattern: string | null;       // найденный паттерн (символы), например "ωωωω"
  nextPattern: Column[];               // ожидаемая последовательность из 5 значений
  nextPatternConfidence: number;       // уверенность в nextPattern
}

export interface AccuracyPoint {
  timestamp: number;
  pattern: number;
  frequency: number;
  entropy: number;
  ai: number;
}

export interface CaptureArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PredictionHistory {
  id: number;
  timestamp: Date;
  prediction: Column;
  actual: Column;
  isCorrect: boolean;
  confidence: number;
}

export interface MethodPredictionHistory {
  id: number;
  timestamp: Date;
  methodName: string;
  prediction: Column;
  actual: Column;
  isCorrect: boolean;
  confidence: number;
}

export interface MethodStats {
  name: string;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  avgConfidence: number;
  weight: number;
}