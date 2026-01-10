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

interface PredictionHistory {
  id: number;
  timestamp: Date;
  prediction: Column;
  actual: Column;
  isCorrect: boolean;
  confidence: number;
}

interface MethodPredictionHistory {
  id: number;
  timestamp: Date;
  methodName: string;
  prediction: Column;
  actual: Column;
  isCorrect: boolean;
  confidence: number;
}

interface MethodStats {
  name: string;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  avgConfidence: number;
}

const Index = () => {
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [recognizedHistory, setRecognizedHistory] = useState<Column[]>([]);
  const [currentSuccess, setCurrentSuccess] = useState<Column | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [predictions, setPredictions] = useState<AlgorithmPrediction[]>([]);
  const [ensemblePrediction, setEnsemblePrediction] = useState<{ column: Column; confidence: number } | null>(null);
  const [previousPrediction, setPreviousPrediction] = useState<Column | null>(null);
  const [lastPredictionResult, setLastPredictionResult] = useState<'correct' | 'incorrect' | null>(null);
  const [accuracyHistory, setAccuracyHistory] = useState<AccuracyPoint[]>([]);
  const [predictionHistory, setPredictionHistory] = useState<PredictionHistory[]>([]);
  const [methodHistory, setMethodHistory] = useState<MethodPredictionHistory[]>([]);
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

  const analyzeSequencePattern = (recHist: Column[]): AlgorithmPrediction => {
    if (recHist.length < 5) {
      return {
        name: 'Анализ последовательностей',
        prediction: 'alpha',
        confidence: 50,
        accuracy: 0,
        description: 'Поиск похожих последовательностей из 5 событий в истории'
      };
    }

    // Берем последние 5 событий как текущую последовательность
    const last5 = recHist.slice(-5);
    const currentPattern = last5.join('-');
    
    // Ищем все похожие последовательности в истории (до текущей)
    const matches: Column[] = [];
    
    for (let i = 0; i <= recHist.length - 6; i++) {
      const historicalPattern = recHist.slice(i, i + 5).join('-');
      
      // Если нашли такую же последовательность в прошлом
      if (historicalPattern === currentPattern) {
        // Смотрим, что было после неё
        const nextEvent = recHist[i + 5];
        if (nextEvent) {
          matches.push(nextEvent);
        }
      }
    }

    // Подсчитываем, что чаще было после такой последовательности
    const alphaCount = matches.filter(c => c === 'alpha').length;
    const omegaCount = matches.filter(c => c === 'omega').length;
    
    let prediction: Column;
    let confidence: number;
    
    if (matches.length === 0) {
      // Такой последовательности еще не было - предсказываем с минимальной уверенностью
      prediction = 'alpha';
      confidence = 50;
    } else {
      // Предсказываем то, что чаще было после такой последовательности
      prediction = alphaCount >= omegaCount ? 'alpha' : 'omega';
      const dominantCount = Math.max(alphaCount, omegaCount);
      confidence = Math.min(95, 50 + (dominantCount / matches.length) * 45);
    }
    
    // Рассчитываем точность метода на всей истории
    let correctPredictions = 0;
    let totalPredictions = 0;
    
    for (let i = 5; i < recHist.length; i++) {
      const testPattern = recHist.slice(i - 5, i).join('-');
      const actualNext = recHist[i];
      
      // Ищем что было после такой последовательности раньше
      const historicalMatches: Column[] = [];
      for (let j = 0; j < i - 5; j++) {
        if (recHist.slice(j, j + 5).join('-') === testPattern) {
          historicalMatches.push(recHist[j + 5]);
        }
      }
      
      if (historicalMatches.length > 0) {
        const alphaC = historicalMatches.filter(c => c === 'alpha').length;
        const omegaC = historicalMatches.filter(c => c === 'omega').length;
        const predictedNext: Column = alphaC >= omegaC ? 'alpha' : 'omega';
        
        if (predictedNext === actualNext) {
          correctPredictions++;
        }
        totalPredictions++;
      }
    }
    
    const accuracy = totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0;

    return {
      name: 'Анализ последовательностей',
      prediction,
      confidence,
      accuracy,
      description: `Найдено совпадений: ${matches.length} (А:${alphaCount}, О:${omegaCount})`
    };
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
    setCurrentMousePos({ x, y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelectingArea || !selectionStart || !previewCanvasRef.current) return;
    
    const rect = previewCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCurrentMousePos({ x, y });
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
    setCurrentMousePos(null);
    
    toast({
      title: "Область выбрана",
      description: "Теперь нажмите 'Начать' для запуска распознавания",
    });
  };

  const handleReselectArea = () => {
    setCaptureArea(null);
    setIsSelectingArea(true);
    setSelectionStart(null);
    setCurrentMousePos(null);
    
    toast({
      title: "Выберите область заново",
      description: "Нарисуйте прямоугольник на превью",
    });
  };

  const recognizeColorFromArea = async () => {
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
    const detectedColor = analyzeColorPattern(imageData);
    
    const displayText = detectedColor === 'alpha' ? 'АЛЬФА (голубой)' : 
                        detectedColor === 'omega' ? 'ОМЕГА (фиолетовый)' : 
                        'Не распознано';
    setLastRecognizedText(displayText);
    
    if (detectedColor === 'alpha') {
      return 'alpha';
    } else if (detectedColor === 'omega') {
      return 'omega';
    }
    
    return null;
  };

  const analyzeColorPattern = (imageData: ImageData): string => {
    const data = imageData.data;
    const totalPixels = data.length / 4;

    let blueScore = 0;
    let purpleScore = 0;
    let cyanoCount = 0;
    let purpleCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const brightness = (r + g + b) / 3;
      if (brightness < 30) continue;

      const isBlue = b > 150 && b > r * 1.3 && b > g * 1.1 && g > r * 0.8;
      const isCyan = b > 120 && g > 100 && b > r * 1.5 && Math.abs(b - g) < 80;
      
      const isPurple = b > 100 && r > 80 && b > g * 1.2 && r > g * 0.9 && Math.abs(r - b) < 100;
      const isMagenta = r > 100 && b > 100 && b > g * 1.3 && r > g * 1.2;

      if (isBlue || isCyan) {
        cyanoCount++;
        blueScore += (b - r) + (b - g);
      }

      if (isPurple || isMagenta) {
        purpleCount++;
        purpleScore += (r + b - g * 2) + Math.abs(r - b);
      }
    }

    const cyanRatio = cyanoCount / totalPixels;
    const purpleRatio = purpleCount / totalPixels;

    if (cyanRatio > 0.05) {
      blueScore += cyanRatio * 10000;
    }
    if (purpleRatio > 0.05) {
      purpleScore += purpleRatio * 10000;
    }

    const minThreshold = 500;
    const confidence = Math.abs(blueScore - purpleScore);

    if (blueScore > minThreshold && blueScore > purpleScore && confidence > 300) {
      return 'alpha';
    } else if (purpleScore > minThreshold && purpleScore > blueScore && confidence > 300) {
      return 'omega';
    } else if (blueScore > purpleScore && blueScore > minThreshold * 0.5) {
      return 'alpha';
    } else if (purpleScore > blueScore && purpleScore > minThreshold * 0.5) {
      return 'omega';
    }

    return 'unknown';
  };

  useEffect(() => {
    if (!isCapturing || !isRunning || isPaused || !captureArea) return;

    let lastExecutionTime = Date.now();
    let intervalId: number;
    let isExecuting = false;

    const performRecognition = async () => {
      // Защита от задвоения
      if (isExecuting) return;
      isExecuting = true;

      const detectedColumn = await recognizeColorFromArea();
      
      if (detectedColumn) {
        // Проверяем, не было ли только что такого же события
        const now = Date.now();
        const timeSinceLastRecognition = now - lastExecutionTime;
        if (timeSinceLastRecognition < 5000) {
          isExecuting = false;
          return;
        }

        if (previousPrediction && ensemblePrediction) {
          const isCorrect = previousPrediction === detectedColumn;
          setLastPredictionResult(isCorrect ? 'correct' : 'incorrect');
          setTimeout(() => setLastPredictionResult(null), 5000);
          
          const predictionRecord: PredictionHistory = {
            id: Date.now(),
            timestamp: new Date(),
            prediction: previousPrediction,
            actual: detectedColumn,
            isCorrect,
            confidence: ensemblePrediction.confidence
          };
          setPredictionHistory(prev => [...prev, predictionRecord]);
          
          predictions.forEach(pred => {
            const methodRecord: MethodPredictionHistory = {
              id: Date.now() + Math.random(),
              timestamp: new Date(),
              methodName: pred.name,
              prediction: pred.prediction,
              actual: detectedColumn,
              isCorrect: pred.prediction === detectedColumn,
              confidence: pred.confidence
            };
            setMethodHistory(prev => [...prev, methodRecord]);
          });
        }

        const newEvent: HistoryEvent = {
          id: Date.now(),
          column: detectedColumn,
          timestamp: new Date(),
          source: 'screen'
        };
        
        setHistory(prev => [...prev, newEvent]);
        setRecognizedHistory(prev => [...prev, detectedColumn]);
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

        lastExecutionTime = now;
      }
      
      isExecuting = false;
    };

    // Запускаем распознавание сразу при старте
    performRecognition();

    // Точный интервал с проверкой времени
    const checkAndExecute = () => {
      const now = Date.now();
      const timeSinceLastExecution = now - lastExecutionTime;
      
      // Если прошло 30 секунд (с погрешностью 500мс)
      if (timeSinceLastExecution >= 29500) {
        performRecognition();
      }
    };

    // Проверяем каждую секунду
    intervalId = window.setInterval(checkAndExecute, 1000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
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

    let animationId: number;
    
    const updatePreview = () => {
      const video = videoRef.current;
      const canvas = previewCanvasRef.current;
      if (!video || !canvas) {
        animationId = requestAnimationFrame(updatePreview);
        return;
      }

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        animationId = requestAnimationFrame(updatePreview);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationId = requestAnimationFrame(updatePreview);
        return;
      }

      canvas.width = 640;
      canvas.height = 360;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Отрисовка выбранной области
      if (captureArea) {
        const scaleX = canvas.width / video.videoWidth;
        const scaleY = canvas.height / video.videoHeight;

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          captureArea.x * scaleX,
          captureArea.y * scaleY,
          captureArea.width * scaleX,
          captureArea.height * scaleY
        );
      }

      // Отрисовка процесса выделения
      if (isSelectingArea && selectionStart && currentMousePos) {
        // Преобразуем координаты мыши в координаты canvas
        const canvasRect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / canvasRect.width;
        const scaleY = canvas.height / canvasRect.height;
        
        const x = Math.min(selectionStart.x, currentMousePos.x) * scaleX;
        const y = Math.min(selectionStart.y, currentMousePos.y) * scaleY;
        const width = Math.abs(currentMousePos.x - selectionStart.x) * scaleX;
        const height = Math.abs(currentMousePos.y - selectionStart.y) * scaleY;

        // Полупрозрачная заливка
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(x, y, width, height);

        // Тонкая черная рамка
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);
      }

      animationId = requestAnimationFrame(updatePreview);
    };

    animationId = requestAnimationFrame(updatePreview);
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isCapturing, captureArea, isSelectingArea, selectionStart, currentMousePos]);

  useEffect(() => {
    if (recognizedHistory.length > 0) {
      const sequenceAnalysis = analyzeSequencePattern(recognizedHistory);
      
      setPredictions([sequenceAnalysis]);
      
      setEnsemblePrediction({
        column: sequenceAnalysis.prediction,
        confidence: sequenceAnalysis.confidence
      });
      setPreviousPrediction(sequenceAnalysis.prediction);

      setAccuracyHistory(prev => [...prev, {
        timestamp: Date.now(),
        pattern: sequenceAnalysis.accuracy,
        frequency: 0,
        markov: 0
      }].slice(-20));
    }
  }, [recognizedHistory]);

  const calculateMethodStats = (): MethodStats[] => {
    const methods = ['Анализ последовательностей'];
    
    return methods.map(methodName => {
      const methodRecords = methodHistory.filter(h => h.methodName === methodName);
      const totalPredictions = methodRecords.length;
      const correctPredictions = methodRecords.filter(h => h.isCorrect).length;
      const accuracy = totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0;
      const avgConfidence = totalPredictions > 0 
        ? methodRecords.reduce((sum, r) => sum + r.confidence, 0) / totalPredictions 
      : 0;
      
      return {
        name: methodName,
        totalPredictions,
        correctPredictions,
        accuracy,
        avgConfidence
      };
    }).sort((a, b) => b.accuracy - a.accuracy);
  };

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
      description: "Начинается распознавание цвета каждые 30 секунд",
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
    setRecognizedHistory([]);
    setCurrentSuccess(null);
    setTimeLeft(30);
    setPredictions([]);
    setEnsemblePrediction(null);
    setPreviousPrediction(null);
    setLastPredictionResult(null);
    setAccuracyHistory([]);
    setPredictionHistory([]);
    setMethodHistory([]);
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

  const getSequenceTrends = () => {
    if (history.length < 7) return [];
    
    const sequences = new Map<string, { count: number; nextAlpha: number; nextOmega: number }>();
    
    for (let i = 0; i < history.length - 6; i++) {
      const seq = [
        history[i].column === 'alpha' ? 'α' : 'ω',
        history[i + 1].column === 'alpha' ? 'α' : 'ω',
        history[i + 2].column === 'alpha' ? 'α' : 'ω',
        history[i + 3].column === 'alpha' ? 'α' : 'ω',
        history[i + 4].column === 'alpha' ? 'α' : 'ω',
        history[i + 5].column === 'alpha' ? 'α' : 'ω'
      ].join('-');
      
      const next = history[i + 6].column;
      
      if (!sequences.has(seq)) {
        sequences.set(seq, { count: 0, nextAlpha: 0, nextOmega: 0 });
      }
      
      const data = sequences.get(seq)!;
      data.count++;
      if (next === 'alpha') {
        data.nextAlpha++;
      } else {
        data.nextOmega++;
      }
    }
    
    return Array.from(sequences.entries())
      .filter(([_, data]) => data.count >= 2)
      .map(([seq, data]) => ({
        sequence: seq,
        count: data.count,
        nextAlpha: data.nextAlpha,
        nextOmega: data.nextOmega,
        prediction: data.nextAlpha > data.nextOmega ? 'alpha' : 'omega',
        confidence: Math.max(data.nextAlpha, data.nextOmega) / data.count * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const sequenceTrends = getSequenceTrends();

  const getTopSequences = () => {
    if (history.length < 7) return [];
    
    const sequences = new Map<string, { count: number; nextAlpha: number; nextOmega: number }>();
    
    for (let i = 0; i < history.length - 6; i++) {
      const seq = [
        history[i].column === 'alpha' ? 'α' : 'ω',
        history[i + 1].column === 'alpha' ? 'α' : 'ω',
        history[i + 2].column === 'alpha' ? 'α' : 'ω',
        history[i + 3].column === 'alpha' ? 'α' : 'ω',
        history[i + 4].column === 'alpha' ? 'α' : 'ω',
        history[i + 5].column === 'alpha' ? 'α' : 'ω'
      ].join('-');
      
      const next = history[i + 6].column;
      
      if (!sequences.has(seq)) {
        sequences.set(seq, { count: 0, nextAlpha: 0, nextOmega: 0 });
      }
      
      const data = sequences.get(seq)!;
      data.count++;
      if (next === 'alpha') {
        data.nextAlpha++;
      } else {
        data.nextOmega++;
      }
    }
    
    return Array.from(sequences.entries())
      .filter(([_, data]) => data.count >= 2)
      .map(([seq, data]) => {
        const alphaProb = (data.nextAlpha / data.count) * 100;
        const omegaProb = (data.nextOmega / data.count) * 100;
        const maxProb = Math.max(alphaProb, omegaProb);
        
        return {
          sequence: seq,
          count: data.count,
          nextAlpha: data.nextAlpha,
          nextOmega: data.nextOmega,
          prediction: alphaProb > omegaProb ? 'alpha' : 'omega',
          confidence: maxProb,
          alphaProb,
          omegaProb
        };
      })
      .filter(item => item.confidence >= 60)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const getPrediction = () => {
    if (history.length < 6) return null;
    
    const lastSix = history.slice(-6).map(e => e.column === 'alpha' ? 'α' : 'ω').join('-');
    const topSequences = getTopSequences();
    
    const match = topSequences.find(s => s.sequence === lastSix);
    
    if (!match) return null;
    
    return {
      sequence: match.sequence,
      prediction: match.prediction,
      confidence: match.confidence,
      alphaProb: match.alphaProb,
      omegaProb: match.omegaProb,
      occurrences: match.count,
      rank: topSequences.indexOf(match) + 1
    };
  };

  const topSequences = getTopSequences();
  const prediction = getPrediction();

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

        {topSequences.length > 0 && (
          <Card className="bg-white/5 border-white/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Icon name="Database" size={24} className="text-[#0EA5E9]" />
              <h3 className="text-xl font-bold">Топ-5 частых последовательностей</h3>
              <Badge className="bg-[#0EA5E9]/20 text-[#0EA5E9] border-none">
                Всего паттернов: {topSequences.length}
              </Badge>
            </div>
            
            <div className="space-y-3">
              {topSequences.map((seq, idx) => (
                <div 
                  key={idx}
                  className={`bg-white/5 rounded-lg p-4 border ${
                    prediction && seq.sequence === prediction.sequence
                      ? 'border-[#D946EF] bg-[#D946EF]/10'
                      : 'border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Badge className="bg-gradient-to-r from-[#0EA5E9] to-[#8B5CF6] text-white border-none text-lg px-3 py-1">
                        #{idx + 1}
                      </Badge>
                      
                      <div className="flex items-center gap-2">
                        {seq.sequence.split('-').map((symbol, i) => (
                          <Badge 
                            key={i}
                            className={`${
                              symbol === 'α' 
                                ? 'bg-[#0EA5E9] text-white' 
                                : 'bg-[#8B5CF6] text-white'
                            } border-none text-sm font-bold`}
                          >
                            {symbol}
                          </Badge>
                        ))}
                        <span className="text-gray-400">→</span>
                        <Badge 
                          className={`${
                            seq.prediction === 'alpha' 
                              ? 'bg-[#0EA5E9]/30 text-[#0EA5E9] border-[#0EA5E9]' 
                              : 'bg-[#8B5CF6]/30 text-[#8B5CF6] border-[#8B5CF6]'
                          } border text-sm font-bold`}
                        >
                          {seq.prediction === 'alpha' ? 'α' : 'ω'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-gray-400">
                          Встречалась: <span className="text-white font-semibold">{seq.count} раз</span>
                        </div>
                        <div className="text-gray-400">
                          Точность: <span className="text-white font-semibold">{seq.confidence.toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-[#0EA5E9]" />
                        <span className="text-gray-400">{seq.nextAlpha}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-[#8B5CF6]" />
                        <span className="text-gray-400">{seq.nextOmega}</span>
                      </div>
                    </div>
                  </div>
                  
                  {prediction && seq.sequence === prediction.sequence && (
                    <div className="mt-3 pt-3 border-t border-[#D946EF]/30">
                      <div className="flex items-center gap-2">
                        <Icon name="Sparkles" size={16} className="text-[#D946EF]" />
                        <span className="text-[#D946EF] font-semibold text-sm">
                          Такая последовательность уже была! Следующее событие: {seq.prediction === 'alpha' ? 'Альфа' : 'Омега'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

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
              <span className="text-yellow-400 font-semibold">Шаг 2: Выберите область на превью ниже - нарисуйте прямоугольник вокруг голубой или фиолетовой колонки</span>
            </div>
          </Card>
        )}

        {isCapturing && captureArea && !isRunning && (
          <Card className="bg-green-500/10 border-green-500/30 p-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-400 font-semibold">Область выбрана! Шаг 3: Нажмите "Начать" для запуска распознавания цвета каждые 30 секунд</span>
            </div>
          </Card>
        )}

        {isCapturing && isRunning && !isPaused && (
          <Card className="bg-green-500/10 border-green-500/30 p-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-400 font-semibold">Система работает - распознавание цвета активно (каждые 30 секунд)</span>
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
                  ? 'Нарисуйте прямоугольник вокруг голубой (Альфа) или фиолетовой (Омега) области'
                  : captureArea 
                    ? 'Область выбрана (синий прямоугольник). Система определяет доминирующий цвет: голубой = Альфа, фиолетовый = Омега.'
                    : 'Ожидание выбора области...'
                }
              </p>
              <div className="space-y-2">
                <canvas
                  ref={previewCanvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  className={`w-full border-2 ${
                    isSelectingArea ? 'border-yellow-500 cursor-crosshair' : 'border-white/20'
                  } rounded-lg`}
                  width={640}
                  height={360}
                />
                {captureArea && !isRunning && (
                  <Button
                    onClick={handleReselectArea}
                    variant="outline"
                    className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/10 w-full"
                  >
                    <Icon name="RefreshCw" size={16} className="mr-2" />
                    Изменить область захвата
                  </Button>
                )}
              </div>
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
              <h3 className="text-2xl font-bold">Прогноз на основе последовательностей</h3>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 mb-2">Следующее событие:</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

        {sequenceTrends.length > 0 && (
          <Card className="bg-white/5 border-white/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Icon name="TrendingUp" size={24} className="text-[#D946EF]" />
              <h3 className="text-xl font-bold">Тренды последовательностей</h3>
              <Badge className="bg-[#D946EF]/20 text-[#D946EF] border-none">
                Найдено паттернов: {sequenceTrends.length}
              </Badge>
            </div>
            
            <div className="space-y-3">
              {sequenceTrends.map((trend, idx) => (
                <div 
                  key={idx}
                  className="bg-white/5 rounded-lg p-4 border border-white/10"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {trend.sequence.split('-').map((symbol, i) => (
                          <Badge 
                            key={i}
                            className={`${
                              symbol === 'α' 
                                ? 'bg-[#0EA5E9] text-white' 
                                : 'bg-[#8B5CF6] text-white'
                            } border-none text-sm font-bold`}
                          >
                            {symbol}
                          </Badge>
                        ))}
                        <span className="text-gray-400">→</span>
                        <Badge 
                          className={`${
                            trend.prediction === 'alpha' 
                              ? 'bg-[#0EA5E9]/30 text-[#0EA5E9] border-[#0EA5E9]' 
                              : 'bg-[#8B5CF6]/30 text-[#8B5CF6] border-[#8B5CF6]'
                          } border text-sm font-bold`}
                        >
                          {trend.prediction === 'alpha' ? 'α' : 'ω'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-gray-400">
                          Встречалась: <span className="text-white font-semibold">{trend.count} раз</span>
                        </div>
                        <div className="text-gray-400">
                          Точность: <span className="text-white font-semibold">{trend.confidence.toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-[#0EA5E9]" />
                        <span className="text-gray-400">{trend.nextAlpha}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-[#8B5CF6]" />
                        <span className="text-gray-400">{trend.nextOmega}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Progress value={trend.confidence} className="h-1.5 mt-3" />
                </div>
              ))}
            </div>
          </Card>
        )}

        {history.length > 0 && (
          <Card className="bg-white/5 border-white/10 p-5">
            <div className="flex items-center gap-3 mb-4">
              <Icon name="History" size={20} className="text-[#8B5CF6]" />
              <h3 className="text-xl font-bold">История событий и прогнозов</h3>
              {predictionHistory.length > 0 && (
                <Badge className="bg-[#8B5CF6]/20 text-[#8B5CF6] border-none">
                  Точность: {((predictionHistory.filter(p => p.isCorrect).length / predictionHistory.length) * 100).toFixed(1)}%
                </Badge>
              )}
            </div>
            
            <div className="max-h-96 overflow-y-auto space-y-2">
              {history.slice().reverse().map((event, idx) => {
                const eventNumber = history.length - idx;
                const prediction = predictionHistory.find(p => 
                  Math.abs(p.timestamp.getTime() - event.timestamp.getTime()) < 2000
                );

                return (
                  <div 
                    key={event.id}
                    className={`p-3 rounded-lg border ${
                      prediction
                        ? prediction.isCorrect 
                          ? 'bg-green-500/10 border-green-500/30' 
                          : 'bg-red-500/10 border-red-500/30'
                        : 'bg-white/5 border-white/10'
                    } transition-colors`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 text-sm w-8">#{eventNumber}</span>
                        
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-gray-400">{prediction ? 'Факт:' : 'Событие:'}</div>
                          <Badge 
                            className={`${
                              event.column === 'alpha' 
                                ? 'bg-[#0EA5E9]' 
                                : 'bg-[#8B5CF6]'
                            } text-white border-none text-xs`}
                          >
                            {event.column === 'alpha' ? 'АЛЬФА' : 'ОМЕГА'}
                          </Badge>
                        </div>

                        {prediction && (
                          <>
                            <Icon 
                              name="ArrowRight" 
                              size={16} 
                              className="text-gray-500"
                            />

                            <div className="flex items-center gap-2">
                              <div className="text-xs text-gray-400">Прогноз:</div>
                              <Badge 
                                className={`${
                                  prediction.prediction === 'alpha' 
                                    ? 'bg-[#0EA5E9]' 
                                    : 'bg-[#8B5CF6]'
                                } text-white border-none text-xs`}
                              >
                                {prediction.prediction === 'alpha' ? 'АЛЬФА' : 'ОМЕГА'}
                              </Badge>
                            </div>

                            <Icon 
                              name={prediction.isCorrect ? "CheckCircle2" : "XCircle"} 
                              size={20} 
                              className={prediction.isCorrect ? 'text-green-400' : 'text-red-400'}
                            />
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {prediction && (
                          <div className="text-xs text-gray-400">
                            Уверенность: <span className="text-white font-semibold">{prediction.confidence.toFixed(1)}%</span>
                          </div>
                        )}
                        <Badge 
                          variant="outline"
                          className="text-xs border-gray-600 text-gray-400"
                        >
                          {event.source === 'screen' ? '📹 Авто' : '✋ Ручной'}
                        </Badge>
                        <span className="text-gray-400 text-sm">
                          {event.timestamp.toLocaleTimeString('ru-RU')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;