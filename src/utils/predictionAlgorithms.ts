import { Column, AlgorithmPrediction, AIPrediction, MethodPredictionHistory } from '@/types/prediction';

export const calculateMethodAccuracy = (
  methodName: string,
  methodHistory: MethodPredictionHistory[]
): number => {
  const methodPredictions = methodHistory.filter(m => m.methodName === methodName);
  if (methodPredictions.length === 0) return 0;
  const correct = methodPredictions.filter(m => m.isCorrect).length;
  return (correct / methodPredictions.length) * 100;
};

// ─── Вспомогательные функции ────────────────────────────────────────────────

/** Символьное представление последовательности */
const toSymbols = (seq: Column[]): string =>
  seq.map(v => (v === 'alpha' ? 'α' : 'ω')).join('');

/**
 * Строит карту паттернов: ключ → массив следующих значений.
 * Для длин len и len+1 (5 и 6).
 */
const buildPatternMap = (
  hist: Column[],
  len: number
): Record<string, Column[]> => {
  const map: Record<string, Column[]> = {};
  for (const l of [len, len + 1]) {
    for (let i = 0; i <= hist.length - l - 1; i++) {
      const key = hist.slice(i, i + l).join('-');
      const next = hist[i + l];
      if (!map[key]) map[key] = [];
      map[key].push(next);
    }
  }
  return map;
};

/**
 * AI-логика: строит следующую ожидаемую последовательность длиной 5.
 * Для каждого шага ищет паттерн в истории и предсказывает следующее значение.
 * Возвращает массив из 5 Column и уверенность (средняя по шагам).
 */
export const buildNextSequence = (
  hist: Column[],
  firstPrediction: Column
): { sequence: Column[]; confidence: number } => {
  if (hist.length < 5) {
    return { sequence: Array(5).fill(firstPrediction), confidence: 50 };
  }

  const sequence: Column[] = [];
  const confidences: number[] = [];
  let simulatedHist = [...hist];

  for (let step = 0; step < 5; step++) {
    if (step === 0) {
      // Первый шаг — уже предсказан алгоритмом
      sequence.push(firstPrediction);
      confidences.push(0); // заполним позже из основного алгоритма
      simulatedHist = [...simulatedHist, firstPrediction];
      continue;
    }

    const map = buildPatternMap(simulatedHist, 5);
    let bestConf = 0;
    let bestPred: Column = simulatedHist[simulatedHist.length - 1] === 'alpha' ? 'omega' : 'alpha';

    for (const len of [6, 5]) {
      if (simulatedHist.length < len) continue;
      const tail = simulatedHist.slice(-len).join('-');
      if (map[tail] && map[tail].length > 0) {
        const outcomes = map[tail];
        const alphaCount = outcomes.filter(v => v === 'alpha').length;
        const conf =
          (Math.max(alphaCount, outcomes.length - alphaCount) / outcomes.length) * 100;
        if (conf > bestConf) {
          bestConf = conf;
          bestPred = alphaCount >= outcomes.length / 2 ? 'alpha' : 'omega';
        }
      }
    }

    // Если паттерн не найден — применяем AI-логику: ищем серии и чередования
    if (bestConf === 0) {
      const last4 = simulatedHist.slice(-4);
      const allSame = last4.every(v => v === last4[0]);
      if (allSame && last4.length === 4) {
        // Длинная серия — предсказываем смену
        bestPred = last4[0] === 'alpha' ? 'omega' : 'alpha';
        bestConf = 65;
      } else {
        // Чередование
        bestPred = simulatedHist[simulatedHist.length - 1] === 'alpha' ? 'omega' : 'alpha';
        bestConf = 55;
      }
    }

    sequence.push(bestPred);
    confidences.push(bestConf);
    simulatedHist = [...simulatedHist, bestPred];
  }

  const avgConf =
    confidences.filter(c => c > 0).reduce((a, b) => a + b, 0) /
    Math.max(1, confidences.filter(c => c > 0).length);

  return { sequence, confidence: Math.round(avgConf) };
};

// ─── Pattern Recognition ────────────────────────────────────────────────────
/**
 * Ищет подпоследовательности длиной 5–6 в истории,
 * выбирает наиболее уверенное совпадение.
 * Также содержит AI-логику: серии, чередования, взвешенная уверенность.
 */
export const analyzePattern = (
  recHist: Column[],
  methodHistory: MethodPredictionHistory[]
): AlgorithmPrediction & { matchedPattern: string | null } => {
  const accuracy = calculateMethodAccuracy('Pattern Recognition', methodHistory);

  const fallback = (desc: string) => ({
    name: 'Pattern Recognition',
    prediction: 'alpha' as Column,
    confidence: 50,
    accuracy,
    description: desc,
    weight: 1,
    matchedPattern: null,
  });

  if (recHist.length < 6) return fallback('Недостаточно данных (нужно ≥6)');

  // Строим карту паттернов длиной 5 и 6
  const patterns = buildPatternMap(recHist, 5);

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
      // Взвешиваем уверенность с учётом числа вхождений (больше данных = надёжнее)
      const baseConf =
        (Math.max(alphaCount, outcomes.length - alphaCount) / outcomes.length) * 100;
      const sampleBonus = Math.min(10, outcomes.length * 2); // бонус до +10% за частоту
      const conf = Math.min(100, baseConf + sampleBonus);

      if (conf > bestConfidence || (conf === bestConfidence && len > bestLen)) {
        bestConfidence = conf;
        bestMatch = tail;
        bestLen = len;
      }
    }
  }

  // ─── AI-логика: если паттерн не найден ────────────────────────────────────
  if (!bestMatch) {
    const last = recHist[recHist.length - 1];
    let streakLen = 1;
    for (let i = recHist.length - 2; i >= 0; i--) {
      if (recHist[i] === last) streakLen++;
      else break;
    }

    if (streakLen >= 4) {
      // Долгая серия → высокая вероятность смены
      const prediction: Column = last === 'alpha' ? 'omega' : 'alpha';
      const conf = Math.min(85, 55 + streakLen * 5);
      return {
        name: 'Pattern Recognition',
        prediction,
        confidence: conf,
        accuracy,
        description: `AI: серия ${streakLen}× ${toSymbols([last])} → ожидается ${toSymbols([prediction])}`,
        weight: 1,
        matchedPattern: null,
      };
    }

    if (streakLen >= 2) {
      // Небольшая серия → вероятно чередование
      const prediction: Column = last === 'alpha' ? 'omega' : 'alpha';
      return {
        name: 'Pattern Recognition',
        prediction,
        confidence: 58,
        accuracy,
        description: `AI: серия ${streakLen}× → чередование к ${toSymbols([prediction])}`,
        weight: 1,
        matchedPattern: null,
      };
    }

    return fallback('Паттерн не найден в истории');
  }

  const outcomes = patterns[bestMatch];
  const alphaCount = outcomes.filter(v => v === 'alpha').length;
  const prediction: Column = alphaCount >= outcomes.length / 2 ? 'alpha' : 'omega';
  const matchSeq = bestMatch.split('-').map(s => s as Column);
  const symbols = toSymbols(matchSeq);

  return {
    name: 'Pattern Recognition',
    prediction,
    confidence: Math.round(bestConfidence),
    accuracy,
    description: `[${symbols}] → ${toSymbols([prediction])} (${outcomes.length} вхожд., len=${bestLen})`,
    weight: 1,
    matchedPattern: symbols,
  };
};

/**
 * Главная функция: запускает Pattern Recognition + AI-логику,
 * возвращает полный AIPrediction включая nextPattern.
 */
export const runPatternAI = (
  hist: Column[],
  methodHistory: MethodPredictionHistory[]
): AIPrediction => {
  const reasoning: string[] = [];

  const patternResult = analyzePattern(hist, methodHistory);
  const { prediction, confidence, matchedPattern, description, accuracy } = patternResult;

  // Строим следующую последовательность из 5
  const { sequence: nextPattern, confidence: seqConf } = buildNextSequence(hist, prediction);

  // ─── Формируем рассуждение ──────────────────────────────────────────────────
  reasoning.push(`Анализирую историю из ${hist.length} событий.`);

  if (matchedPattern) {
    reasoning.push(`Найден паттерн: [${matchedPattern}] — ${description}`);
  } else {
    reasoning.push(`Паттерн из истории: ${description}`);
  }

  if (accuracy > 0) {
    reasoning.push(`Точность алгоритма: ${accuracy.toFixed(0)}%`);
  }

  // Серия последних значений
  if (hist.length >= 3) {
    const last = hist[hist.length - 1];
    let streak = 1;
    for (let i = hist.length - 2; i >= 0; i--) {
      if (hist[i] === last) streak++;
      else break;
    }
    if (streak >= 3) {
      reasoning.push(
        `Серия из ${streak} подряд ${last === 'alpha' ? 'α' : 'ω'} — повышенная вероятность смены.`
      );
    }
  }

  // Ожидаемый паттерн
  reasoning.push(
    `Ожидаемая последовательность: ${toSymbols(nextPattern)} (уверенность ~${seqConf}%)`
  );

  reasoning.push(
    `Итог AI: ${prediction === 'alpha' ? 'АЛЬФА (α)' : 'ОМЕГА (ω)'} — уверенность ${confidence}%.`
  );

  return {
    prediction,
    confidence,
    reasoning,
    matchedPattern,
    nextPattern,
    nextPatternConfidence: seqConf,
  };
};
