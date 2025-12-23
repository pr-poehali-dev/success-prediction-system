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

interface AlgorithmPrediction {
  name: string;
  prediction: Column;
  confidence: number;
  accuracy: number;
  description: string;
}

interface AccuracyPoint {
  timestamp: number;
  pattern: number;
  frequency: number;
  markov: number;
}

interface CaptureArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

const Index = () => {
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [currentSuccess, setCurrentSuccess] = useState<Column | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [predictions, setPredictions] = useState<AlgorithmPrediction[]>([]);
  const [ensemblePrediction, setEnsemblePrediction] = useState<{ column: Column; confidence: number } | null>(null);
  const [previousPrediction, setPreviousPrediction] = useState<Column | null>(null);
  const [lastPredictionResult, setLastPredictionResult] = useState<'correct' | 'incorrect' | null>(null);
  const [accuracyHistory, setAccuracyHistory] = useState<AccuracyPoint[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);
  const [captureArea, setCaptureArea] = useState<CaptureArea | null>(null);
  const [isSelectingArea, setIsSelectingArea] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [lastRecognizedText, setLastRecognizedText] = useState<string>('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const analyzePattern = (hist: HistoryEvent[]): AlgorithmPrediction => {
    if (hist.length < 3) {
      return {
        name: 'Pattern Recognition',
        prediction: 'alpha',
        confidence: 50,
        accuracy: 0,
        description: 'Поиск повторяющихся последовательностей'
      };
    }

    const last3 = hist.slice(-3).map(e => e.column);
    const pattern = last3.join('');
    
    const allPatterns = hist.slice(0, -1).map((_, i) => 
      hist.slice(i, i + 3).map(e => e.column).join('')
    );
    
    const nextAfterPattern = allPatterns
      .map((p, i) => p === pattern ? hist[i + 3]?.column : null)
      .filter(Boolean);

    const alphaCount = nextAfterPattern.filter(c => c === 'alpha').length;
    const omegaCount = nextAfterPattern.filter(c => c === 'omega').length;
    
    const prediction: Column = alphaCount >= omegaCount ? 'alpha' : 'omega';
    const confidence = Math.min(95, 50 + (Math.abs(alphaCount - omegaCount) / (nextAfterPattern.length || 1)) * 45);
    
    const correct = hist.slice(3).filter((e, i) => {
      const prev3 = hist.slice(i, i + 3).map(ev => ev.column).join('');
      const predicted = allPatterns.indexOf(prev3) >= 0 ? 
        (alphaCount >= omegaCount ? 'alpha' : 'omega') : 'alpha';
      return e.column === predicted;
    }).length;
    
    const accuracy = hist.length > 3 ? (correct / (hist.length - 3)) * 100 : 0;

    return {
      name: 'Pattern Recognition',
      prediction,
      confidence,
      accuracy,
      description: 'Поиск повторяющихся последовательностей'
    };
  };

  const analyzeFrequency = (hist: HistoryEvent[]): AlgorithmPrediction => {
    const alphaCount = hist.filter(e => e.column === 'alpha').length;
    const omegaCount = hist.filter(e => e.column === 'omega').length;
    const total = hist.length;

    if (total === 0) {
      return {
        name: 'Frequency Analysis',
        prediction: 'alpha',
        confidence: 50,
        accuracy: 0,
        description: 'Анализ частоты появлений'
      };
    }

    const alphaProb = alphaCount / total;
    const omegaProb = omegaCount / total;
    
    const prediction: Column = alphaProb < omegaProb ? 'alpha' : 'omega';
    const confidence = Math.abs(alphaProb - omegaProb) * 100;
    
    const expectedNext = alphaProb < omegaProb ? 'alpha' : 'omega';
    const correct = hist.filter(e => e.column === expectedNext).length;
    const accuracy = (correct / total) * 100;

    return {
      name: 'Frequency Analysis',
      prediction,
      confidence: Math.min(95, 50 + confidence / 2),
      accuracy,
      description: 'Анализ частоты появлений'
    };
  };

  const analyzeMarkov = (hist: HistoryEvent[]): AlgorithmPrediction => {
    if (hist.length < 2) {
      return {
        name: 'Markov Chain',
        prediction: 'omega',
        confidence: 50,
        accuracy: 0,
        description: 'Цепи Маркова (переходы между состояниями)'
      };
    }

    const last = hist[hist.length - 1].column;
    
    const transitions = {
      'alpha->alpha': 0,
      'alpha->omega': 0,
      'omega->alpha': 0,
      'omega->omega': 0
    };

    for (let i = 0; i < hist.length - 1; i++) {
      const from = hist[i].column;
      const to = hist[i + 1].column;
      transitions[`${from}->${to}` as keyof typeof transitions]++;
    }

    const fromAlpha = transitions['alpha->alpha'] + transitions['alpha->omega'];
    const fromOmega = transitions['omega->alpha'] + transitions['omega->omega'];

    let prediction: Column;
    let confidence: number;

    if (last === 'alpha') {
      const probOmega = fromAlpha > 0 ? transitions['alpha->omega'] / fromAlpha : 0.5;
      prediction = probOmega > 0.5 ? 'omega' : 'alpha';
      confidence = Math.abs(probOmega - 0.5) * 200;
    } else {
      const probAlpha = fromOmega > 0 ? transitions['omega->alpha'] / fromOmega : 0.5;
      prediction = probAlpha > 0.5 ? 'alpha' : 'omega';
      confidence = Math.abs(probAlpha - 0.5) * 200;
    }

    const correct = hist.slice(1).filter((e, i) => {
      const prev = hist[i].column;
      const expectedProb = prev === 'alpha' ?
        (fromAlpha > 0 ? transitions['alpha->omega'] / fromAlpha : 0.5) :
        (fromOmega > 0 ? transitions['omega->alpha'] / fromOmega : 0.5);
      const expected = expectedProb > 0.5 ? (prev === 'alpha' ? 'omega' : 'alpha') : prev;
      return e.column === expected;
    }).length;

    const accuracy = hist.length > 1 ? (correct / (hist.length - 1)) * 100 : 0;

    return {
      name: 'Markov Chain',
      prediction,
      confidence: Math.min(95, 50 + confidence / 2),
      accuracy,
      description: 'Цепи Маркова (переходы между состояниями)'
    };
  };

  const calculateEnsemble = (preds: AlgorithmPrediction[]) => {
    const votes = { alpha: 0, omega: 0 };
    let totalWeight = 0;

    preds.forEach(pred => {
      const weight = pred.accuracy || 50;
      votes[pred.prediction] += weight;
      totalWeight += weight;
    });

    const alphaScore = votes.alpha / totalWeight;
    const omegaScore = votes.omega / totalWeight;

    const column: Column = alphaScore > omegaScore ? 'alpha' : 'omega';
    const confidence = Math.max(alphaScore, omegaScore) * 100;

    return { column, confidence };
  };

  const startScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' }
      });
      
      setCaptureStream(stream);
      setIsCapturing(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenCapture();
      });

      toast({
        title: "Захват экрана запущен",
        description: "Теперь выберите область для распознавания",
      });

      setTimeout(() => {
        setIsSelectingArea(true);
      }, 500);
    } catch (error) {
      toast({
        title: "Ошибка захвата",
        description: "Не удалось начать захват экрана",
        variant: "destructive"
      });
    }
  };

  const stopScreenCapture = () => {
    if (captureStream) {
      captureStream.getTracks().forEach(track => track.stop());
      setCaptureStream(null);
    }
    setIsCapturing(false);
    setCaptureArea(null);
    setIsSelectingArea(false);
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelectingArea || !previewCanvasRef.current) return;
    
    const rect = previewCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setSelectionStart({ x, y });
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelectingArea || !selectionStart || !previewCanvasRef.current) return;
    
    const rect = previewCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const scaleX = videoRef.current!.videoWidth / rect.width;
    const scaleY = videoRef.current!.videoHeight / rect.height;
    
    const area: CaptureArea = {
      x: Math.min(selectionStart.x, x) * scaleX,
      y: Math.min(selectionStart.y, y) * scaleY,
      width: Math.abs(x - selectionStart.x) * scaleX,
      height: Math.abs(y - selectionStart.y) * scaleY
    };
    
    setCaptureArea(area);
    setIsSelectingArea(false);
    setSelectionStart(null);
    
    toast({
      title: "Область выбрана",
      description: "Теперь нажмите 'Начать' для запуска распознавания",
    });
  };

  const recognizeTextFromArea = async () => {
    if (!videoRef.current || !canvasRef.current || !captureArea) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx || video.videoWidth === 0) return null;

    canvas.width = captureArea.width;
    canvas.height = captureArea.height;

    ctx.drawImage(
      video,
      captureArea.x,
      captureArea.y,
      captureArea.width,
      captureArea.height,
      0,
      0,
      captureArea.width,
      captureArea.height
    );

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const detectedText = simpleOCR(imageData);
    
    const displayText = detectedText === 'alpha' ? 'АЛЬФА' : 
                        detectedText === 'omega' ? 'ОМЕГА' : 
                        'Не распознано';
    setLastRecognizedText(displayText);
    
    if (detectedText === 'alpha') {
      return 'alpha';
    } else if (detectedText === 'omega') {
      return 'omega';
    }
    
    return null;
  };

  const preprocessImage = (imageData: ImageData): ImageData => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      let gray = 0.299 * r + 0.587 * g + 0.114 * b;
      
      gray = Math.min(255, gray * 1.8);
      
      const threshold = 140;
      gray = gray > threshold ? 255 : 0;
      
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }

    return imageData;
  };

  const analyzeTextPattern = (imageData: ImageData): { alpha: number; omega: number } => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    let horizontalLines = 0;
    let verticalLines = 0;
    let diagonalPixels = 0;
    let whitePixels = 0;
    let blackPixels = 0;
    let edges = 0;

    for (let y = 0; y < height; y++) {
      let consecutiveWhite = 0;
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const brightness = data[idx];
        
        if (brightness > 200) {
          whitePixels++;
          consecutiveWhite++;
        } else {
          blackPixels++;
          if (consecutiveWhite > width * 0.2) {
            horizontalLines++;
          }
          consecutiveWhite = 0;
        }
      }
    }

    for (let x = 0; x < width; x++) {
      let consecutiveWhite = 0;
      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * 4;
        const brightness = data[idx];
        
        if (brightness > 200) {
          consecutiveWhite++;
        } else {
          if (consecutiveWhite > height * 0.2) {
            verticalLines++;
          }
          consecutiveWhite = 0;
        }
      }
    }

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const current = data[idx];
        
        const top = data[((y - 1) * width + x) * 4];
        const bottom = data[((y + 1) * width + x) * 4];
        const left = data[(y * width + (x - 1)) * 4];
        const right = data[(y * width + (x + 1)) * 4];
        
        if (Math.abs(current - top) > 200 || Math.abs(current - bottom) > 200 ||
            Math.abs(current - left) > 200 || Math.abs(current - right) > 200) {
          edges++;
        }
      }
    }

    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const diag = data[((y + 1) * width + (x + 1)) * 4];
        
        if (Math.abs(data[idx] - diag) > 200) {
          diagonalPixels++;
        }
      }
    }

    const totalPixels = width * height;
    const density = whitePixels / totalPixels;
    const edgeDensity = edges / totalPixels;

    let alphaScore = 0;
    let omegaScore = 0;

    if (horizontalLines >= 2 && verticalLines >= 2) {
      alphaScore += 35;
    }
    
    if (horizontalLines >= 1 && verticalLines >= 1) {
      alphaScore += 15;
    }

    if (diagonalPixels > totalPixels * 0.03) {
      alphaScore += 25;
    }

    if (edges > totalPixels * 0.08) {
      omegaScore += 40;
    }
    
    if (edges > totalPixels * 0.12) {
      omegaScore += 20;
    }

    if (density > 0.15 && density < 0.40) {
      alphaScore += 20;
    }
    
    if (density > 0.20 && density < 0.50) {
      omegaScore += 25;
    }

    const aspectRatio = width / height;
    if (aspectRatio > 1.0 && aspectRatio < 2.5) {
      alphaScore += 10;
    }
    if (aspectRatio > 1.3 && aspectRatio < 3.5) {
      omegaScore += 15;
    }

    if (edgeDensity > 0.08 && edgeDensity < 0.15) {
      alphaScore += 15;
    }
    if (edgeDensity > 0.12) {
      omegaScore += 20;
    }

    return { alpha: alphaScore, omega: omegaScore };
  };

  const simpleOCR = (imageData: ImageData): string => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return 'unknown';
    
    tempCtx.putImageData(imageData, 0, 0);
    const newImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    
    const processedData = preprocessImage(newImageData);
    const scores = analyzeTextPattern(processedData);
    
    const threshold = 35;
    const confidence = Math.abs(scores.alpha - scores.omega);
    
    if (scores.alpha > threshold && scores.alpha > scores.omega && confidence > 15) {
      return 'alpha';
    } else if (scores.omega > threshold && scores.omega > scores.alpha && confidence > 15) {
      return 'omega';
    } else if (confidence < 15 && (scores.alpha > 30 || scores.omega > 30)) {
      return scores.alpha > scores.omega ? 'alpha' : 'omega';
    }
    
    return 'unknown';
  };

  useEffect(() => {
    if (!isCapturing || !isRunning || isPaused || !captureArea) return;

    const interval = setInterval(async () => {
      const detectedColumn = await recognizeTextFromArea();
      
      if (detectedColumn) {
        if (previousPrediction) {
          const isCorrect = previousPrediction === detectedColumn;
          setLastPredictionResult(isCorrect ? 'correct' : 'incorrect');
          setTimeout(() => setLastPredictionResult(null), 5000);
        }

        const newEvent: HistoryEvent = {
          id: Date.now(),
          column: detectedColumn,
          timestamp: new Date(),
          source: 'screen'
        };
        
        setHistory(prev => [...prev, newEvent]);
        setCurrentSuccess(detectedColumn);
        
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWS56+OZRQ0PVKjk7ahiHAU7k9rxzH0vBSl+zPDef0IKFmG47OWkUhEMTKXh8bllHgU');
        audio.volume = 0.3;
        audio.play().catch(() => {});
        
        setTimeout(() => setCurrentSuccess(null), 2000);
        setTimeLeft(30);

        toast({
          title: `Распознано!`,
          description: `Обнаружена колонка: ${detectedColumn === 'alpha' ? 'АЛЬФА' : 'ОМЕГА'}`,
        });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isCapturing, isRunning, isPaused, captureArea, previousPrediction]);

  useEffect(() => {
    if (isPaused || !isRunning) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isCapturing, isPaused, isRunning, previousPrediction]);

  useEffect(() => {
    if (!isCapturing || !videoRef.current || !previewCanvasRef.current) return;

    const updatePreview = () => {
      const video = videoRef.current;
      const canvas = previewCanvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 640;
      canvas.height = 360;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (captureArea) {
        const scaleX = canvas.width / video.videoWidth;
        const scaleY = canvas.height / video.videoHeight;

        ctx.strokeStyle = '#0EA5E9';
        ctx.lineWidth = 3;
        ctx.strokeRect(
          captureArea.x * scaleX,
          captureArea.y * scaleY,
          captureArea.width * scaleX,
          captureArea.height * scaleY
        );
      }

      requestAnimationFrame(updatePreview);
    };

    updatePreview();
  }, [isCapturing, captureArea]);

  useEffect(() => {
    if (history.length > 0) {
      const pattern = analyzePattern(history);
      const frequency = analyzeFrequency(history);
      const markov = analyzeMarkov(history);
      
      const newPredictions = [pattern, frequency, markov];
      setPredictions(newPredictions);
      
      const ensemble = calculateEnsemble(newPredictions);
      setEnsemblePrediction(ensemble);
      setPreviousPrediction(ensemble.column);

      setAccuracyHistory(prev => [...prev, {
        timestamp: Date.now(),
        pattern: pattern.accuracy,
        frequency: frequency.accuracy,
        markov: markov.accuracy
      }].slice(-20));
    }
  }, [history]);

  const handleStart = () => {
    if (!isCapturing) {
      toast({
        title: "Сначала запустите захват экрана",
        description: "Нажмите кнопку 'Начать захват экрана'",
        variant: "destructive"
      });
      return;
    }

    if (!captureArea) {
      toast({
        title: "Сначала выберите область",
        description: "Нарисуйте прямоугольник на превью экрана",
        variant: "destructive"
      });
      return;
    }
    
    setIsRunning(true);
    setIsPaused(false);
    setTimeLeft(30);
    
    toast({
      title: "Система запущена",
      description: "Начинается распознавание текста каждые 30 секунд",
    });
  };

  const handleStop = () => {
    setIsRunning(false);
    setIsPaused(false);
    
    toast({
      title: "Система остановлена",
      description: "Распознавание приостановлено",
    });
  };

  const handleReset = () => {
    setHistory([]);
    setCurrentSuccess(null);
    setTimeLeft(30);
    setPredictions([]);
    setEnsemblePrediction(null);
    setPreviousPrediction(null);
    setLastPredictionResult(null);
    setAccuracyHistory([]);
    setIsPaused(false);
    setIsRunning(false);
    setLastRecognizedText('');
    
    toast({
      title: "Система сброшена",
      description: "Все данные очищены, начните заново",
    });
  };

  const handlePauseResume = () => {
    if (!isCapturing) {
      toast({
        title: "Сначала запустите захват экрана",
        description: "Нажмите кнопку 'Начать захват экрана'",
        variant: "destructive"
      });
      return;
    }
    
    if (!isRunning) {
      toast({
        title: "Сначала запустите систему",
        description: "Нажмите кнопку 'Начать'",
        variant: "destructive"
      });
      return;
    }
    
    setIsPaused(prev => !prev);
    
    toast({
      title: isPaused ? "Возобновлено" : "Пауза",
      description: isPaused ? "Таймер снова работает" : "Таймер остановлен",
    });
  };

  const exportToCSV = () => {
    const csv = [
      ['№', 'Колонка', 'Время', 'Источник'].join(','),
      ...history.map((e, i) => [
        i + 1,
        e.column === 'alpha' ? 'Альфа' : 'Омега',
        e.timestamp.toLocaleString('ru-RU'),
        e.source === 'screen' ? 'Захват экрана' : 'Ручной'
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `success_history_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast({
      title: "Экспорт завершен",
      description: `Сохранено ${history.length} событий в CSV`,
    });
  };

  const stats = {
    alpha: history.filter(e => e.column === 'alpha').length,
    omega: history.filter(e => e.column === 'omega').length,
    total: history.length
  };

  const getStreaks = () => {
    if (history.length === 0) return { current: 0, max: 0, column: 'alpha' as Column };
    
    let maxStreak = 1;
    let currentStreak = 1;
    const currentColumn = history[history.length - 1].column;
    let maxColumn = currentColumn;

    for (let i = history.length - 2; i >= 0; i--) {
      if (history[i].column === history[i + 1].column) {
        if (i === history.length - 2) currentStreak++;
        
        let streak = 1;
        let j = i;
        while (j > 0 && history[j].column === history[j - 1].column) {
          streak++;
          j--;
        }
        
        if (streak > maxStreak) {
          maxStreak = streak;
          maxColumn = history[i].column;
        }
      }
    }

    return { current: currentStreak, max: maxStreak, column: maxColumn };
  };

  const streaks = getStreaks();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A1F2C] via-[#221F26] to-[#1A1F2C] text-white p-6">
      <video ref={videoRef} className="hidden" />
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#0EA5E9] via-[#8B5CF6] to-[#D946EF] bg-clip-text text-transparent">
            SUCCESS Predictor
          </h1>
          <p className="text-gray-400">Система аналитического прогнозирования с распознаванием текста</p>
        </div>

        <div className="flex gap-3 justify-center flex-wrap">
          <Button
            onClick={isCapturing ? stopScreenCapture : startScreenCapture}
            className={`${
              isCapturing 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-gradient-to-r from-[#8B5CF6] to-[#0EA5E9] hover:opacity-90'
            } text-lg px-8 py-6`}
          >
            <Icon name={isCapturing ? "StopCircle" : "Monitor"} size={24} className="mr-2" />
            {isCapturing ? 'Остановить захват' : 'Начать захват экрана'}
          </Button>

          {isCapturing && (
            <>
              {!isRunning ? (
                <Button
                  onClick={handleStart}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-90 text-white text-lg px-8 py-6"
                  disabled={!captureArea}
                >
                  <Icon name="Play" size={24} className="mr-2" />
                  Начать
                </Button>
              ) : (
                <Button
                  onClick={handleStop}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:opacity-90 text-white text-lg px-8 py-6"
                >
                  <Icon name="Square" size={24} className="mr-2" />
                  Стоп
                </Button>
              )}

              <Button
                onClick={handlePauseResume}
                variant="outline"
                className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!isRunning}
              >
                <Icon name={isPaused ? "Play" : "Pause"} size={20} className="mr-2" />
                {isPaused ? 'Возобновить' : 'Пауза'}
              </Button>

              <Button
                onClick={handleReset}
                variant="outline"
                className="border-red-500 text-red-400 hover:bg-red-500/10"
              >
                <Icon name="RotateCcw" size={20} className="mr-2" />
                Сброс
              </Button>

              {history.length > 0 && (
                <Button
                  onClick={exportToCSV}
                  variant="outline"
                  className="border-[#8B5CF6] text-[#8B5CF6] hover:bg-[#8B5CF6]/10"
                >
                  <Icon name="Download" size={20} className="mr-2" />
                  Экспорт в CSV
                </Button>
              )}
            </>
          )}
        </div>

        {!isCapturing && (
          <Card className="bg-blue-500/10 border-blue-500/30 p-4">
            <div className="flex items-center gap-3">
              <Icon name="Info" size={20} className="text-blue-400" />
              <span className="text-blue-400 font-semibold">Шаг 1: Нажмите "Начать захват экрана" для активации системы распознавания</span>
            </div>
          </Card>
        )}

        {isCapturing && !captureArea && (
          <Card className="bg-yellow-500/10 border-yellow-500/30 p-4">
            <div className="flex items-center gap-3">
              <Icon name="MousePointer2" size={20} className="text-yellow-400" />
              <span className="text-yellow-400 font-semibold">Шаг 2: Выберите область на превью ниже - нарисуйте прямоугольник вокруг текста "Альфа" или "Омега"</span>
            </div>
          </Card>
        )}

        {isCapturing && captureArea && !isRunning && (
          <Card className="bg-green-500/10 border-green-500/30 p-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-400 font-semibold">Область выбрана! Шаг 3: Нажмите "Начать" для запуска распознавания каждые 30 секунд</span>
            </div>
          </Card>
        )}

        {isCapturing && isRunning && !isPaused && (
          <Card className="bg-green-500/10 border-green-500/30 p-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-400 font-semibold">Система работает - распознавание текста активно (каждые 30 секунд)</span>
            </div>
          </Card>
        )}

        {isPaused && (
          <Card className="bg-yellow-500/10 border-yellow-500/30 p-4">
            <div className="flex items-center gap-3">
              <Icon name="Pause" size={20} className="text-yellow-400" />
              <span className="text-yellow-400 font-semibold">Система на паузе - таймер остановлен</span>
            </div>
          </Card>
        )}

        {isCapturing && captureArea && !isRunning && history.length > 0 && (
          <Card className="bg-orange-500/10 border-orange-500/30 p-4">
            <div className="flex items-center gap-3">
              <Icon name="AlertCircle" size={20} className="text-orange-400" />
              <span className="text-orange-400 font-semibold">Система остановлена - нажмите "Начать" для продолжения</span>
            </div>
          </Card>
        )}

        {isCapturing && (
          <Card className="bg-white/5 border-white/10 p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Icon name="Video" size={20} className="text-[#8B5CF6]" />
                  Превью захвата экрана
                </h3>
                {lastRecognizedText && (
                  <Badge className="bg-[#0EA5E9]">
                    Распознано: {lastRecognizedText}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-400">
                {isSelectingArea 
                  ? 'Нарисуйте прямоугольник вокруг области с текстом "Альфа" или "Омега"'
                  : captureArea 
                    ? 'Область выбрана (синий прямоугольник). Можно перевыбрать, остановив и снова запустив захват.'
                    : 'Ожидание выбора области...'
                }
              </p>
              <canvas
                ref={previewCanvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
                className={`w-full border-2 ${
                  isSelectingArea ? 'border-yellow-500 cursor-crosshair' : 'border-white/20'
                } rounded-lg`}
                width={640}
                height={360}
              />
            </div>
          </Card>
        )}

        {lastPredictionResult && (
          <Card className={`${
            lastPredictionResult === 'correct' 
              ? 'bg-green-500/10 border-green-500/30' 
              : 'bg-red-500/10 border-red-500/30'
          } p-6 animate-scale-in`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Icon 
                  name={lastPredictionResult === 'correct' ? "CheckCircle2" : "XCircle"} 
                  size={32} 
                  className={lastPredictionResult === 'correct' ? 'text-green-400' : 'text-red-400'}
                />
                <div>
                  <h3 className={`text-2xl font-bold ${
                    lastPredictionResult === 'correct' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {lastPredictionResult === 'correct' ? 'Прогноз совпал!' : 'Прогноз не совпал'}
                  </h3>
                  <p className="text-gray-400 mt-1">
                    Предсказанная колонка: <Badge className={`${
                      previousPrediction === 'alpha' ? 'bg-[#0EA5E9]' : 'bg-[#8B5CF6]'
                    } text-white border-none ml-2`}>
                      {previousPrediction === 'alpha' ? 'АЛЬФА' : 'ОМЕГА'}
                    </Badge>
                  </p>
                  <p className="text-gray-400 mt-1">
                    Фактический результат: <Badge className={`${
                      history[history.length - 1]?.column === 'alpha' ? 'bg-[#0EA5E9]' : 'bg-[#8B5CF6]'
                    } text-white border-none ml-2`}>
                      {history[history.length - 1]?.column === 'alpha' ? 'АЛЬФА' : 'ОМЕГА'}
                    </Badge>
                  </p>
                </div>
              </div>
              
              {lastPredictionResult === 'correct' && (
                <div className="text-6xl">🎯</div>
              )}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-[#0EA5E9]/10 border-[#0EA5E9]/30 p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0EA5E9]/20 to-transparent"></div>
            <div className="relative z-10 text-center space-y-4">
              <div className="flex items-center justify-center gap-3">
                <Icon name="Waves" size={32} className="text-[#0EA5E9]" />
                <h2 className="text-3xl font-bold text-[#0EA5E9]">АЛЬФА</h2>
              </div>
              
              {currentSuccess === 'alpha' && (
                <div className="animate-scale-in">
                  <Badge className="text-2xl py-3 px-6 bg-[#0EA5E9] text-white border-none animate-pulse">
                    SUCCESS
                  </Badge>
                </div>
              )}
              
              <div className="text-5xl font-bold text-[#0EA5E9]/80 mt-8">
                {stats.alpha}
              </div>
              <p className="text-gray-400">появлений</p>
            </div>
          </Card>

          <Card className="bg-[#8B5CF6]/10 border-[#8B5CF6]/30 p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#8B5CF6]/20 to-transparent"></div>
            <div className="relative z-10 text-center space-y-4">
              <div className="flex items-center justify-center gap-3">
                <Icon name="Sparkles" size={32} className="text-[#8B5CF6]" />
                <h2 className="text-3xl font-bold text-[#8B5CF6]">ОМЕГА</h2>
              </div>
              
              {currentSuccess === 'omega' && (
                <div className="animate-scale-in">
                  <Badge className="text-2xl py-3 px-6 bg-[#8B5CF6] text-white border-none animate-pulse">
                    SUCCESS
                  </Badge>
                </div>
              )}
              
              <div className="text-5xl font-bold text-[#8B5CF6]/80 mt-8">
                {stats.omega}
              </div>
              <p className="text-gray-400">появлений</p>
            </div>
          </Card>
        </div>

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

        {ensemblePrediction && (
          <Card className="bg-gradient-to-br from-[#8B5CF6]/20 to-[#0EA5E9]/20 border-[#8B5CF6]/30 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Icon name="TrendingUp" size={24} className="text-[#8B5CF6]" />
              <h3 className="text-2xl font-bold">Ансамбльный прогноз</h3>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 mb-2">Рекомендуемая ставка:</p>
                <div className="flex items-center gap-3">
                  <Badge 
                    className={`text-xl py-2 px-4 ${
                      ensemblePrediction.column === 'alpha' 
                        ? 'bg-[#0EA5E9]' 
                        : 'bg-[#8B5CF6]'
                    } text-white border-none`}
                  >
                    {ensemblePrediction.column === 'alpha' ? 'АЛЬФА' : 'ОМЕГА'}
                  </Badge>
                  <Icon 
                    name={ensemblePrediction.column === 'alpha' ? 'Waves' : 'Sparkles'} 
                    size={28}
                    className={ensemblePrediction.column === 'alpha' ? 'text-[#0EA5E9]' : 'text-[#8B5CF6]'}
                  />
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-gray-400 mb-2">Уверенность:</p>
                <div className="text-4xl font-bold text-[#8B5CF6]">
                  {ensemblePrediction.confidence.toFixed(1)}%
                </div>
              </div>
            </div>
          </Card>
        )}

        {accuracyHistory.length > 5 && (
          <Card className="bg-white/5 border-white/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Icon name="LineChart" size={24} className="text-[#D946EF]" />
              <h3 className="text-xl font-bold">Тренд точности алгоритмов</h3>
            </div>
            
            <div className="h-48 flex items-end gap-1">
              {accuracyHistory.map((point, idx) => (
                <div key={idx} className="flex-1 flex flex-col gap-1 items-center">
                  <div className="w-full flex flex-col gap-1">
                    <div 
                      className="w-full bg-[#0EA5E9]/50 rounded-t transition-all"
                      style={{ height: `${(point.pattern / 100) * 140}px` }}
                      title={`Pattern: ${point.pattern.toFixed(1)}%`}
                    />
                    <div 
                      className="w-full bg-[#8B5CF6]/50 rounded-t transition-all"
                      style={{ height: `${(point.frequency / 100) * 140}px` }}
                      title={`Frequency: ${point.frequency.toFixed(1)}%`}
                    />
                    <div 
                      className="w-full bg-[#D946EF]/50 rounded-t transition-all"
                      style={{ height: `${(point.markov / 100) * 140}px` }}
                      title={`Markov: ${point.markov.toFixed(1)}%`}
                    />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex gap-4 justify-center mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#0EA5E9]/50 rounded" />
                <span className="text-gray-400">Pattern</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#8B5CF6]/50 rounded" />
                <span className="text-gray-400">Frequency</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#D946EF]/50 rounded" />
                <span className="text-gray-400">Markov</span>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {predictions.map((pred, idx) => (
            <Card key={idx} className="bg-white/5 border-white/10 p-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-300">{pred.name}</h4>
                  <Icon name="Brain" size={18} className="text-[#8B5CF6]" />
                </div>
                
                <p className="text-xs text-gray-500">{pred.description}</p>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Прогноз:</span>
                    <Badge 
                      variant="outline" 
                      className={`${
                        pred.prediction === 'alpha' 
                          ? 'border-[#0EA5E9] text-[#0EA5E9]' 
                          : 'border-[#8B5CF6] text-[#8B5CF6]'
                      }`}
                    >
                      {pred.prediction === 'alpha' ? 'Альфа' : 'Омега'}
                    </Badge>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Точность:</span>
                      <span className="text-gray-300">{pred.accuracy.toFixed(1)}%</span>
                    </div>
                    <Progress value={pred.accuracy} className="h-1.5" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Уверенность:</span>
                      <span className="text-gray-300">{pred.confidence.toFixed(1)}%</span>
                    </div>
                    <Progress value={pred.confidence} className="h-1.5" />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                <span className="font-bold text-[#0EA5E9]">
                  {stats.alpha} ({stats.total > 0 ? ((stats.alpha / stats.total) * 100).toFixed(1) : 0}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B5CF6]">Омега:</span>
                <span className="font-bold text-[#8B5CF6]">
                  {stats.omega} ({stats.total > 0 ? ((stats.omega / stats.total) * 100).toFixed(1) : 0}%)
                </span>
              </div>
            </div>
          </Card>

          <Card className="bg-white/5 border-white/10 p-5">
            <div className="flex items-center gap-3 mb-3">
              <Icon name="Flame" size={20} className="text-orange-500" />
              <h4 className="font-semibold">Серии</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Текущая серия:</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{streaks.current}</span>
                  <Badge 
                    variant="outline" 
                    className={`${
                      history[history.length - 1]?.column === 'alpha'
                        ? 'border-[#0EA5E9] text-[#0EA5E9]' 
                        : 'border-[#8B5CF6] text-[#8B5CF6]'
                    }`}
                  >
                    {history[history.length - 1]?.column === 'alpha' ? 'α' : 'ω'}
                  </Badge>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Максимальная:</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{streaks.max}</span>
                  <Badge 
                    variant="outline" 
                    className={`${
                      streaks.column === 'alpha'
                        ? 'border-[#0EA5E9] text-[#0EA5E9]' 
                        : 'border-[#8B5CF6] text-[#8B5CF6]'
                    }`}
                  >
                    {streaks.column === 'alpha' ? 'α' : 'ω'}
                  </Badge>
                </div>
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
                <Badge 
                  key={event.id}
                  variant="outline"
                  className={`${
                    event.column === 'alpha'
                      ? 'border-[#0EA5E9] text-[#0EA5E9] bg-[#0EA5E9]/10' 
                      : 'border-[#8B5CF6] text-[#8B5CF6] bg-[#8B5CF6]/10'
                  } text-xs`}
                  title={event.source === 'screen' ? 'Захват экрана' : 'Ручной'}
                >
                  {event.column === 'alpha' ? 'α' : 'ω'}
                  {event.source === 'screen' && '📹'}
                </Badge>
              ))}
            </div>
          </Card>
        </div>

        <Card className="bg-white/5 border-white/10 p-5">
          <div className="flex items-center gap-3 mb-4">
            <Icon name="History" size={20} className="text-gray-400" />
            <h3 className="text-xl font-bold">История событий</h3>
          </div>
          
          <div className="max-h-64 overflow-y-auto space-y-2">
            {history.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Ожидание первого события...</p>
            ) : (
              history.slice().reverse().map((event, idx) => (
                <div 
                  key={event.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-sm w-8">#{history.length - idx}</span>
                    <Badge 
                      className={`${
                        event.column === 'alpha' 
                          ? 'bg-[#0EA5E9]' 
                          : 'bg-[#8B5CF6]'
                      } text-white border-none`}
                    >
                      {event.column === 'alpha' ? 'АЛЬФА' : 'ОМЕГА'}
                    </Badge>
                    {event.source === 'screen' && (
                      <Badge variant="outline" className="text-xs border-green-500 text-green-400">
                        Распознано
                      </Badge>
                    )}
                  </div>
                  <span className="text-gray-400 text-sm">
                    {event.timestamp.toLocaleTimeString('ru-RU')}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Index;