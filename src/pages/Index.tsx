import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from '@/hooks/use-toast';

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

interface CaptureArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

const Index = () => {
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [recognizedHistory, setRecognizedHistory] = useState<Column[]>([]);
  const [currentSuccess, setCurrentSuccess] = useState<Column | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [currentPrediction, setCurrentPrediction] = useState<{ column: Column; confidence: number } | null>(null);
  const [previousPrediction, setPreviousPrediction] = useState<Column | null>(null);
  const [lastPredictionResult, setLastPredictionResult] = useState<'correct' | 'incorrect' | null>(null);
  const [predictionHistory, setPredictionHistory] = useState<PredictionHistory[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);
  const [captureArea, setCaptureArea] = useState<CaptureArea | null>(null);
  const [isSelectingArea, setIsSelectingArea] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [currentMousePos, setCurrentMousePos] = useState<{ x: number; y: number } | null>(null);
  const [lastRecognizedText, setLastRecognizedText] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // ─── Тип результата прогноза ─────────────────────────────────────────────────
  type PredictionResult = {
    column: Column;
    confidence: number;
    strategyName: string;
    alphaProb: number;
    omegaProb: number;
    occurrences: number;
    pattern: string;
    imbalance: number;
    reasoning: string[];
  };

  // ─── Поиск паттерна строго длиной 4 в конце истории → прогноз 5-го ─────────
  const findPatternStats = (hist: Column[], len: number): { alphaCount: number; omegaCount: number; key: string } | null => {
    if (hist.length < len + 1) return null;
    const key = hist.slice(-len).join('-');
    let alphaCount = 0;
    let omegaCount = 0;
    for (let i = 0; i <= hist.length - len - 1; i++) {
      if (hist.slice(i, i + len).join('-') === key) {
        if (hist[i + len] === 'alpha') alphaCount++; else omegaCount++;
      }
    }
    return { alphaCount, omegaCount, key };
  };

  // ─── Генерация интеллектуального рассуждения ──────────────────────────────
  const buildReasoning = (
    hist: Column[],
    patternKey: string,
    patternLen: number,
    alphaCnt: number,
    omegaCnt: number,
    imbalance: number,
    finalPred: Column
  ): string[] => {
    const lines: string[] = [];
    const total = alphaCnt + omegaCnt;
    const symbols = patternKey.split('-').map(s => s === 'alpha' ? 'α' : 'ω').join('');

    // 1. Описание паттерна из 4 событий
    const patternType = (() => {
      const parts = patternKey.split('-');
      if (parts.every(p => p === parts[0])) return `серия из ${patternLen} одинаковых (${symbols})`;
      const alternating = parts.every((p, i) => i === 0 || p !== parts[i - 1]);
      if (alternating) return `чередование (${symbols})`;
      // Более детальное описание смешанного
      const alphaInPattern = parts.filter(p => p === 'alpha').length;
      const omegaInPattern = parts.filter(p => p === 'omega').length;
      if (alphaInPattern > omegaInPattern) return `α-доминирующий (${symbols})`;
      if (omegaInPattern > alphaInPattern) return `ω-доминирующий (${symbols})`;
      return `равный паттерн (${symbols})`;
    })();

    lines.push(`Паттерн из 4 событий: ${patternType}.`);

    // 2. Статистика: сколько раз после этих 4 выпадало 5-е
    if (total > 0) {
      const dominantLabel = alphaCnt >= omegaCnt ? 'α (Альфа)' : 'ω (Омега)';
      const pct = Math.round(Math.max(alphaCnt, omegaCnt) / total * 100);
      if (total >= 5) {
        lines.push(`Этот паттерн встречался ${total} раз — 5-е событие: ${dominantLabel} в ${pct}% случаев (α:${alphaCnt} / ω:${omegaCnt}).`);
      } else if (total >= 2) {
        lines.push(`Паттерн встречался ${total} раза — 5-е событие: ${dominantLabel} в ${pct}% (α:${alphaCnt} / ω:${omegaCnt}). Статистика ограничена.`);
      } else {
        lines.push(`Паттерн встречался 1 раз — после него выпало ${alphaCnt > 0 ? 'α' : 'ω'}. Данных мало, прогноз предварительный.`);
      }
    }

    // 3. Баланс α/ω по всей истории
    const currentAlpha = hist.filter(c => c === 'alpha').length;
    const currentOmega = hist.filter(c => c === 'omega').length;
    if (Math.abs(imbalance) >= 5) {
      const dominant = imbalance > 0 ? 'α' : 'ω';
      const minority = imbalance > 0 ? 'ω' : 'α';
      lines.push(`Сильный дисбаланс: ${dominant} ведёт на ${Math.abs(imbalance)} (α:${currentAlpha} ω:${currentOmega}). Коррекция в сторону ${minority}.`);
    } else if (Math.abs(imbalance) >= 2) {
      const dominant = imbalance > 0 ? 'α' : 'ω';
      lines.push(`Небольшой перевес ${dominant} (разница ${Math.abs(imbalance)}). Учтено в весе прогноза.`);
    } else {
      lines.push(`Баланс α/ω близок к 50/50 (α:${currentAlpha} ω:${currentOmega}) — паттерн имеет максимальный вес.`);
    }

    // 4. Анализ последних 10 событий для контекста тренда
    if (hist.length >= 10) {
      const last10 = hist.slice(-10);
      const last10Alpha = last10.filter(c => c === 'alpha').length;
      const last10Omega = 10 - last10Alpha;
      if (last10Alpha >= 7) {
        lines.push(`Последние 10 событий: α доминирует (${last10Alpha}/10). Возможен сдвиг к ω.`);
      } else if (last10Omega >= 7) {
        lines.push(`Последние 10 событий: ω доминирует (${last10Omega}/10). Возможен сдвиг к α.`);
      }
    }

    // 5. Итог
    const predLabel = finalPred === 'alpha' ? 'АЛЬФА (α)' : 'ОМЕГА (ω)';
    lines.push(`Итог: 5-е событие → ${predLabel}.`);

    return lines;
  };

  // ─── Основной прогноз: строго паттерн длиной 4 → прогноз 5-го ──────────────
  const computePrediction = (hist: Column[]): PredictionResult | null => {
    if (hist.length < 5) return null;

    const currentAlpha = hist.filter(c => c === 'alpha').length;
    const currentOmega = hist.filter(c => c === 'omega').length;
    const imbalance = currentAlpha - currentOmega;

    // Паттерн строго длиной 4: последние 4 события → предсказываем 5-е
    const stats4 = findPatternStats(hist, 4);
    if (!stats4) return null;
    const { alphaCount, omegaCount, key } = stats4;
    const total = alphaCount + omegaCount;
    if (total === 0) return null;
    const conf = (Math.max(alphaCount, omegaCount) / total) * 100;

    const bestPattern = { key, len: 4, alphaCount, omegaCount, confidence: conf };

    const alphaProb = (alphaCount / total) * 100;
    const omegaProb = (omegaCount / total) * 100;
    const patternPrediction: Column = alphaCount >= omegaCount ? 'alpha' : 'omega';

    // Учитываем баланс: чем сильнее дисбаланс, тем больше его вес
    const balancePrediction: Column = imbalance > 0 ? 'omega' : 'alpha';
    const balanceWeight = Math.min(0.5, Math.abs(imbalance) / (hist.length + 1));
    const patternWeight = 1 - balanceWeight;

    let finalPrediction: Column;
    let confidence: number;
    let strategyName: string;

    if (patternPrediction === balancePrediction) {
      finalPrediction = patternPrediction;
      confidence = Math.min(95, bestPattern.confidence + balanceWeight * 20);
      strategyName = `Паттерн + Баланс сходятся`;
    } else if (balanceWeight > 0.3) {
      finalPrediction = balancePrediction;
      confidence = Math.min(88, 55 + Math.abs(imbalance) * 3);
      strategyName = `Коррекция баланса (перевес: ${imbalance > 0 ? '+' : ''}${imbalance})`;
    } else {
      finalPrediction = patternPrediction;
      confidence = Math.min(92, bestPattern.confidence * patternWeight + 50 * balanceWeight);
      const symbols = key.split('-').map(s => s === 'alpha' ? 'α' : 'ω').join('');
      strategyName = `Паттерн [${symbols}] → следующий`;
    }

    const reasoning = buildReasoning(hist, key, bestPattern.len, alphaCount, omegaCount, imbalance, finalPrediction);

    return {
      column: finalPrediction,
      confidence,
      strategyName,
      alphaProb,
      omegaProb,
      occurrences: total,
      pattern: key,
      imbalance,
      reasoning
    };
  };

  // ─── Топ-5 паттернов строго длиной 5 (4 события + 5-е прогнозное) ──────────
  const getTopPatterns = (hist: Column[]) => {
    if (hist.length < 6) return []; // нужно минимум 6: 4 паттерн + 1 исход + хоть раз повторился

    const map = new Map<string, { nextAlpha: number; nextOmega: number }>();
    // Ищем паттерны ровно длиной 4, смотрим что идёт 5-м
    const len = 4;
    for (let i = 0; i <= hist.length - len - 1; i++) {
      const key = hist.slice(i, i + len).join('-');
      const next = hist[i + len];
      if (!map.has(key)) map.set(key, { nextAlpha: 0, nextOmega: 0 });
      const d = map.get(key)!;
      if (next === 'alpha') d.nextAlpha++; else d.nextOmega++;
    }

    return Array.from(map.entries())
      .filter(([, d]) => d.nextAlpha + d.nextOmega >= 1)
      .map(([pattern, d]) => {
        const total = d.nextAlpha + d.nextOmega;
        const conf = (Math.max(d.nextAlpha, d.nextOmega) / total) * 100;
        const prediction = d.nextAlpha >= d.nextOmega ? 'alpha' as Column : 'omega' as Column;
        return {
          pattern,
          total,
          nextAlpha: d.nextAlpha,
          nextOmega: d.nextOmega,
          prediction,
          confidence: conf,
          len: 4 // паттерн всегда 4 события
        };
      })
      .sort((a, b) => {
        // Сортировка: сначала уверенность, затем количество вхождений
        const scoreDiff = b.confidence - a.confidence;
        if (Math.abs(scoreDiff) > 1) return scoreDiff;
        return b.total - a.total;
      })
      .slice(0, 5);
  };

  // ─── Аналитическое мышление: глубокий анализ всей истории событий ───────────
  const computeDeepAnalytics = (hist: Column[]) => {
    if (hist.length < 5) return null;

    const total = hist.length;
    const alphaCount = hist.filter(c => c === 'alpha').length;
    const omegaCount = hist.filter(c => c === 'omega').length;
    const alphaRatio = alphaCount / total;
    const omegaRatio = omegaCount / total;
    const imbalance = alphaCount - omegaCount;

    // 1. Серии (стрики) — максимальная и текущая
    let maxStreakAlpha = 0, maxStreakOmega = 0;
    let curStreak = 1;
    for (let i = 1; i < hist.length; i++) {
      if (hist[i] === hist[i - 1]) {
        curStreak++;
        if (hist[i] === 'alpha' && curStreak > maxStreakAlpha) maxStreakAlpha = curStreak;
        if (hist[i] === 'omega' && curStreak > maxStreakOmega) maxStreakOmega = curStreak;
      } else {
        curStreak = 1;
      }
    }
    if (maxStreakAlpha === 0) maxStreakAlpha = hist.filter(c => c === 'alpha').length > 0 ? 1 : 0;
    if (maxStreakOmega === 0) maxStreakOmega = hist.filter(c => c === 'omega').length > 0 ? 1 : 0;

    // Текущая серия
    let currentStreakLen = 1;
    const currentStreakType = hist[hist.length - 1];
    for (let i = hist.length - 2; i >= 0; i--) {
      if (hist[i] === currentStreakType) currentStreakLen++;
      else break;
    }

    // 2. Энтропия (мера случайности) на последних 20 событиях
    const window20 = hist.slice(-20);
    let transitions = 0;
    for (let i = 1; i < window20.length; i++) {
      if (window20[i] !== window20[i - 1]) transitions++;
    }
    const entropyScore = window20.length > 1 ? (transitions / (window20.length - 1)) * 100 : 50;

    // 3. Тренд последних 10 vs предыдущих 10
    const recent10Alpha = hist.slice(-10).filter(c => c === 'alpha').length;
    const prev10Alpha = hist.length >= 20 ? hist.slice(-20, -10).filter(c => c === 'alpha').length : null;
    let trendLabel = '';
    let trendDirection: 'alpha' | 'omega' | 'neutral' = 'neutral';
    if (prev10Alpha !== null) {
      const diff = recent10Alpha - prev10Alpha;
      if (diff > 2) { trendLabel = `Рост α: +${diff} в последних 10`; trendDirection = 'alpha'; }
      else if (diff < -2) { trendLabel = `Рост ω: +${Math.abs(diff)} в последних 10`; trendDirection = 'omega'; }
      else trendLabel = 'Стабильное чередование без выраженного тренда';
    } else {
      const r = recent10Alpha;
      if (r >= 7) { trendLabel = `Доминирование α в последних 10 (${r}/10)`; trendDirection = 'alpha'; }
      else if (r <= 3) { trendLabel = `Доминирование ω в последних 10 (${10 - r}/10)`; trendDirection = 'omega'; }
      else trendLabel = 'Равномерное чередование';
    }

    // 4. Паттерн чередования: считаем чередования α-ω-α-ω и повторения α-α, ω-ω
    let alternations = 0, repetitions = 0;
    for (let i = 1; i < hist.length; i++) {
      if (hist[i] !== hist[i - 1]) alternations++;
      else repetitions++;
    }
    const altRatio = hist.length > 1 ? (alternations / (hist.length - 1)) * 100 : 50;

    // 5. Ключевые выводы
    const insights: string[] = [];

    // Баланс
    if (Math.abs(imbalance) <= 2) {
      insights.push(`✅ Идеальный баланс α/ω: ${alphaCount}/${omegaCount} (отклонение ${Math.abs(imbalance)}). Система равновесна.`);
    } else if (Math.abs(imbalance) <= 5) {
      const dominant = imbalance > 0 ? 'α' : 'ω';
      const minority = imbalance > 0 ? 'ω' : 'α';
      insights.push(`⚠️ Умеренный дисбаланс: ${dominant} ведёт на ${Math.abs(imbalance)}. Ожидается коррекция в сторону ${minority}.`);
    } else {
      const dominant = imbalance > 0 ? 'α' : 'ω';
      const minority = imbalance > 0 ? 'ω' : 'α';
      insights.push(`🔴 Сильный дисбаланс: ${dominant} ведёт на ${Math.abs(imbalance)} (${(Math.max(alphaRatio, omegaRatio) * 100).toFixed(0)}%). Система будет корректировать в ${minority}.`);
    }

    // Тренд
    insights.push(`📈 Тренд: ${trendLabel}.`);

    // Чередование
    if (altRatio > 65) {
      insights.push(`🔀 Высокое чередование (${altRatio.toFixed(0)}%): система часто переключается α↔ω. Ожидай смену после текущего.`);
    } else if (altRatio < 40) {
      insights.push(`🔁 Низкое чередование (${altRatio.toFixed(0)}%): доминируют повторения. Текущая серия склонна продолжаться.`);
    } else {
      insights.push(`↔️ Умеренное чередование (${altRatio.toFixed(0)}%): смешанный режим без явного паттерна серий.`);
    }

    // Текущая серия
    if (currentStreakLen >= 3) {
      insights.push(`⚡ Активная серия: ${currentStreakLen} подряд «${currentStreakType === 'alpha' ? 'α' : 'ω'}». Исторически серии ${currentStreakLen}+ обрываются в ${(altRatio).toFixed(0)}% случаев.`);
    } else if (currentStreakLen === 2) {
      insights.push(`➡️ Текущая серия: 2 подряд «${currentStreakType === 'alpha' ? 'α' : 'ω'}». Умеренная вероятность продолжения.`);
    }

    // Энтропия
    if (entropyScore > 70) {
      insights.push(`🎲 Высокая случайность последних 20 событий (${entropyScore.toFixed(0)}% переходов). Прогноз по паттерну менее надёжен.`);
    } else if (entropyScore < 40) {
      insights.push(`🎯 Низкая случайность (${entropyScore.toFixed(0)}% переходов в последних 20). Паттерны стабильны — прогноз надёжнее.`);
    } else {
      insights.push(`📊 Умеренная случайность событий (${entropyScore.toFixed(0)}% переходов). Паттерны работают в обычном режиме.`);
    }

    // Максимальные серии
    if (maxStreakAlpha > 3 || maxStreakOmega > 3) {
      const dominant = maxStreakAlpha >= maxStreakOmega ? `α (макс. ${maxStreakAlpha})` : `ω (макс. ${maxStreakOmega})`;
      insights.push(`📌 В истории замечены длинные серии: ${dominant}. Это типично для этой последовательности.`);
    }

    // Объём данных
    if (total < 15) {
      insights.push(`ℹ️ Малый объём данных (${total} событий). Выводы предварительные — нужно больше событий для точного прогноза.`);
    } else if (total >= 50) {
      insights.push(`💡 Большой объём данных (${total} событий) — статистика высокодостоверна.`);
    }

    return {
      total, alphaCount, omegaCount, alphaRatio, omegaRatio, imbalance,
      maxStreakAlpha, maxStreakOmega,
      currentStreakLen, currentStreakType,
      entropyScore, altRatio, alternations, repetitions,
      trendLabel, trendDirection,
      insights,
      recent10Alpha,
      prev10Alpha
    };
  };

  // ─── Захват экрана ──────────────────────────────────────────────────────────
  const startScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { mediaSource: 'screen' } });
      setCaptureStream(stream);
      setIsCapturing(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      stream.getVideoTracks()[0].addEventListener('ended', stopScreenCapture);
      toast({ title: "Захват экрана запущен", description: "Теперь выберите область для распознавания" });
      setTimeout(() => setIsSelectingArea(true), 500);
    } catch {
      toast({ title: "Ошибка захвата", description: "Не удалось начать захват экрана", variant: "destructive" });
    }
  };

  const stopScreenCapture = () => {
    if (captureStream) captureStream.getTracks().forEach(t => t.stop());
    setCaptureStream(null);
    setIsCapturing(false);
    setCaptureArea(null);
    setIsSelectingArea(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelectingArea || !previewCanvasRef.current) return;
    const rect = previewCanvasRef.current.getBoundingClientRect();
    setSelectionStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setCurrentMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelectingArea || !selectionStart || !previewCanvasRef.current) return;
    const rect = previewCanvasRef.current.getBoundingClientRect();
    setCurrentMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelectingArea || !selectionStart || !previewCanvasRef.current || !videoRef.current) return;
    const canvas = previewCanvasRef.current;
    const video = videoRef.current;
    const rect = canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    const scaleX = video.videoWidth / rect.width;
    const scaleY = video.videoHeight / rect.height;
    const x = Math.min(selectionStart.x, endX) * scaleX;
    const y = Math.min(selectionStart.y, endY) * scaleY;
    const width = Math.abs(endX - selectionStart.x) * scaleX;
    const height = Math.abs(endY - selectionStart.y) * scaleY;
    if (width > 10 && height > 10) {
      setCaptureArea({ x, y, width, height });
      setIsSelectingArea(false);
      setSelectionStart(null);
      setCurrentMousePos(null);
      toast({ title: "Область выбрана", description: "Нажмите 'Начать' для запуска" });
    }
  };

  const handleReselectArea = () => {
    setCaptureArea(null);
    setIsSelectingArea(true);
    setSelectionStart(null);
    setCurrentMousePos(null);
  };

  const recognizeColorFromArea = async (): Promise<Column | null> => {
    if (!videoRef.current || !canvasRef.current || !captureArea) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;
    canvas.width = captureArea.width;
    canvas.height = captureArea.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, captureArea.x, captureArea.y, captureArea.width, captureArea.height, 0, 0, captureArea.width, captureArea.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return analyzeColorPattern(imageData.data, canvas.width, canvas.height);
  };

  const analyzeColorPattern = (data: Uint8ClampedArray, width: number, height: number): Column | null => {
    let cyanScore = 0;
    let purpleScore = 0;
    const totalPixels = width * height;
    if (totalPixels === 0) return null;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if ((b > 150 && b > r * 1.3 && b > g * 1.1 && g > r * 0.8) ||
          (b > 120 && g > 100 && b > r * 1.5 && Math.abs(b - g) < 80)) {
        cyanScore += b - r;
      }
      if ((b > 100 && r > 80 && b > g * 1.2 && r > g * 0.9 && Math.abs(r - b) < 100) ||
          (r > 100 && b > 100 && b > g * 1.3 && r > g * 1.2)) {
        purpleScore += (r + b) / 2 - g;
      }
    }
    const threshold = 300;
    if (cyanScore < threshold && purpleScore < threshold) return null;
    const result = cyanScore > purpleScore ? 'alpha' : 'omega';
    setLastRecognizedText(result === 'alpha' ? 'АЛЬФА (голубой)' : 'ОМЕГА (фиолетовый)');
    return result;
  };

  // ─── Recognition loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCapturing || !isRunning || isPaused || !captureArea) return;
    let lastExecutionTime = Date.now();
    let intervalId: number = 0;
    let isExecuting = false;

    const performRecognition = async () => {
      if (isExecuting) return;
      isExecuting = true;
      const detectedColumn = await recognizeColorFromArea();
      if (detectedColumn) {
        const now = Date.now();
        if (now - lastExecutionTime < 5000) { isExecuting = false; return; }
        if (previousPrediction && currentPrediction) {
          const isCorrect = previousPrediction === detectedColumn;
          setLastPredictionResult(isCorrect ? 'correct' : 'incorrect');
          setTimeout(() => setLastPredictionResult(null), 5000);
          setPredictionHistory(prev => [...prev, {
            id: Date.now(), timestamp: new Date(),
            prediction: previousPrediction, actual: detectedColumn,
            isCorrect, confidence: currentPrediction.confidence
          }]);
        }
        const newEvent: HistoryEvent = { id: Date.now(), column: detectedColumn, timestamp: new Date(), source: 'screen' };
        setHistory(prev => [...prev, newEvent]);
        setRecognizedHistory(prev => [...prev, detectedColumn]);
        setCurrentSuccess(detectedColumn);
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWS56+OZRQ0PVKjk7ahiHAU7k9rxzH0vBSl+zPDef0IKFmG47OWkUhEMTKXh8bllHgU');
        audio.volume = 0.3;
        audio.play().catch(() => {});
        setTimeout(() => setCurrentSuccess(null), 2000);
        setTimeLeft(30);
        toast({ title: `Распознано!`, description: `Обнаружена колонка: ${detectedColumn === 'alpha' ? 'АЛЬФА' : 'ОМЕГА'}` });
        lastExecutionTime = now;
      }
      isExecuting = false;
    };

    performRecognition();
    const checkAndExecute = () => { if (Date.now() - lastExecutionTime >= 29500) performRecognition(); };
    intervalId = window.setInterval(checkAndExecute, 1000);
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [isCapturing, isRunning, isPaused, captureArea, previousPrediction]);

  // ─── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isPaused || !isRunning) return;
    const timer = setInterval(() => { setTimeLeft(prev => prev <= 1 ? 30 : prev - 1); }, 1000);
    return () => clearInterval(timer);
  }, [isCapturing, isPaused, isRunning, previousPrediction]);

  // ─── Preview canvas ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCapturing || !videoRef.current || !previewCanvasRef.current) return;
    let animationId: number;
    const updatePreview = () => {
      const video = videoRef.current;
      const canvas = previewCanvasRef.current;
      if (!video || !canvas) { animationId = requestAnimationFrame(updatePreview); return; }
      if (video.videoWidth === 0) { animationId = requestAnimationFrame(updatePreview); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { animationId = requestAnimationFrame(updatePreview); return; }
      canvas.width = 640; canvas.height = 360;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (captureArea) {
        const sx = canvas.width / video.videoWidth, sy = canvas.height / video.videoHeight;
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
        ctx.strokeRect(captureArea.x * sx, captureArea.y * sy, captureArea.width * sx, captureArea.height * sy);
      }
      if (isSelectingArea && selectionStart && currentMousePos) {
        const canvasRect = canvas.getBoundingClientRect();
        const sx = canvas.width / canvasRect.width, sy = canvas.height / canvasRect.height;
        const x = Math.min(selectionStart.x, currentMousePos.x) * sx;
        const y = Math.min(selectionStart.y, currentMousePos.y) * sy;
        const w = Math.abs(currentMousePos.x - selectionStart.x) * sx;
        const h = Math.abs(currentMousePos.y - selectionStart.y) * sy;
        ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.setLineDash([5, 3]);
        ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
      }
      animationId = requestAnimationFrame(updatePreview);
    };
    animationId = requestAnimationFrame(updatePreview);
    return () => { if (animationId) cancelAnimationFrame(animationId); };
  }, [isCapturing, captureArea, isSelectingArea, selectionStart, currentMousePos]);

  // ─── Обновление прогноза при новом событии ──────────────────────────────────
  useEffect(() => {
    if (recognizedHistory.length > 0) {
      const pred = computePrediction(recognizedHistory);
      if (pred) {
        setCurrentPrediction({ column: pred.column, confidence: pred.confidence });
        setPreviousPrediction(pred.column);
      }
    }
  }, [recognizedHistory]);

  // ─── Управление ─────────────────────────────────────────────────────────────
  const handleStart = () => {
    if (!isCapturing) { toast({ title: "Сначала запустите захват экрана", variant: "destructive" }); return; }
    if (!captureArea) { toast({ title: "Сначала выберите область", variant: "destructive" }); return; }
    setIsRunning(true); setIsPaused(false); setTimeLeft(30);
    toast({ title: "Система запущена", description: "Распознавание цвета каждые 30 секунд" });
  };

  const handleStop = () => {
    setIsRunning(false); setIsPaused(false);
    toast({ title: "Система остановлена" });
  };

  const handleReset = () => {
    setHistory([]); setRecognizedHistory([]); setCurrentSuccess(null);
    setTimeLeft(30); setCurrentPrediction(null); setPreviousPrediction(null);
    setLastPredictionResult(null); setPredictionHistory([]);
    setIsPaused(false); setIsRunning(false); setLastRecognizedText('');
    toast({ title: "Система сброшена", description: "Все данные очищены" });
  };

  const handlePauseResume = () => {
    if (!isRunning) { toast({ title: "Сначала запустите систему", variant: "destructive" }); return; }
    setIsPaused(prev => !prev);
    toast({ title: isPaused ? "Возобновлено" : "Пауза" });
  };

  const exportToCSV = () => {
    const csv = [
      ['№', 'Колонка', 'Время', 'Источник'].join(','),
      ...history.map((e, i) => [i + 1, e.column === 'alpha' ? 'Альфа' : 'Омега', e.timestamp.toLocaleString('ru-RU'), e.source === 'screen' ? 'Захват экрана' : 'Ручной'].join(','))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `success_history_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast({ title: "Экспорт завершен", description: `Сохранено ${history.length} событий` });
  };

  // ─── Вычисляемые данные ──────────────────────────────────────────────────────
  const stats = {
    alpha: history.filter(e => e.column === 'alpha').length,
    omega: history.filter(e => e.column === 'omega').length,
    total: history.length
  };

  const topPatterns = getTopPatterns(recognizedHistory);
  const adaptivePred = computePrediction(recognizedHistory);
  const deepAnalytics = computeDeepAnalytics(recognizedHistory);

  // ─── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A1F2C] via-[#221F26] to-[#1A1F2C] text-white p-6">
      <video ref={videoRef} className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      <div className="max-w-4xl mx-auto space-y-6">

        {/* Заголовок */}
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#0EA5E9] via-[#8B5CF6] to-[#D946EF] bg-clip-text text-transparent">
            SUCCESS Predictor
          </h1>
          <p className="text-gray-400">Анализ паттернов • Баланс 50/50 • Аналитика истории</p>
          <p className="text-sm text-gray-500">Паттерн: 4 события → 5-е прогнозное</p>

          {history.length > 0 && (
            <div className="mt-4 max-w-md mx-auto">
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="flex items-center justify-between mb-2 text-xs text-gray-400">
                  <span>α: {stats.alpha}</span>
                  <span className={`font-semibold ${
                    Math.abs(stats.alpha - stats.omega) < 3 ? 'text-green-400' :
                    Math.abs(stats.alpha - stats.omega) < 6 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    Баланс {((Math.min(stats.alpha, stats.omega) / Math.max(stats.alpha, stats.omega || 1)) * 100).toFixed(0)}%
                  </span>
                  <span>ω: {stats.omega}</span>
                </div>
                <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
                  <div className="absolute left-0 top-0 h-full bg-[#0EA5E9]/80 transition-all duration-300"
                    style={{ width: `${stats.total > 0 ? (stats.alpha / stats.total) * 100 : 50}%` }} />
                  <div className="absolute right-0 top-0 h-full bg-[#8B5CF6]/80 transition-all duration-300"
                    style={{ width: `${stats.total > 0 ? (stats.omega / stats.total) * 100 : 50}%` }} />
                  <div className="absolute left-1/2 top-0 w-0.5 h-full bg-white/50 -translate-x-1/2" />
                </div>
                <div className="flex items-center justify-center mt-2 text-xs">
                  <span className={`${Math.abs(stats.alpha - stats.omega) < 3 ? 'text-green-400' : Math.abs(stats.alpha - stats.omega) < 6 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {Math.abs(stats.alpha - stats.omega) < 3 ? '✓ Сбалансировано' :
                     Math.abs(stats.alpha - stats.omega) < 6 ? '⚠ Небольшой дисбаланс' :
                     `⚡ Дисбаланс: ${stats.alpha > stats.omega ? 'α' : 'ω'} доминирует`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Основной прогноз */}
        <Card className="bg-gradient-to-br from-[#D946EF]/10 via-[#8B5CF6]/10 to-[#0EA5E9]/10 border-[#D946EF]/30 p-6">
          {adaptivePred ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-gradient-to-br from-[#D946EF] to-[#8B5CF6] p-4 rounded-xl">
                    <Icon name="Sparkles" size={32} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold mb-1">Прогноз</h2>
                    <p className="text-gray-400 text-sm">Стратегия: {adaptivePred.strategyName}</p>
                    <p className="text-gray-500 text-xs mt-1">
                      α:{stats.alpha} ω:{stats.omega} • дисбаланс: {adaptivePred.imbalance > 0 ? '+' : ''}{adaptivePred.imbalance}
                    </p>
                  </div>
                </div>
                <div className={`px-8 py-4 rounded-xl border-2 ${
                  adaptivePred.column === 'alpha' ? 'bg-[#0EA5E9]/20 border-[#0EA5E9]' : 'bg-[#8B5CF6]/20 border-[#8B5CF6]'
                }`}>
                  <div className="text-sm text-gray-400 mb-1 text-center">Следующее</div>
                  <div className={`text-5xl font-bold text-center ${adaptivePred.column === 'alpha' ? 'text-[#0EA5E9]' : 'text-[#8B5CF6]'}`}>
                    {adaptivePred.column === 'alpha' ? 'α' : 'ω'}
                  </div>
                  <div className={`text-xs text-center mt-1 ${adaptivePred.column === 'alpha' ? 'text-[#0EA5E9]' : 'text-[#8B5CF6]'}`}>
                    {adaptivePred.column === 'alpha' ? 'АЛЬФА' : 'ОМЕГА'}
                  </div>
                </div>
              </div>

              {/* Паттерн + статистика */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between text-sm flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Паттерн:</span>
                    <div className="flex gap-1">
                      {adaptivePred.pattern.split('-').map((s, i) => (
                        <Badge key={i} className={`${s === 'alpha' ? 'bg-[#0EA5E9]' : 'bg-[#8B5CF6]'} text-white border-none`}>
                          {s === 'alpha' ? 'α' : 'ω'}
                        </Badge>
                      ))}
                      <span className="text-gray-500 mx-1">→</span>
                      <Badge className={`${adaptivePred.column === 'alpha' ? 'bg-[#0EA5E9]' : 'bg-[#8B5CF6]'} text-white border-none ring-2 ring-[#D946EF]`}>
                        {adaptivePred.column === 'alpha' ? 'α' : 'ω'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-gray-400">α: <span className="text-white">{adaptivePred.alphaProb.toFixed(0)}%</span></span>
                    <span className="text-gray-400">ω: <span className="text-white">{adaptivePred.omegaProb.toFixed(0)}%</span></span>
                    <span className="text-gray-400">встречался: <span className="text-white">{adaptivePred.occurrences}×</span></span>
                    <span className="text-gray-400">уверенность: <span className="text-[#D946EF] font-bold">{adaptivePred.confidence.toFixed(0)}%</span></span>
                  </div>
                </div>
              </div>

              {/* Рассуждение системы */}
              {adaptivePred.reasoning && adaptivePred.reasoning.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="BrainCircuit" size={16} className="text-[#D946EF]" />
                    <span className="text-sm font-semibold text-[#D946EF]">Рассуждение системы</span>
                  </div>
                  <div className="space-y-2">
                    {adaptivePred.reasoning.map((line, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-[#D946EF]/60 font-mono text-xs mt-0.5 shrink-0">{i + 1}.</span>
                        <span className={`${i === adaptivePred.reasoning.length - 1 ? 'text-white font-semibold' : 'text-gray-300'}`}>{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="bg-gradient-to-br from-[#D946EF] to-[#8B5CF6] p-4 rounded-xl mb-4">
                <Icon name="Sparkles" size={32} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Прогноз</h2>
              <p className="text-gray-400 text-center">Накопите минимум 5 событий для первого прогноза (паттерн 4 → 5-е)</p>
            </div>
          )}
        </Card>

        {/* Топ-5 паттернов (строго 4 события + 5-е прогнозное) */}
        <Card className="bg-white/5 border-white/10 p-6">
          {topPatterns.length > 0 ? (
            <>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <Icon name="Database" size={24} className="text-[#0EA5E9]" />
                <h3 className="text-xl font-bold">Топ-5 паттернов</h3>
                <Badge className="bg-[#0EA5E9]/20 text-[#0EA5E9] border-none">{topPatterns.length} найдено</Badge>
                <span className="text-gray-500 text-xs">4 события → 5-е прогнозное</span>
              </div>
              <div className="space-y-3">
                {topPatterns.map((seq, idx) => {
                  const isActive = adaptivePred && seq.pattern === adaptivePred.pattern;
                  return (
                    <div key={idx} className={`bg-white/5 rounded-lg p-4 border ${isActive ? 'border-[#D946EF] bg-[#D946EF]/10' : 'border-white/10'}`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge className="bg-gradient-to-r from-[#0EA5E9] to-[#8B5CF6] text-white border-none px-3">#{idx + 1}</Badge>
                          {/* 4 события паттерна */}
                          <div className="flex items-center gap-1">
                            {seq.pattern.split('-').map((s, i) => (
                              <Badge key={i} className={`${s === 'alpha' ? 'bg-[#0EA5E9]' : 'bg-[#8B5CF6]'} text-white border-none font-bold text-sm px-2`}>
                                {s === 'alpha' ? 'α' : 'ω'}
                              </Badge>
                            ))}
                            <span className="text-gray-500 mx-1 font-bold">→</span>
                            {/* 5-е прогнозное */}
                            <Badge className={`${seq.prediction === 'alpha' ? 'bg-[#0EA5E9]/30 text-[#0EA5E9] border-[#0EA5E9]' : 'bg-[#8B5CF6]/30 text-[#8B5CF6] border-[#8B5CF6]'} border-2 font-bold text-sm px-2 ring-2 ring-offset-1 ring-offset-transparent ${seq.prediction === 'alpha' ? 'ring-[#0EA5E9]/40' : 'ring-[#8B5CF6]/40'}`}>
                              {seq.prediction === 'alpha' ? 'α' : 'ω'}
                            </Badge>
                            <span className="text-gray-500 text-xs ml-1">(5-е)</span>
                          </div>
                          <div className="flex gap-3 text-sm">
                            <span className="text-gray-400">встречался: <span className="text-white font-semibold">{seq.total}×</span></span>
                            <span className="text-gray-400">уверенность: <span className={`font-bold ${seq.confidence >= 70 ? 'text-green-400' : seq.confidence >= 55 ? 'text-yellow-400' : 'text-orange-400'}`}>{seq.confidence.toFixed(0)}%</span></span>
                          </div>
                        </div>
                        <div className="flex gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-[#0EA5E9]" />α:{seq.nextAlpha}</span>
                          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-[#8B5CF6]" />ω:{seq.nextOmega}</span>
                        </div>
                      </div>
                      {isActive && (
                        <div className="mt-2 pt-2 border-t border-[#D946EF]/30 flex items-center gap-2">
                          <Icon name="Sparkles" size={14} className="text-[#D946EF]" />
                          <span className="text-[#D946EF] text-sm font-semibold">🎯 Активный паттерн — используется для прогноза</span>
                        </div>
                      )}
                      <Progress value={seq.confidence} className="h-1 mt-3" />
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <Icon name="Database" size={48} className="text-[#0EA5E9] mb-4" />
              <h3 className="text-xl font-bold mb-2">Топ-5 паттернов</h3>
              <p className="text-gray-400 text-center">Нужно минимум 6 событий для анализа паттернов (4 + исход + повторение)</p>
            </div>
          )}
        </Card>

        {/* Аналитическое мышление — глубокий анализ всей истории */}
        {deepAnalytics && (
          <Card className="bg-gradient-to-br from-[#0EA5E9]/5 via-[#8B5CF6]/5 to-[#D946EF]/5 border-[#8B5CF6]/30 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-gradient-to-br from-[#8B5CF6] to-[#D946EF] p-3 rounded-xl">
                <Icon name="BrainCircuit" size={24} className="text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Аналитика всей истории</h3>
                <p className="text-gray-400 text-sm">Глубокий анализ {deepAnalytics.total} событий</p>
              </div>
            </div>

            {/* Метрики */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
                <div className="text-xs text-gray-400 mb-1">Всего событий</div>
                <div className="text-2xl font-bold text-white">{deepAnalytics.total}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 border border-[#0EA5E9]/20 text-center">
                <div className="text-xs text-gray-400 mb-1">α / ω</div>
                <div className="text-2xl font-bold">
                  <span className="text-[#0EA5E9]">{deepAnalytics.alphaCount}</span>
                  <span className="text-gray-500 text-lg"> / </span>
                  <span className="text-[#8B5CF6]">{deepAnalytics.omegaCount}</span>
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
                <div className="text-xs text-gray-400 mb-1">Случайность</div>
                <div className={`text-2xl font-bold ${deepAnalytics.entropyScore > 70 ? 'text-orange-400' : deepAnalytics.entropyScore < 40 ? 'text-green-400' : 'text-yellow-400'}`}>
                  {deepAnalytics.entropyScore.toFixed(0)}%
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
                <div className="text-xs text-gray-400 mb-1">Чередование</div>
                <div className={`text-2xl font-bold ${deepAnalytics.altRatio > 65 ? 'text-[#0EA5E9]' : deepAnalytics.altRatio < 40 ? 'text-[#D946EF]' : 'text-white'}`}>
                  {deepAnalytics.altRatio.toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Текущая серия */}
            <div className="flex items-center gap-3 mb-4 bg-white/5 rounded-lg p-3 border border-white/10">
              <Icon name="Zap" size={18} className={deepAnalytics.currentStreakLen >= 3 ? 'text-yellow-400' : 'text-gray-400'} />
              <div className="text-sm">
                <span className="text-gray-400">Текущая серия: </span>
                <span className={`font-bold ${deepAnalytics.currentStreakType === 'alpha' ? 'text-[#0EA5E9]' : 'text-[#8B5CF6]'}`}>
                  {deepAnalytics.currentStreakLen}× «{deepAnalytics.currentStreakType === 'alpha' ? 'α' : 'ω'}»
                </span>
                {deepAnalytics.maxStreakAlpha > 1 && (
                  <span className="text-gray-500 text-xs ml-3">макс.α: {deepAnalytics.maxStreakAlpha}</span>
                )}
                {deepAnalytics.maxStreakOmega > 1 && (
                  <span className="text-gray-500 text-xs ml-2">макс.ω: {deepAnalytics.maxStreakOmega}</span>
                )}
              </div>
            </div>

            {/* Тренд последних 10 событий */}
            <div className="flex items-center gap-3 mb-5 bg-white/5 rounded-lg p-3 border border-white/10">
              <Icon name="TrendingUp" size={18} className={
                deepAnalytics.trendDirection === 'alpha' ? 'text-[#0EA5E9]' :
                deepAnalytics.trendDirection === 'omega' ? 'text-[#8B5CF6]' : 'text-gray-400'
              } />
              <div className="text-sm">
                <span className="text-gray-400">Тренд: </span>
                <span className={`font-semibold ${
                  deepAnalytics.trendDirection === 'alpha' ? 'text-[#0EA5E9]' :
                  deepAnalytics.trendDirection === 'omega' ? 'text-[#8B5CF6]' : 'text-white'
                }`}>{deepAnalytics.trendLabel}</span>
                {deepAnalytics.prev10Alpha !== null && (
                  <span className="text-gray-500 text-xs ml-2">
                    (пред.10: α={deepAnalytics.prev10Alpha} → посл.10: α={deepAnalytics.recent10Alpha})
                  </span>
                )}
              </div>
            </div>

            {/* Ключевые выводы */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Icon name="Lightbulb" size={16} className="text-[#D946EF]" />
                <span className="text-sm font-semibold text-[#D946EF]">Ключевые выводы системы</span>
              </div>
              <div className="space-y-2">
                {deepAnalytics.insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                    <span className="text-[#8B5CF6]/70 font-mono text-xs mt-0.5 shrink-0 w-4">{i + 1}.</span>
                    <span className={`text-sm ${i === 0 ? 'text-white font-medium' : 'text-gray-300'}`}>{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Кнопки управления */}
        <div className="flex gap-3 justify-center flex-wrap">
          <Button
            onClick={isCapturing ? stopScreenCapture : startScreenCapture}
            className={`${isCapturing ? 'bg-red-500 hover:bg-red-600' : 'bg-gradient-to-r from-[#8B5CF6] to-[#0EA5E9] hover:opacity-90'} text-lg px-8 py-6`}
          >
            <Icon name={isCapturing ? "StopCircle" : "Monitor"} size={24} className="mr-2" />
            {isCapturing ? 'Остановить захват' : 'Начать захват экрана'}
          </Button>

          {isCapturing && (
            <>
              {!isRunning ? (
                <Button onClick={handleStart} disabled={!captureArea}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-90 text-white text-lg px-8 py-6">
                  <Icon name="Play" size={24} className="mr-2" />Начать
                </Button>
              ) : (
                <Button onClick={handleStop}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:opacity-90 text-white text-lg px-8 py-6">
                  <Icon name="Square" size={24} className="mr-2" />Стоп
                </Button>
              )}
              <Button onClick={handlePauseResume} variant="outline" disabled={!isRunning}
                className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/10">
                <Icon name={isPaused ? "Play" : "Pause"} size={20} className="mr-2" />
                {isPaused ? 'Возобновить' : 'Пауза'}
              </Button>
              <Button onClick={handleReset} variant="outline" className="border-red-500 text-red-400 hover:bg-red-500/10">
                <Icon name="RotateCcw" size={20} className="mr-2" />Сброс
              </Button>
              {history.length > 0 && (
                <Button onClick={exportToCSV} variant="outline" className="border-[#8B5CF6] text-[#8B5CF6] hover:bg-[#8B5CF6]/10">
                  <Icon name="Download" size={20} className="mr-2" />Экспорт CSV
                </Button>
              )}
            </>
          )}
        </div>

        {/* Статус-подсказки */}
        {!isCapturing && (
          <Card className="bg-blue-500/10 border-blue-500/30 p-4">
            <div className="flex items-center gap-3">
              <Icon name="Info" size={20} className="text-blue-400" />
              <span className="text-blue-400 font-semibold">Шаг 1: Нажмите "Начать захват экрана"</span>
            </div>
          </Card>
        )}
        {isCapturing && !captureArea && (
          <Card className="bg-yellow-500/10 border-yellow-500/30 p-4">
            <div className="flex items-center gap-3">
              <Icon name="MousePointer2" size={20} className="text-yellow-400" />
              <span className="text-yellow-400 font-semibold">Шаг 2: Нарисуйте прямоугольник вокруг голубой или фиолетовой колонки</span>
            </div>
          </Card>
        )}
        {isCapturing && captureArea && !isRunning && (
          <Card className="bg-green-500/10 border-green-500/30 p-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-400 font-semibold">Область выбрана! Шаг 3: Нажмите "Начать"</span>
            </div>
          </Card>
        )}
        {isCapturing && isRunning && !isPaused && (
          <Card className="bg-green-500/10 border-green-500/30 p-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-400 font-semibold">Система работает — распознавание каждые 30 секунд</span>
            </div>
          </Card>
        )}
        {isPaused && (
          <Card className="bg-yellow-500/10 border-yellow-500/30 p-4">
            <div className="flex items-center gap-3">
              <Icon name="Pause" size={20} className="text-yellow-400" />
              <span className="text-yellow-400 font-semibold">Система на паузе</span>
            </div>
          </Card>
        )}

        {/* Превью экрана */}
        {isCapturing && (
          <Card className="bg-white/5 border-white/10 p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Icon name="Video" size={20} className="text-[#8B5CF6]" />
                  Превью захвата
                </h3>
                {lastRecognizedText && <Badge className="bg-[#0EA5E9]">Распознано: {lastRecognizedText}</Badge>}
              </div>
              <p className="text-sm text-gray-400">
                {isSelectingArea ? 'Нарисуйте прямоугольник вокруг нужной области' :
                 captureArea ? 'Область выбрана (чёрный прямоугольник). Перевыбрать:' : 'Область не выбрана'}
              </p>
              {captureArea && !isSelectingArea && (
                <Button onClick={handleReselectArea} variant="outline" size="sm"
                  className="border-[#8B5CF6] text-[#8B5CF6] hover:bg-[#8B5CF6]/10">
                  <Icon name="Crop" size={16} className="mr-2" />Перевыбрать область
                </Button>
              )}
              <canvas
                ref={previewCanvasRef}
                className="w-full rounded-lg border border-white/10"
                style={{ cursor: isSelectingArea ? 'crosshair' : 'default' }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
              />
            </div>
          </Card>
        )}

        {/* Результат прогноза */}
        {lastPredictionResult && (
          <Card className={`${lastPredictionResult === 'correct' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} p-6`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Icon name={lastPredictionResult === 'correct' ? "CheckCircle2" : "XCircle"} size={32}
                  className={lastPredictionResult === 'correct' ? 'text-green-400' : 'text-red-400'} />
                <div>
                  <h3 className={`text-2xl font-bold ${lastPredictionResult === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
                    {lastPredictionResult === 'correct' ? 'Прогноз совпал!' : 'Прогноз не совпал'}
                  </h3>
                  <p className="text-gray-400 mt-1">
                    Предсказано: <Badge className={`${previousPrediction === 'alpha' ? 'bg-[#0EA5E9]' : 'bg-[#8B5CF6]'} text-white border-none ml-2`}>
                      {previousPrediction === 'alpha' ? 'АЛЬФА' : 'ОМЕГА'}
                    </Badge>
                  </p>
                  <p className="text-gray-400 mt-1">
                    Факт: <Badge className={`${history[history.length - 1]?.column === 'alpha' ? 'bg-[#0EA5E9]' : 'bg-[#8B5CF6]'} text-white border-none ml-2`}>
                      {history[history.length - 1]?.column === 'alpha' ? 'АЛЬФА' : 'ОМЕГА'}
                    </Badge>
                  </p>
                </div>
              </div>
              {lastPredictionResult === 'correct' && <div className="text-6xl">🎯</div>}
            </div>
          </Card>
        )}

        {/* Статистика точности */}
        {predictionHistory.length > 0 && (
          <Card className="bg-white/5 border-white/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Icon name="TrendingUp" size={24} className="text-[#0EA5E9]" />
              <h3 className="text-xl font-bold">Статистика прогнозов</h3>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="text-sm text-gray-400 mb-1">Всего</div>
                <div className="text-3xl font-bold">{predictionHistory.length}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4 border border-green-500/30">
                <div className="text-sm text-gray-400 mb-1">Успешных</div>
                <div className="text-3xl font-bold text-green-400">{predictionHistory.filter(p => p.isCorrect).length}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4 border border-red-500/30">
                <div className="text-sm text-gray-400 mb-1">Ошибок</div>
                <div className="text-3xl font-bold text-red-400">{predictionHistory.filter(p => !p.isCorrect).length}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4 border border-[#D946EF]/30">
                <div className="text-sm text-gray-400 mb-1">Точность</div>
                <div className="text-3xl font-bold text-[#D946EF]">
                  {((predictionHistory.filter(p => p.isCorrect).length / predictionHistory.length) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-gray-400 text-sm">Последние 5:</span>
              <div className="flex gap-2">
                {predictionHistory.slice(-5).map((p) => (
                  <div key={p.id} className={`w-9 h-9 rounded-lg flex items-center justify-center ${p.isCorrect ? 'bg-green-500/20 border border-green-500' : 'bg-red-500/20 border border-red-500'}`}>
                    <Icon name={p.isCorrect ? "Check" : "X"} size={18} className={p.isCorrect ? "text-green-400" : "text-red-400"} />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Таймер */}
        <Card className="bg-white/5 border-white/10 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon name="Clock" size={24} className="text-gray-400" />
              <span className="text-lg">Следующее сканирование через:</span>
            </div>
            <div className="text-3xl font-bold text-[#0EA5E9]">{timeLeft}s</div>
          </div>
          <Progress value={(30 - timeLeft) / 30 * 100} className="mt-4 h-2" />
        </Card>

        {/* Статистика событий */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-white/5 border-white/10 p-5">
            <div className="flex items-center gap-3 mb-3">
              <Icon name="BarChart3" size={20} className="text-[#0EA5E9]" />
              <h4 className="font-semibold">Статистика</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Всего событий:</span>
                <span className="font-bold">{stats.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0EA5E9]">Альфа:</span>
                <span className="font-bold text-[#0EA5E9]">{stats.alpha} ({stats.total > 0 ? ((stats.alpha / stats.total) * 100).toFixed(1) : 0}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B5CF6]">Омега:</span>
                <span className="font-bold text-[#8B5CF6]">{stats.omega} ({stats.total > 0 ? ((stats.omega / stats.total) * 100).toFixed(1) : 0}%)</span>
              </div>
            </div>
          </Card>
          <Card className="bg-white/5 border-white/10 p-5">
            <div className="flex items-center gap-3 mb-3">
              <Icon name="Activity" size={20} className="text-[#D946EF]" />
              <h4 className="font-semibold">Последние 10</h4>
            </div>
            <div className="flex gap-1 flex-wrap">
              {history.slice(-10).reverse().map((event) => (
                <Badge key={event.id} variant="outline"
                  className={`${event.column === 'alpha' ? 'border-[#0EA5E9] text-[#0EA5E9] bg-[#0EA5E9]/10' : 'border-[#8B5CF6] text-[#8B5CF6] bg-[#8B5CF6]/10'} text-xs`}>
                  {event.column === 'alpha' ? 'α' : 'ω'}{event.source === 'screen' && '📹'}
                </Badge>
              ))}
            </div>
          </Card>
        </div>

        {/* История событий */}
        <Card className="bg-white/5 border-white/10 p-5">
          <div className="flex items-center gap-3 mb-4">
            <Icon name="History" size={20} className="text-[#8B5CF6]" />
            <h3 className="text-xl font-bold">История событий</h3>
            {predictionHistory.length > 0 && (
              <Badge className="bg-[#8B5CF6]/20 text-[#8B5CF6] border-none">
                Точность: {((predictionHistory.filter(p => p.isCorrect).length / predictionHistory.length) * 100).toFixed(1)}%
              </Badge>
            )}
          </div>
          {history.length > 0 ? (
            <div className="max-h-96 overflow-y-auto space-y-2">
              {history.slice().reverse().map((event, idx) => {
                const eventNumber = history.length - idx;
                const pred = predictionHistory.find(p => Math.abs(p.timestamp.getTime() - event.timestamp.getTime()) < 2000);
                return (
                  <div key={event.id} className={`p-3 rounded-lg border ${pred ? pred.isCorrect ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 text-sm w-8">#{eventNumber}</span>
                        <Badge className={`${event.column === 'alpha' ? 'bg-[#0EA5E9]' : 'bg-[#8B5CF6]'} text-white border-none text-xs`}>
                          {event.column === 'alpha' ? 'АЛЬФА' : 'ОМЕГА'}
                        </Badge>
                        {pred && (
                          <>
                            <Icon name="ArrowRight" size={16} className="text-gray-500" />
                            <span className="text-xs text-gray-400">Прогноз:</span>
                            <Badge className={`${pred.prediction === 'alpha' ? 'bg-[#0EA5E9]' : 'bg-[#8B5CF6]'} text-white border-none text-xs`}>
                              {pred.prediction === 'alpha' ? 'АЛЬФА' : 'ОМЕГА'}
                            </Badge>
                            <Icon name={pred.isCorrect ? "CheckCircle2" : "XCircle"} size={16}
                              className={pred.isCorrect ? 'text-green-400' : 'text-red-400'} />
                            <span className="text-xs text-gray-500">{pred.confidence.toFixed(0)}%</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs border-white/20 text-gray-400">
                          {event.source === 'screen' ? '📹 Авто' : '✋ Ручной'}
                        </Badge>
                        <span className="text-xs text-gray-500">{event.timestamp.toLocaleTimeString('ru-RU')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Icon name="History" size={48} className="mb-4 opacity-30" />
              <p>История пуста — запустите систему</p>
            </div>
          )}
        </Card>

      </div>
    </div>
  );
};

export default Index;