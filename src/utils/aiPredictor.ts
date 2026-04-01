import { Column, AlgorithmPrediction, AIPrediction, MethodPredictionHistory } from '@/types/prediction';
import { calculateMethodAccuracy } from './predictionAlgorithms';

// ─── AI Predictor ────────────────────────────────────────────────────────────
// Анализирует результаты трёх алгоритмов, динамически взвешивает их
// по исторической точности и формирует итоговый прогноз с объяснением.

const BASE_WEIGHT = 1;
const MIN_HISTORY_FOR_ADAPTIVE = 5; // минимум предсказаний для адаптивного веса

/**
 * Вычисляет динамический вес алгоритма на основе его точности.
 * При нехватке данных — базовый вес 1.
 * При точности > 50% — вес экспоненциально растёт.
 * При точности < 50% — вес снижается, но не до нуля.
 */
const computeAdaptiveWeight = (
  methodName: string,
  methodHistory: MethodPredictionHistory[]
): number => {
  const predictions = methodHistory.filter(m => m.methodName === methodName);
  if (predictions.length < MIN_HISTORY_FOR_ADAPTIVE) return BASE_WEIGHT;

  const accuracy = calculateMethodAccuracy(methodName, methodHistory) / 100; // 0..1

  // Экспоненциальная шкала: точность 50% → вес 1, 70% → ~4, 90% → ~27
  // Формула: w = exp(k * (acc - 0.5)) где k=6
  const k = 6;
  const weight = Math.exp(k * (accuracy - 0.5));

  return Math.max(0.1, Math.min(weight, 50)); // клампим в [0.1, 50]
};

/**
 * Анализирует тренд точности: растёт, падает или стабильна.
 */
const accuracyTrend = (
  methodName: string,
  methodHistory: MethodPredictionHistory[]
): 'growing' | 'falling' | 'stable' => {
  const preds = methodHistory
    .filter(m => m.methodName === methodName)
    .slice(-10); // последние 10

  if (preds.length < 6) return 'stable';

  const firstHalf = preds.slice(0, 5).filter(p => p.isCorrect).length / 5;
  const secondHalf = preds.slice(5).filter(p => p.isCorrect).length / Math.max(1, preds.slice(5).length);

  const diff = secondHalf - firstHalf;
  if (diff > 0.15) return 'growing';
  if (diff < -0.15) return 'falling';
  return 'stable';
};

/**
 * Степень согласия алгоритмов: все за одно, двое против одного, или полный конфликт.
 */
const computeAgreement = (
  predictions: AlgorithmPrediction[]
): 'full' | 'partial' | 'conflict' => {
  const alphaVotes = predictions.filter(p => p.prediction === 'alpha').length;
  const omegaVotes = predictions.filter(p => p.prediction === 'omega').length;

  if (alphaVotes === predictions.length || omegaVotes === predictions.length) return 'full';
  if (Math.abs(alphaVotes - omegaVotes) >= 1) return 'partial';
  return 'conflict';
};

/**
 * Главная функция AI-предсказателя.
 */
export const runAIPredictor = (
  algorithms: AlgorithmPrediction[],
  methodHistory: MethodPredictionHistory[],
  history: Column[]
): AIPrediction => {
  const reasoning: string[] = [];

  // 1. Вычисляем адаптивные веса
  const weights: Record<string, number> = {};
  for (const algo of algorithms) {
    weights[algo.name] = computeAdaptiveWeight(algo.name, methodHistory);
  }

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const normalizedWeights = Object.fromEntries(
    Object.entries(weights).map(([k, v]) => [k, v / totalWeight])
  );

  // 2. Взвешенное голосование
  let alphaScore = 0;
  let omegaScore = 0;

  for (const algo of algorithms) {
    const w = weights[algo.name];
    // Уверенность нормализуем от 0 до 1 относительно 50% базы
    const confNorm = (algo.confidence - 50) / 50; // -1..1
    const vote = confNorm * w;

    if (algo.prediction === 'alpha') alphaScore += vote;
    else omegaScore += vote;
  }

  const prediction: Column = alphaScore >= omegaScore ? 'alpha' : 'omega';
  const scoreDiff = Math.abs(alphaScore - omegaScore);
  const totalScore = Math.abs(alphaScore) + Math.abs(omegaScore) || 1;
  const rawConfidence = 50 + (scoreDiff / totalScore) * 45;
  const confidence = Math.round(Math.min(97, Math.max(51, rawConfidence)));

  // 3. Согласие алгоритмов
  const agreement = computeAgreement(algorithms);

  // 4. Формируем рассуждение
  reasoning.push(`Анализирую ${algorithms.length} алгоритма с адаптивными весами.`);

  // Веса и точность
  const weightLines = algorithms.map(a => {
    const acc = calculateMethodAccuracy(a.name, methodHistory);
    const w = normalizedWeights[a.name];
    const trend = accuracyTrend(a.name, methodHistory);
    const trendMark = trend === 'growing' ? '↑' : trend === 'falling' ? '↓' : '→';
    const shortName = a.name === 'Pattern Recognition' ? 'Pattern'
      : a.name === 'Frequency Analysis' ? 'Frequency' : 'Entropy';
    return `${shortName}: точность ${acc > 0 ? acc.toFixed(0) + '%' : 'н/д'} ${trendMark}, вес ${(w * 100).toFixed(0)}%`;
  });
  reasoning.push(weightLines.join(' | '));

  // Результаты алгоритмов
  const algoResults = algorithms
    .map(a => `${a.name === 'Pattern Recognition' ? 'Pattern' : a.name === 'Frequency Analysis' ? 'Freq' : 'Entropy'}: ${a.prediction === 'alpha' ? 'α' : 'ω'} (${a.confidence}%)`)
    .join(', ');
  reasoning.push(`Голоса: ${algoResults}`);

  // Согласие
  if (agreement === 'full') {
    reasoning.push('Все алгоритмы единодушны — высокая надёжность прогноза.');
  } else if (agreement === 'partial') {
    const majority = algorithms.filter(a => a.prediction === prediction);
    const minority = algorithms.find(a => a.prediction !== prediction);
    reasoning.push(
      `Большинство (${majority.map(m => m.name === 'Pattern Recognition' ? 'Pattern' : m.name === 'Frequency Analysis' ? 'Freq' : 'Entropy').join(', ')}) ` +
      `против ${minority?.name === 'Pattern Recognition' ? 'Pattern' : minority?.name === 'Frequency Analysis' ? 'Freq' : 'Entropy'} — умеренная уверенность.`
    );
  } else {
    reasoning.push('Алгоритмы в конфликте — прогноз по суммарному взвешенному счёту.');
  }

  // Доп. контекст: серия последних событий
  if (history.length >= 3) {
    const streak = (() => {
      let count = 1;
      const last = history[history.length - 1];
      for (let i = history.length - 2; i >= 0; i--) {
        if (history[i] === last) count++;
        else break;
      }
      return { value: last, count };
    })();

    if (streak.count >= 3) {
      reasoning.push(
        `Серия из ${streak.count} подряд ${streak.value === 'alpha' ? 'α' : 'ω'} — повышенная вероятность смены.`
      );
    }
  }

  reasoning.push(`Итог AI: ${prediction === 'alpha' ? 'АЛЬФА (α)' : 'ОМЕГА (ω)'} — уверенность ${confidence}%.`);

  return {
    prediction,
    confidence,
    reasoning,
    weights: {
      pattern: Math.round(normalizedWeights['Pattern Recognition'] * 100),
      frequency: Math.round(normalizedWeights['Frequency Analysis'] * 100),
      entropy: Math.round(normalizedWeights['Entropy'] * 100)
    },
    agreement
  };
};
