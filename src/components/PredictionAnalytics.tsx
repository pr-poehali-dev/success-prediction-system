import { AdaptivePredictionCard } from '@/components/analytics/AdaptivePredictionCard';
import { SystemStatsCard } from '@/components/analytics/SystemStatsCard';
import { StrategySelectionCard } from '@/components/analytics/StrategySelectionCard';

type Column = 'alpha' | 'omega';

interface HistoryEvent {
  id: number;
  column: Column;
  timestamp: Date;
  source: 'manual' | 'screen';
}

interface PredictionHistory {
  id: number;
  timestamp: Date;
  prediction: Column;
  actual: Column;
  isCorrect: boolean;
  confidence: number;
}

interface PredictionAnalyticsProps {
  history: HistoryEvent[];
  stats: {
    alpha: number;
    omega: number;
    total: number;
  };
  predictionHistory: PredictionHistory[];
}

interface SequencePattern {
  length: number;
  pattern: string;
  fullSequence: string;
  count: number;
  nextAlpha: number;
  nextOmega: number;
  prediction: 'alpha' | 'omega';
  nextEvent: string;
  confidence: number;
  alphaProb: number;
  omegaProb: number;
  score: number;
}

interface AdaptivePrediction {
  pattern: string;
  fullSequence: string;
  nextEvent: string;
  prediction: Column;
  confidence: number;
  alphaProb: number;
  omegaProb: number;
  occurrences: number;
  length: number;
  score: number;
  strategyName: string;
  strategyAccuracy: number;
  imbalance: number;
  balanceInfo: string;
}

export const PredictionAnalytics = ({ history, stats, predictionHistory }: PredictionAnalyticsProps) => {
  const analyzeSequencesForLength = (length: number): SequencePattern[] => {
    if (history.length < length) return [];
    
    const sequences = new Map<string, { count: number; nextAlpha: number; nextOmega: number; fullSequence: string }>();
    
    for (let i = 0; i < history.length - length + 1; i++) {
      const pattern = [];
      for (let j = 0; j < length - 1; j++) {
        pattern.push(history[i + j].column === 'alpha' ? 'α' : 'ω');
      }
      const patternStr = pattern.join('-');
      
      const nextEvent = history[i + length - 1].column === 'alpha' ? 'α' : 'ω';
      const fullSeq = patternStr + '-' + nextEvent;
      
      if (!sequences.has(patternStr)) {
        sequences.set(patternStr, { count: 0, nextAlpha: 0, nextOmega: 0, fullSequence: '' });
      }
      
      const data = sequences.get(patternStr)!;
      data.count++;
      if (nextEvent === 'α') {
        data.nextAlpha++;
      } else {
        data.nextOmega++;
      }
      data.fullSequence = fullSeq;
    }
    
    return Array.from(sequences.entries())
      .filter(([_, data]) => data.count >= 2)
      .map(([pattern, data]) => {
        const alphaProb = (data.nextAlpha / data.count) * 100;
        const omegaProb = (data.nextOmega / data.count) * 100;
        const maxProb = Math.max(alphaProb, omegaProb);
        
        return {
          length,
          pattern,
          fullSequence: data.fullSequence,
          count: data.count,
          nextAlpha: data.nextAlpha,
          nextOmega: data.nextOmega,
          prediction: alphaProb > omegaProb ? 'alpha' : 'omega',
          nextEvent: alphaProb > omegaProb ? 'α' : 'ω',
          confidence: maxProb,
          alphaProb,
          omegaProb,
          score: data.count * maxProb
        };
      })
      .filter(item => item.confidence >= 60);
  };

  const getAdaptiveAnalysis = () => {
    const patterns = analyzeSequencesForLength(5);
    
    const topOverall = patterns
      .sort((a, b) => {
        const timeFactor = 0.3;
        const scoreFactor = 0.7;
        return (b.score * scoreFactor) - (a.score * scoreFactor);
      })
      .slice(0, 5);
    
    return { topOverall };
  };

  const calculateStrategyAccuracy = (strategy: 'overall' | 'balance', windowSize: number = 10): number => {
    if (history.length < 5) return 0;
    
    let correct = 0;
    let total = 0;
    const startIdx = Math.max(5, history.length - windowSize);
    
    for (let i = startIdx; i < history.length; i++) {
      const pattern = history.slice(i - 4, i).map(e => e.column === 'alpha' ? 'α' : 'ω').join('-');
      const actual = history[i].column;
      
      const matches: { event: Column, pos: number }[] = [];
      for (let j = 0; j < i - 4; j++) {
        const histPattern = history.slice(j, j + 4).map(e => e.column === 'alpha' ? 'α' : 'ω').join('-');
        if (histPattern === pattern) {
          matches.push({ event: history[j + 4].column, pos: j });
        }
      }
      
      if (matches.length === 0) continue;
      
      let predicted: Column;
      
      if (strategy === 'balance') {
        const currentAlpha = history.slice(0, i).filter(e => e.column === 'alpha').length;
        const currentOmega = history.slice(0, i).filter(e => e.column === 'omega').length;
        const imbalance = currentAlpha - currentOmega;
        
        const alphaC = matches.filter(m => m.event === 'alpha').length;
        const omegaC = matches.filter(m => m.event === 'omega').length;
        const patternPrediction: Column = alphaC >= omegaC ? 'alpha' : 'omega';
        
        if (Math.abs(imbalance) >= 3) {
          const balancePrediction: Column = imbalance > 0 ? 'omega' : 'alpha';
          const balanceWeight = Math.min(0.7, Math.abs(imbalance) / 10);
          const patternWeight = 1 - balanceWeight;
          
          if (balancePrediction === patternPrediction) {
            predicted = patternPrediction;
          } else {
            predicted = balanceWeight > patternWeight ? balancePrediction : patternPrediction;
          }
        } else {
          predicted = patternPrediction;
        }
      } else {
        const alphaC = matches.filter(m => m.event === 'alpha').length;
        const omegaC = matches.filter(m => m.event === 'omega').length;
        predicted = alphaC >= omegaC ? 'alpha' : 'omega';
      }
      
      if (predicted === actual) correct++;
      total++;
    }
    
    return total > 0 ? (correct / total) * 100 : 0;
  };

  const getAdaptivePrediction = (): AdaptivePrediction | null => {
    if (history.length < 5) return null;
    
    const recent4 = history.slice(-4).map(e => e.column === 'alpha' ? 'α' : 'ω').join('-');
    
    const overallAccuracy = calculateStrategyAccuracy('overall');
    const balanceAccuracy = calculateStrategyAccuracy('balance');
    
    const bestStrategy = balanceAccuracy >= overallAccuracy ? 'balance' : 'overall';
    
    const matches: { event: Column, pos: number }[] = [];
    for (let j = 0; j < history.length - 4; j++) {
      const histPattern = history.slice(j, j + 4).map(e => e.column === 'alpha' ? 'α' : 'ω').join('-');
      if (histPattern === recent4) {
        matches.push({ event: history[j + 4].column, pos: j });
      }
    }
    
    if (matches.length === 0) return null;
    
    const currentAlpha = history.filter(e => e.column === 'alpha').length;
    const currentOmega = history.filter(e => e.column === 'omega').length;
    const imbalance = currentAlpha - currentOmega;
    const totalEvents = history.length;
    
    let prediction: Column;
    let confidence: number;
    let strategyName: string;
    
    if (bestStrategy === 'balance') {
      const alphaC = matches.filter(m => m.event === 'alpha').length;
      const omegaC = matches.filter(m => m.event === 'omega').length;
      const patternPrediction: Column = alphaC >= omegaC ? 'alpha' : 'omega';
      
      if (Math.abs(imbalance) >= 3) {
        const balancePrediction: Column = imbalance > 0 ? 'omega' : 'alpha';
        const balanceWeight = Math.min(0.7, Math.abs(imbalance) / totalEvents * 2);
        const patternWeight = 1 - balanceWeight;
        
        if (balancePrediction === patternPrediction) {
          prediction = patternPrediction;
          const dominant = Math.max(alphaC, omegaC);
          confidence = Math.min(95, 65 + (dominant / matches.length) * 30 + balanceWeight * 15);
        } else {
          prediction = balanceWeight > 0.5 ? balancePrediction : patternPrediction;
          const baseConfidence = balanceWeight > 0.5 ? 60 : 55;
          confidence = Math.min(90, baseConfidence + Math.abs(imbalance) * 3);
        }
        strategyName = `⚖️ Баланс (дисбаланс: ${imbalance > 0 ? '+' : ''}${imbalance})`;
      } else {
        prediction = patternPrediction;
        const dominant = Math.max(alphaC, omegaC);
        confidence = Math.min(95, 60 + (dominant / matches.length) * 35);
        strategyName = '⚖️ Баланс (паттерн)';
      }
    } else {
      const alphaC = matches.filter(m => m.event === 'alpha').length;
      const omegaC = matches.filter(m => m.event === 'omega').length;
      prediction = alphaC >= omegaC ? 'alpha' : 'omega';
      const dominant = Math.max(alphaC, omegaC);
      confidence = Math.min(95, 55 + (dominant / matches.length) * 40);
      strategyName = '🎯 Паттерн';
    }
    
    if (confidence < 60) return null;
    
    const alphaCount = matches.filter(m => m.event === 'alpha').length;
    const omegaCount = matches.filter(m => m.event === 'omega').length;
    const alphaProb = (alphaCount / matches.length) * 100;
    const omegaProb = (omegaCount / matches.length) * 100;
    
    return {
      pattern: recent4,
      fullSequence: recent4 + '-' + (prediction === 'alpha' ? 'α' : 'ω'),
      nextEvent: prediction === 'alpha' ? 'α' : 'ω',
      prediction,
      confidence,
      alphaProb,
      omegaProb,
      occurrences: matches.length,
      length: 5,
      score: matches.length * confidence,
      strategyName,
      strategyAccuracy: bestStrategy === 'balance' ? balanceAccuracy : overallAccuracy,
      imbalance,
      balanceInfo: `α:${currentAlpha} ω:${currentOmega}`
    };
  };

  const prediction = getAdaptivePrediction();
  const balanceAccuracy = calculateStrategyAccuracy('balance');
  const overallAccuracy = calculateStrategyAccuracy('overall');

  return (
    <>
      <AdaptivePredictionCard prediction={prediction} predictionHistory={predictionHistory} />
      <SystemStatsCard predictionHistory={predictionHistory} />
      <StrategySelectionCard 
        historyLength={history.length}
        balanceAccuracy={balanceAccuracy}
        overallAccuracy={overallAccuracy}
      />
    </>
  );
};