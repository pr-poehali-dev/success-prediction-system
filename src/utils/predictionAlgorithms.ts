import { Column, AlgorithmPrediction, AdaptiveWeights, MethodPredictionHistory } from '@/types/prediction';

export const calculateMethodAccuracy = (
  methodName: string,
  methodHistory: MethodPredictionHistory[]
): number => {
  const methodPredictions = methodHistory.filter(m => m.methodName === methodName);
  if (methodPredictions.length === 0) return 0;
  const correct = methodPredictions.filter(m => m.isCorrect).length;
  return (correct / methodPredictions.length) * 100;
};

export const analyzePattern = (
  recHist: Column[],
  adaptiveWeights: AdaptiveWeights,
  methodHistory: MethodPredictionHistory[]
): AlgorithmPrediction => {
  if (recHist.length < 3) {
    return {
      name: 'Pattern Recognition',
      prediction: 'alpha',
      confidence: 50,
      accuracy: calculateMethodAccuracy('Pattern Recognition', methodHistory),
      description: 'Поиск повторяющихся последовательностей',
      weight: adaptiveWeights.pattern
    };
  }

  const patterns: Record<string, Column[]> = {};
  for (let len = 2; len <= Math.min(5, recHist.length - 1); len++) {
    for (let i = 0; i <= recHist.length - len - 1; i++) {
      const pattern = recHist.slice(i, i + len).join(',');
      const next = recHist[i + len];
      if (!patterns[pattern]) patterns[pattern] = [];
      patterns[pattern].push(next);
    }
  }

  const recent = recHist.slice(-5).join(',');
  let bestMatch = '';
  let bestScore = 0;

  Object.keys(patterns).forEach(pattern => {
    if (recent.endsWith(pattern)) {
      const score = pattern.length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    }
  });

  if (bestMatch && patterns[bestMatch]) {
    const nextValues = patterns[bestMatch];
    const alphaCount = nextValues.filter(v => v === 'alpha').length;
    const prediction: Column = alphaCount > nextValues.length / 2 ? 'alpha' : 'omega';
    const confidence = Math.round((Math.max(alphaCount, nextValues.length - alphaCount) / nextValues.length) * 100);

    return {
      name: 'Pattern Recognition',
      prediction,
      confidence,
      accuracy: calculateMethodAccuracy('Pattern Recognition', methodHistory),
      description: `Паттерн найден: ${bestMatch}`,
      weight: adaptiveWeights.pattern
    };
  }

  return {
    name: 'Pattern Recognition',
    prediction: 'alpha',
    confidence: 50,
    accuracy: calculateMethodAccuracy('Pattern Recognition', methodHistory),
    description: 'Паттерн не найден',
    weight: adaptiveWeights.pattern
  };
};

export const analyzeFrequency = (
  recHist: Column[],
  adaptiveWeights: AdaptiveWeights,
  methodHistory: MethodPredictionHistory[]
): AlgorithmPrediction => {
  if (recHist.length === 0) {
    return {
      name: 'Frequency Analysis',
      prediction: 'alpha',
      confidence: 50,
      accuracy: calculateMethodAccuracy('Frequency Analysis', methodHistory),
      description: 'Анализ частоты появления',
      weight: adaptiveWeights.frequency
    };
  }

  const windowSize = Math.min(15, recHist.length);
  const recentHistory = recHist.slice(-windowSize);

  const alphaCount = recentHistory.filter(c => c === 'alpha').length;
  const omegaCount = recentHistory.filter(c => c === 'omega').length;

  const prediction: Column = alphaCount > omegaCount ? 'omega' : 'alpha';
  const confidence = Math.round((Math.abs(alphaCount - omegaCount) / windowSize) * 100);

  return {
    name: 'Frequency Analysis',
    prediction,
    confidence: Math.max(50, confidence),
    accuracy: calculateMethodAccuracy('Frequency Analysis', methodHistory),
    description: `α:${alphaCount} ω:${omegaCount} → ${prediction === 'alpha' ? 'α' : 'ω'}`,
    weight: adaptiveWeights.frequency
  };
};

export const analyzeMarkov = (
  recHist: Column[],
  adaptiveWeights: AdaptiveWeights,
  methodHistory: MethodPredictionHistory[]
): AlgorithmPrediction => {
  if (recHist.length < 2) {
    return {
      name: 'Markov Chain',
      prediction: 'alpha',
      confidence: 50,
      accuracy: calculateMethodAccuracy('Markov Chain', methodHistory),
      description: 'Цепи Маркова',
      weight: adaptiveWeights.markov
    };
  }

  const transitions: Record<string, { alpha: number; omega: number }> = {
    alpha: { alpha: 0, omega: 0 },
    omega: { alpha: 0, omega: 0 }
  };

  for (let i = 0; i < recHist.length - 1; i++) {
    const current = recHist[i];
    const next = recHist[i + 1];
    transitions[current][next]++;
  }

  const lastColumn = recHist[recHist.length - 1];
  const trans = transitions[lastColumn];
  const total = trans.alpha + trans.omega;

  if (total === 0) {
    return {
      name: 'Markov Chain',
      prediction: 'alpha',
      confidence: 50,
      accuracy: calculateMethodAccuracy('Markov Chain', methodHistory),
      description: 'Нет данных о переходах',
      weight: adaptiveWeights.markov
    };
  }

  const prediction: Column = trans.alpha > trans.omega ? 'alpha' : 'omega';
  const confidence = Math.round((Math.max(trans.alpha, trans.omega) / total) * 100);

  return {
    name: 'Markov Chain',
    prediction,
    confidence,
    accuracy: calculateMethodAccuracy('Markov Chain', methodHistory),
    description: `${lastColumn} → α:${trans.alpha} ω:${trans.omega}`,
    weight: adaptiveWeights.markov
  };
};

export const analyzeDeepSequence = (
  recHist: Column[],
  adaptiveWeights: AdaptiveWeights,
  methodHistory: MethodPredictionHistory[]
): AlgorithmPrediction => {
  if (recHist.length < 4) {
    return {
      name: 'Deep Sequence',
      prediction: 'alpha',
      confidence: 50,
      accuracy: calculateMethodAccuracy('Deep Sequence', methodHistory),
      description: 'Глубокий анализ последовательностей',
      weight: adaptiveWeights.sequenceDepth
    };
  }

  const sequenceMap: Record<string, Column[]> = {};
  for (let len = 3; len <= Math.min(7, recHist.length - 1); len++) {
    for (let i = 0; i <= recHist.length - len - 1; i++) {
      const seq = recHist.slice(i, i + len).join('');
      const next = recHist[i + len];
      if (!sequenceMap[seq]) sequenceMap[seq] = [];
      sequenceMap[seq].push(next);
    }
  }

  for (let len = 7; len >= 3; len--) {
    const recent = recHist.slice(-len).join('');
    if (sequenceMap[recent]) {
      const outcomes = sequenceMap[recent];
      const alphaCount = outcomes.filter(v => v === 'alpha').length;
      const prediction: Column = alphaCount > outcomes.length / 2 ? 'alpha' : 'omega';
      const confidence = Math.round((Math.max(alphaCount, outcomes.length - alphaCount) / outcomes.length) * 100);

      return {
        name: 'Deep Sequence',
        prediction,
        confidence,
        accuracy: calculateMethodAccuracy('Deep Sequence', methodHistory),
        description: `Глубина: ${len}, совпадений: ${outcomes.length}`,
        weight: adaptiveWeights.sequenceDepth
      };
    }
  }

  return {
    name: 'Deep Sequence',
    prediction: 'alpha',
    confidence: 50,
    accuracy: calculateMethodAccuracy('Deep Sequence', methodHistory),
    description: 'Глубокая последовательность не найдена',
    weight: adaptiveWeights.sequenceDepth
  };
};

export const analyzeNGram = (
  recHist: Column[],
  adaptiveWeights: AdaptiveWeights,
  methodHistory: MethodPredictionHistory[]
): AlgorithmPrediction => {
  if (recHist.length < 3) {
    return {
      name: 'N-Gram Analysis',
      prediction: 'alpha',
      confidence: 50,
      accuracy: calculateMethodAccuracy('N-Gram Analysis', methodHistory),
      description: 'Анализ N-грамм',
      weight: adaptiveWeights.nGram
    };
  }

  const bigramMap: Record<string, { alpha: number; omega: number }> = {};
  
  for (let i = 0; i < recHist.length - 2; i++) {
    const bigram = `${recHist[i]}-${recHist[i + 1]}`;
    const next = recHist[i + 2];
    
    if (!bigramMap[bigram]) {
      bigramMap[bigram] = { alpha: 0, omega: 0 };
    }
    bigramMap[bigram][next]++;
  }

  const lastBigram = `${recHist[recHist.length - 2]}-${recHist[recHist.length - 1]}`;
  
  if (bigramMap[lastBigram]) {
    const counts = bigramMap[lastBigram];
    const total = counts.alpha + counts.omega;
    const prediction: Column = counts.alpha > counts.omega ? 'alpha' : 'omega';
    const confidence = Math.round((Math.max(counts.alpha, counts.omega) / total) * 100);

    return {
      name: 'N-Gram Analysis',
      prediction,
      confidence,
      accuracy: calculateMethodAccuracy('N-Gram Analysis', methodHistory),
      description: `Биграмма: ${lastBigram}`,
      weight: adaptiveWeights.nGram
    };
  }

  return {
    name: 'N-Gram Analysis',
    prediction: 'alpha',
    confidence: 50,
    accuracy: calculateMethodAccuracy('N-Gram Analysis', methodHistory),
    description: 'Биграмма не найдена',
    weight: adaptiveWeights.nGram
  };
};

export const analyzeEntropy = (
  recHist: Column[],
  adaptiveWeights: AdaptiveWeights,
  methodHistory: MethodPredictionHistory[]
): AlgorithmPrediction => {
  if (recHist.length < 10) {
    return {
      name: 'Entropy Prediction',
      prediction: 'alpha',
      confidence: 50,
      accuracy: calculateMethodAccuracy('Entropy Prediction', methodHistory),
      description: 'Энтропийный анализ',
      weight: adaptiveWeights.entropy
    };
  }

  const windowSize = Math.min(20, recHist.length);
  const recent = recHist.slice(-windowSize);
  
  const alphaCount = recent.filter(c => c === 'alpha').length;
  const omegaCount = recent.filter(c => c === 'omega').length;
  
  const pAlpha = alphaCount / windowSize;
  const pOmega = omegaCount / windowSize;
  
  const entropy = -(pAlpha * Math.log2(pAlpha + 0.001) + pOmega * Math.log2(pOmega + 0.001));
  
  const balance = Math.abs(0.5 - pAlpha);
  
  let prediction: Column;
  if (entropy > 0.95) {
    prediction = Math.random() > 0.5 ? 'alpha' : 'omega';
  } else {
    prediction = pAlpha < 0.5 ? 'alpha' : 'omega';
  }
  
  const confidence = Math.round((1 - balance) * 100);

  return {
    name: 'Entropy Prediction',
    prediction,
    confidence,
    accuracy: calculateMethodAccuracy('Entropy Prediction', methodHistory),
    description: `Энтропия: ${entropy.toFixed(2)}`,
    weight: adaptiveWeights.entropy
  };
};

export const analyzeStreak = (
  recHist: Column[],
  adaptiveWeights: AdaptiveWeights,
  methodHistory: MethodPredictionHistory[]
): AlgorithmPrediction => {
  if (recHist.length < 3) {
    return {
      name: 'Streak Analysis',
      prediction: 'alpha',
      confidence: 50,
      accuracy: calculateMethodAccuracy('Streak Analysis', methodHistory),
      description: 'Анализ серий',
      weight: adaptiveWeights.streak
    };
  }

  let currentStreak = 1;
  const lastValue = recHist[recHist.length - 1];
  
  for (let i = recHist.length - 2; i >= 0; i--) {
    if (recHist[i] === lastValue) {
      currentStreak++;
    } else {
      break;
    }
  }

  const streaks: number[] = [];
  let tempStreak = 1;
  
  for (let i = 1; i < recHist.length; i++) {
    if (recHist[i] === recHist[i - 1]) {
      tempStreak++;
    } else {
      streaks.push(tempStreak);
      tempStreak = 1;
    }
  }
  streaks.push(tempStreak);

  const avgStreak = streaks.reduce((a, b) => a + b, 0) / streaks.length;
  const maxStreak = Math.max(...streaks);

  let prediction: Column;
  let confidence: number;

  if (currentStreak >= avgStreak * 1.5 || currentStreak >= maxStreak) {
    prediction = lastValue === 'alpha' ? 'omega' : 'alpha';
    confidence = Math.min(85, 50 + currentStreak * 5);
  } else {
    prediction = lastValue;
    confidence = Math.min(70, 50 + (avgStreak - currentStreak) * 3);
  }

  return {
    name: 'Streak Analysis',
    prediction,
    confidence: Math.round(confidence),
    accuracy: calculateMethodAccuracy('Streak Analysis', methodHistory),
    description: `Серия: ${currentStreak}, макс: ${maxStreak}`,
    weight: adaptiveWeights.streak
  };
};

export const calculateEnsemble = (
  preds: AlgorithmPrediction[]
): { column: Column; confidence: number } => {
  if (preds.length === 0) return { column: 'alpha', confidence: 50 };

  const weightedVotes: Record<Column, number> = { alpha: 0, omega: 0 };

  preds.forEach(pred => {
    const weight = pred.weight * (pred.confidence / 100);
    weightedVotes[pred.prediction] += weight;
  });

  const totalWeight = weightedVotes.alpha + weightedVotes.omega;
  const winningColumn: Column = weightedVotes.alpha > weightedVotes.omega ? 'alpha' : 'omega';
  const confidence = Math.round((Math.max(weightedVotes.alpha, weightedVotes.omega) / totalWeight) * 100);

  return {
    column: winningColumn,
    confidence: Math.min(95, confidence)
  };
};
