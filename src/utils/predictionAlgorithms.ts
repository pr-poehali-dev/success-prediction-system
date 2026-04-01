import { Column, AlgorithmPrediction, MethodPredictionHistory } from '@/types/prediction';

export const calculateMethodAccuracy = (
  methodName: string,
  methodHistory: MethodPredictionHistory[]
): number => {
  const methodPredictions = methodHistory.filter(m => m.methodName === methodName);
  if (methodPredictions.length === 0) return 0;
  const correct = methodPredictions.filter(m => m.isCorrect).length;
  return (correct / methodPredictions.length) * 100;
};

// ─── 1. Pattern Recognition ────────────────────────────────────────────────────
// Ищет подпоследовательности длиной 5–6, выбирает наиболее уверенное совпадение
export const analyzePattern = (
  recHist: Column[],
  methodHistory: MethodPredictionHistory[]
): AlgorithmPrediction => {
  const accuracy = calculateMethodAccuracy('Pattern Recognition', methodHistory);

  if (recHist.length < 6) {
    return {
      name: 'Pattern Recognition',
      prediction: 'alpha',
      confidence: 50,
      accuracy,
      description: 'Недостаточно данных (нужно ≥6)',
      weight: 1
    };
  }

  // Строим карту паттернов длиной 5 и 6
  const patterns: Record<string, Column[]> = {};

  for (const len of [5, 6]) {
    for (let i = 0; i <= recHist.length - len - 1; i++) {
      const key = recHist.slice(i, i + len).join('-');
      const next = recHist[i + len];
      if (!patterns[key]) patterns[key] = [];
      patterns[key].push(next);
    }
  }

  // Находим наиболее уверенное совпадение среди хвостов длины 5 и 6
  let bestMatch: string | null = null;
  let bestConfidence = 0;
  let bestLen = 0;

  for (const len of [6, 5]) {
    if (recHist.length < len) continue;
    const tail = recHist.slice(-len).join('-');
    if (patterns[tail] && patterns[tail].length > 0) {
      const outcomes = patterns[tail];
      const alphaCount = outcomes.filter(v => v === 'alpha').length;
      const conf = (Math.max(alphaCount, outcomes.length - alphaCount) / outcomes.length) * 100;
      // Выбираем наиболее уверенное
      if (conf > bestConfidence || (conf === bestConfidence && len > bestLen)) {
        bestConfidence = conf;
        bestMatch = tail;
        bestLen = len;
      }
    }
  }

  if (!bestMatch) {
    return {
      name: 'Pattern Recognition',
      prediction: 'alpha',
      confidence: 50,
      accuracy,
      description: 'Паттерн не найден',
      weight: 1
    };
  }

  const outcomes = patterns[bestMatch];
  const alphaCount = outcomes.filter(v => v === 'alpha').length;
  const prediction: Column = alphaCount >= outcomes.length / 2 ? 'alpha' : 'omega';
  const symbols = bestMatch.split('-').map(s => s === 'alpha' ? 'α' : 'ω').join('');

  return {
    name: 'Pattern Recognition',
    prediction,
    confidence: Math.round(bestConfidence),
    accuracy,
    description: `[${symbols}] → ${prediction === 'alpha' ? 'α' : 'ω'} (${outcomes.length} вхожд., len=${bestLen})`,
    weight: 1
  };
};

// ─── 2. Frequency Analysis ────────────────────────────────────────────────────
// Анализирует ВСЮ историю: если α > ω — предсказывает ω (балансировка)
export const analyzeFrequency = (
  recHist: Column[],
  methodHistory: MethodPredictionHistory[]
): AlgorithmPrediction => {
  const accuracy = calculateMethodAccuracy('Frequency Analysis', methodHistory);

  if (recHist.length === 0) {
    return {
      name: 'Frequency Analysis',
      prediction: 'alpha',
      confidence: 50,
      accuracy,
      description: 'Нет данных',
      weight: 1
    };
  }

  const alphaCount = recHist.filter(c => c === 'alpha').length;
  const omegaCount = recHist.filter(c => c === 'omega').length;
  const total = recHist.length;

  // Если больше alpha — предсказываем omega (балансировка) и наоборот
  const prediction: Column = alphaCount > omegaCount ? 'omega' : 'alpha';

  // Уверенность пропорциональна степени дисбаланса
  const imbalanceRatio = Math.abs(alphaCount - omegaCount) / total;
  const confidence = Math.round(50 + imbalanceRatio * 50);

  return {
    name: 'Frequency Analysis',
    prediction,
    confidence,
    accuracy,
    description: `α:${alphaCount} ω:${omegaCount} из ${total} → баланс к ${prediction === 'alpha' ? 'α' : 'ω'}`,
    weight: 1
  };
};

// ─── 3. Entropy ───────────────────────────────────────────────────────────────
// Считает энтропию Шеннона: при высоком дисбалансе → редкое значение
export const analyzeEntropy = (
  recHist: Column[],
  methodHistory: MethodPredictionHistory[]
): AlgorithmPrediction => {
  const accuracy = calculateMethodAccuracy('Entropy', methodHistory);

  if (recHist.length < 5) {
    return {
      name: 'Entropy',
      prediction: 'alpha',
      confidence: 50,
      accuracy,
      description: 'Недостаточно данных (нужно ≥5)',
      weight: 1
    };
  }

  const total = recHist.length;
  const alphaCount = recHist.filter(c => c === 'alpha').length;
  const omegaCount = recHist.filter(c => c === 'omega').length;

  const pAlpha = alphaCount / total;
  const pOmega = omegaCount / total;

  // Энтропия Шеннона (бит)
  const entropy =
    (pAlpha > 0 ? -pAlpha * Math.log2(pAlpha) : 0) +
    (pOmega > 0 ? -pOmega * Math.log2(pOmega) : 0);

  // Максимальная энтропия при 50/50 = 1 бит
  // При высоком дисбалансе (низкая энтропия) → предсказываем редкое значение
  const isHighImbalance = entropy < 0.85; // порог ~70/30

  let prediction: Column;
  let confidence: number;
  let description: string;

  if (isHighImbalance) {
    // Предсказываем редкое значение
    prediction = alphaCount < omegaCount ? 'alpha' : 'omega';
    // Уверенность: чем ниже энтропия, тем выше уверенность
    confidence = Math.round(50 + (1 - entropy) * 45);
    description = `H=${entropy.toFixed(3)} бит → дисбаланс, редкое ${prediction === 'alpha' ? 'α' : 'ω'}`;
  } else {
    // При близкой к 1 энтропии — система сбалансирована, опираемся на последний паттерн
    prediction = recHist[recHist.length - 1] === 'alpha' ? 'omega' : 'alpha';
    confidence = Math.round(50 + entropy * 5);
    description = `H=${entropy.toFixed(3)} бит → баланс, чередуем`;
  }

  return {
    name: 'Entropy',
    prediction,
    confidence,
    accuracy,
    description,
    weight: 1
  };
};
