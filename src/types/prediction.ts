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

export interface AccuracyPoint {
  timestamp: number;
  pattern: number;
  frequency: number;
  markov: number;
  ensemble: number;
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
  adaptivePrediction: Column;
  adaptiveConfidence: number;
  adaptiveIsCorrect: boolean;
  sequencePrediction: Column;
  sequenceConfidence: number;
  sequenceIsCorrect: boolean;
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

export interface AdaptiveWeights {
  pattern: number;
  frequency: number;
  markov: number;
  sequenceDepth: number;
  nGram: number;
  entropy: number;
  streak: number;
}