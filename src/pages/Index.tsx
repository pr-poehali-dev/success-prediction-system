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

  // ─── Найти последнюю серию из 5 одинаковых подряд и позицию после неё ─────
  const findLastStreak = (hist: Column[]): { streakType: Column; offsetFromEnd: number } | null => {
    // Ищем с конца: последнее вхождение 5×alpha или 5×omega подряд
    for (let i = hist.length - 6; i >= 0; i--) {
      const slice = hist.slice(i, i + 5);
      if (slice.every(c => c === 'alpha') || slice.every(c => c === 'omega')) {
        return {
          streakType: slice[0],
          offsetFromEnd: hist.length - (i + 5) // сколько событий прошло после серии
        };
      }
    }
    return null;
  };

  // ─── Анализ паттернов: отправная точка — серия 5 одинаковых ────────────────
  const computePrediction = (hist: Column[]): { column: Column; confidence: number; strategyName: string; alphaProb: number; omegaProb: number; occurrences: number; pattern: string; imbalance: number } | null => {
    if (hist.length < 6) return null;

    const streak = findLastStreak(hist);
    if (!streak) return null;

    const { streakType, offsetFromEnd } = streak;
    // Позиция после серии, которую нужно предсказать = offsetFromEnd-я (0-indexed)
    const targetOffset = offsetFromEnd; // нам нужно предсказать событие на позиции offsetFromEnd

    // Собираем статистику: после каждой серии 5×streakType что было на позиции targetOffset?
    const matches: Column[] = [];
    for (let i = 0; i <= hist.length - 5 - targetOffset - 1; i++) {
      const slice = hist.slice(i, i + 5);
      if (slice.every(c => c === streakType)) {
        matches.push(hist[i + 5 + targetOffset]);
      }
    }

    if (matches.length === 0) return null;

    const alphaCount = matches.filter(c => c === 'alpha').length;
    const omegaCount = matches.filter(c => c === 'omega').length;
    const alphaProb = (alphaCount / matches.length) * 100;
    const omegaProb = (omegaCount / matches.length) * 100;

    const prediction: Column = alphaCount >= omegaCount ? 'alpha' : 'omega';
    const dominant = Math.max(alphaCount, omegaCount);
    const confidence = Math.min(95, 55 + (dominant / matches.length) * 40);

    const streakLabel = streakType === 'alpha' ? '5×α' : '5×ω';
    const posLabel = targetOffset + 1;
    const strategyName = `🎯 После ${streakLabel} → позиция +${posLabel}`;

    const currentAlpha = hist.filter(c => c === 'alpha').length;
    const currentOmega = hist.filter(c => c === 'omega').length;
    const imbalance = currentAlpha - currentOmega;

    // Паттерн для отображения: серия + offset
    const patternDisplay = Array(5).fill(streakType).join('-');

    return {
      column: prediction,
      confidence,
      strategyName,
      alphaProb,
      omegaProb,
      occurrences: matches.length,
      pattern: patternDisplay,
      imbalance
    };
  };

  // ─── Топ-5 паттернов: для каждой серии 5×alpha/omega — распределение по позициям ─
  const getTopPatterns = (hist: Column[]) => {
    if (hist.length < 6) return [];

    // Собираем по каждой серии и позиции offset 0..4
    const map = new Map<string, { nextAlpha: number; nextOmega: number }>();
    for (const sType of ['alpha', 'omega'] as Column[]) {
      for (let offset = 0; offset <= 4; offset++) {
        let nextAlpha = 0;
        let nextOmega = 0;
        for (let i = 0; i <= hist.length - 5 - offset - 1; i++) {
          const slice = hist.slice(i, i + 5);
          if (slice.every(c => c === sType)) {
            const next = hist[i + 5 + offset];
            if (next === 'alpha') nextAlpha++; else nextOmega++;
          }
        }
        if (nextAlpha + nextOmega > 0) {
          const key = `${Array(5).fill(sType).join('-')}|+${offset + 1}`;
          map.set(key, { nextAlpha, nextOmega });
        }
      }
    }

    return Array.from(map.entries())
      .filter(([, d]) => d.nextAlpha + d.nextOmega >= 1)
      .map(([key, d]) => {
        const [patternRaw, offsetLabel] = key.split('|');
        const total = d.nextAlpha + d.nextOmega;
        const conf = (Math.max(d.nextAlpha, d.nextOmega) / total) * 100;
        return {
          pattern: patternRaw + '|' + offsetLabel,
          total,
          nextAlpha: d.nextAlpha,
          nextOmega: d.nextOmega,
          prediction: d.nextAlpha >= d.nextOmega ? 'alpha' as Column : 'omega' as Column,
          confidence: conf
        };
      })
      .sort((a, b) => b.total - a.total || b.confidence - a.confidence)
      .slice(0, 5);
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
          <p className="text-gray-400">Анализ паттернов • Баланс 50/50</p>
          <p className="text-sm text-gray-500">Паттерн: 4 события → прогноз 5-го</p>

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

              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Серия:</span>
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
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="bg-gradient-to-br from-[#D946EF] to-[#8B5CF6] p-4 rounded-xl mb-4">
                <Icon name="Sparkles" size={32} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Прогноз</h2>
              <p className="text-gray-400 text-center">Ожидание серии из 5 одинаковых подряд (αααααα или ωωωωω)</p>
            </div>
          )}
        </Card>

        {/* Топ-5 паттернов */}
        <Card className="bg-white/5 border-white/10 p-6">
          {topPatterns.length > 0 ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <Icon name="Database" size={24} className="text-[#0EA5E9]" />
                <h3 className="text-xl font-bold">Топ-5 паттернов</h3>
                <Badge className="bg-[#0EA5E9]/20 text-[#0EA5E9] border-none">{topPatterns.length} найдено</Badge>
                <span className="text-gray-500 text-xs">(5×серия → позиция)</span>
              </div>
              <div className="space-y-3">
                {topPatterns.map((seq, idx) => {
                  const [patternPart, offsetPart] = seq.pattern.split('|');
                  const streakType = patternPart.split('-')[0];
                  const isActive = adaptivePred && patternPart === adaptivePred.pattern;
                  return (
                    <div key={idx} className={`bg-white/5 rounded-lg p-4 border ${isActive ? 'border-[#D946EF] bg-[#D946EF]/10' : 'border-white/10'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge className="bg-gradient-to-r from-[#0EA5E9] to-[#8B5CF6] text-white border-none px-3">#{idx + 1}</Badge>
                          <div className="flex items-center gap-1">
                            <Badge className={`${streakType === 'alpha' ? 'bg-[#0EA5E9]' : 'bg-[#8B5CF6]'} text-white border-none font-bold px-2`}>
                              5×{streakType === 'alpha' ? 'α' : 'ω'}
                            </Badge>
                            <span className="text-gray-500 text-xs">{offsetPart}</span>
                            <span className="text-gray-500 mx-1">→</span>
                            <Badge className={`${seq.prediction === 'alpha' ? 'bg-[#0EA5E9]/30 text-[#0EA5E9] border-[#0EA5E9]' : 'bg-[#8B5CF6]/30 text-[#8B5CF6] border-[#8B5CF6]'} border font-bold`}>
                              {seq.prediction === 'alpha' ? 'α' : 'ω'}
                            </Badge>
                          </div>
                          <span className="text-gray-400 text-sm">встречался: <span className="text-white font-semibold">{seq.total}×</span></span>
                          <span className="text-gray-400 text-sm">уверенность: <span className="text-white font-semibold">{seq.confidence.toFixed(0)}%</span></span>
                        </div>
                        <div className="flex gap-3 text-xs text-gray-400">
                          <span>α:{seq.nextAlpha}</span>
                          <span>ω:{seq.nextOmega}</span>
                        </div>
                      </div>
                      {isActive && (
                        <div className="mt-2 pt-2 border-t border-[#D946EF]/30 flex items-center gap-2">
                          <Icon name="Sparkles" size={14} className="text-[#D946EF]" />
                          <span className="text-[#D946EF] text-sm font-semibold">Активный паттерн для прогноза</span>
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
              <p className="text-gray-400 text-center">Нужно больше данных для анализа паттернов</p>
            </div>
          )}
        </Card>

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