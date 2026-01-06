import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import { toast } from '@/hooks/use-toast';
import { ScreenCapture } from '@/components/ScreenCapture';
import { PredictionDisplay } from '@/components/PredictionDisplay';
import { HistoryPanel } from '@/components/HistoryPanel';
import {
  analyzePattern,
  analyzeFrequency,
  analyzeMarkov,
  analyzeDeepSequence,
  analyzeNGram,
  analyzeEntropy,
  analyzeStreak,
  calculateEnsemble
} from '@/utils/predictionAlgorithms';
import type {
  Column,
  HistoryEvent,
  AlgorithmPrediction,
  AccuracyPoint,
  CaptureArea,
  PredictionHistory,
  MethodPredictionHistory,
  MethodStats,
  AdaptiveWeights
} from '@/types/prediction';

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
  const [lastRecognizedText, setLastRecognizedText] = useState<string>('');
  const [captureLogs, setCaptureLogs] = useState<string[]>([]);
  const [adaptiveWeights, setAdaptiveWeights] = useState<AdaptiveWeights>({
    pattern: 1.0,
    frequency: 1.0,
    markov: 1.0,
    sequenceDepth: 1.0,
    nGram: 1.0,
    entropy: 1.0,
    streak: 1.0
  });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const updateAdaptiveWeights = () => {
    if (methodHistory.length < 5) return;

    const recentHistory = methodHistory.slice(-20);
    
    const methodAccuracies: Record<string, number> = {};
    const uniqueMethods = [...new Set(recentHistory.map(m => m.methodName))];
    
    uniqueMethods.forEach(method => {
      const methodPreds = recentHistory.filter(m => m.methodName === method);
      const correct = methodPreds.filter(m => m.isCorrect).length;
      methodAccuracies[method] = methodPreds.length > 0 ? correct / methodPreds.length : 0;
    });

    const total = Object.values(methodAccuracies).reduce((sum, acc) => sum + acc, 0);
    
    if (total > 0) {
      const newWeights: AdaptiveWeights = {
        pattern: (methodAccuracies['Pattern Recognition'] || 0) / total * 7,
        frequency: (methodAccuracies['Frequency Analysis'] || 0) / total * 7,
        markov: (methodAccuracies['Markov Chain'] || 0) / total * 7,
        sequenceDepth: (methodAccuracies['Deep Sequence'] || 0) / total * 7,
        nGram: (methodAccuracies['N-Gram Analysis'] || 0) / total * 7,
        entropy: (methodAccuracies['Entropy Prediction'] || 0) / total * 7,
        streak: (methodAccuracies['Streak Analysis'] || 0) / total * 7,
      };

      const maxWeight = Math.max(...Object.values(newWeights));
      if (maxWeight > 0) {
        Object.keys(newWeights).forEach(key => {
          newWeights[key as keyof AdaptiveWeights] = Math.max(
            0.3,
            Math.min(3.0, newWeights[key as keyof AdaptiveWeights])
          );
        });
      }

      setAdaptiveWeights(newWeights);
    }
  };

  useEffect(() => {
    if (recognizedHistory.length > 0) {
      updateAdaptiveWeights();

      const newPredictions: AlgorithmPrediction[] = [
        analyzePattern(recognizedHistory, adaptiveWeights, methodHistory),
        analyzeFrequency(recognizedHistory, adaptiveWeights, methodHistory),
        analyzeMarkov(recognizedHistory, adaptiveWeights, methodHistory),
        analyzeDeepSequence(recognizedHistory, adaptiveWeights, methodHistory),
        analyzeNGram(recognizedHistory, adaptiveWeights, methodHistory),
        analyzeEntropy(recognizedHistory, adaptiveWeights, methodHistory),
        analyzeStreak(recognizedHistory, adaptiveWeights, methodHistory),
      ];

      setPredictions(newPredictions);

      const ensemble = calculateEnsemble(newPredictions);
      setEnsemblePrediction(ensemble);
      setPreviousPrediction(ensemble.column);

      const newAccuracy: AccuracyPoint = {
        timestamp: Date.now(),
        pattern: newPredictions[0]?.accuracy || 0,
        frequency: newPredictions[1]?.accuracy || 0,
        markov: newPredictions[2]?.accuracy || 0,
        ensemble: predictionHistory.length > 0 
          ? (predictionHistory.filter(p => p.isCorrect).length / predictionHistory.length) * 100 
          : 0
      };

      setAccuracyHistory(prev => [...prev.slice(-19), newAccuracy]);
    }
  }, [recognizedHistory, methodHistory]);

  useEffect(() => {
    if (timeLeft > 0 && isRunning && !isPaused) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, isRunning, isPaused]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setCaptureLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const startScreenCapture = async () => {
    setCaptureLogs([]);
    addLog('🚀 Начинаем захват экрана...');
    
    try {
      addLog('✅ Проверка navigator.mediaDevices');
      if (!navigator.mediaDevices) {
        addLog('❌ navigator.mediaDevices недоступен');
        throw new Error('MediaDevices не поддерживается');
      }
      
      addLog('✅ Проверка getDisplayMedia');
      if (!navigator.mediaDevices.getDisplayMedia) {
        addLog('❌ getDisplayMedia не поддерживается');
        throw new Error('getDisplayMedia не поддерживается');
      }
      
      addLog('📡 Запрос разрешения на захват экрана...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true
      });
      addLog('✅ Разрешение получено, stream создан');

      setCaptureStream(stream);
      addLog('✅ Stream сохранён в state');
      
      // Сначала включаем isCapturing, чтобы видео появилось в DOM
      setIsCapturing(true);
      addLog('✅ isCapturing = true');

      // Ждём следующий кадр, чтобы React отрендерил видео
      await new Promise(resolve => setTimeout(resolve, 100));
      addLog('⏳ Ожидание рендеринга видео-элемента...');

      if (videoRef.current) {
        addLog('✅ videoRef существует');
        videoRef.current.srcObject = stream;
        addLog('✅ srcObject установлен');
        
        await videoRef.current.play();
        addLog('✅ video.play() выполнен');
        
        toast({
          title: "Захват экрана начат",
          description: "Теперь выберите область для распознавания",
        });
        addLog('🎉 Захват экрана успешно запущен!');
      } else {
        addLog('❌ videoRef.current === null даже после ожидания');
        addLog(`📊 isCapturing: ${isCapturing}, stream: ${!!stream}`);
      }

      stream.getVideoTracks()[0].onended = () => {
        addLog('⚠️ Пользователь остановил захват');
        stopScreenCapture();
      };

    } catch (error: any) {
      addLog(`❌ ОШИБКА: ${error.name || 'Unknown'}`);
      addLog(`📝 Сообщение: ${error.message || 'Нет описания'}`);
      addLog(`🔍 Тип: ${typeof error}`);
      addLog(`📦 JSON: ${JSON.stringify(error, null, 2)}`);
      
      console.error('Screen capture error:', error);
      toast({
        title: "Ошибка захвата экрана",
        description: `${error.name}: ${error.message}`,
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
    setIsRunning(false);
    setCaptureArea(null);
    
    toast({
      title: "Захват экрана остановлен",
      description: "Распознавание завершено",
    });
  };

  const recognizeColorFromArea = async (): Promise<Column | null> => {
    if (!videoRef.current || !canvasRef.current || !captureArea) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = ctx.getImageData(
      captureArea.x,
      captureArea.y,
      captureArea.width,
      captureArea.height
    );

    const data = imageData.data;
    let cyanScore = 0;
    let purpleScore = 0;
    let pixelCount = 0;

    // Анализируем каждый пиксель
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Пропускаем тёмные и очень светлые пиксели
      const brightness = r + g + b;
      if (brightness < 100 || brightness > 650) continue;
      
      pixelCount++;
      
      // Голубой текст: синий + зелёный компоненты сильнее красного
      const cyanness = (g + b) / 2 - r;
      if (cyanness > 50 && b > 100) {
        cyanScore += cyanness;
      }
      
      // Фиолетовый текст: красный + синий компоненты сильнее зелёного
      const purpleness = (r + b) / 2 - g;
      if (purpleness > 50 && b > 100) {
        purpleScore += purpleness;
      }
    }

    if (pixelCount < 50) {
      setLastRecognizedText('Мало пикселей для анализа');
      return null;
    }

    const avgCyan = cyanScore / pixelCount;
    const avgPurple = purpleScore / pixelCount;

    setLastRecognizedText(`🔵 Голубой: ${avgCyan.toFixed(1)} | 🟣 Фиолетовый: ${avgPurple.toFixed(1)} | Пикселей: ${pixelCount}`);

    // Определяем победителя (минимум 20 очков)
    if (avgCyan > 20 && avgCyan > avgPurple) {
      return 'alpha';
    }

    if (avgPurple > 20 && avgPurple > avgCyan) {
      return 'omega';
    }

    return null;
  };

  useEffect(() => {
    if (!isCapturing || !isRunning || isPaused) return;

    const interval = setInterval(async () => {
      const detectedColumn = await recognizeColorFromArea();
      
      if (detectedColumn) {
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
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isCapturing, isRunning, isPaused, captureArea, previousPrediction]);

  useEffect(() => {
    if (timeLeft === 10 && isRunning && !isPaused) {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWS56+OZRQ0PVKjk7ahiHAU7k9rxzH0vBSl+zPDef0IKFmG47OWkUhEMTKXh8bllHgU');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    }
  }, [timeLeft, isRunning, isPaused]);

  const addManualEntry = (column: Column) => {
    const newEvent: HistoryEvent = {
      id: Date.now(),
      column,
      timestamp: new Date(),
      source: 'manual'
    };
    
    setHistory(prev => [...prev, newEvent]);
    
    toast({
      title: "Добавлено вручную",
      description: `Колонка ${column === 'alpha' ? 'АЛЬФА' : 'ОМЕГА'} добавлена в историю`,
    });
  };

  const handleStart = async () => {
    if (!captureArea) {
      toast({
        title: "Выберите область",
        description: "Сначала выделите область на экране",
        variant: "destructive"
      });
      return;
    }

    setIsRunning(true);
    setIsPaused(false);
    setTimeLeft(30);
    
    toast({
      title: "Система запущена",
      description: "Начато распознавание и прогнозирование",
    });

    // Первое распознавание сразу
    const detectedColumn = await recognizeColorFromArea();
    if (detectedColumn) {
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
      
      toast({
        title: `Распознано!`,
        description: `Обнаружена колонка: ${detectedColumn === 'alpha' ? 'АЛЬФА' : 'ОМЕГА'}`,
      });
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    setIsPaused(false);
    
    toast({
      title: "Система остановлена",
      description: "Распознавание приостановлено",
    });
  };

  const exportToJSON = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      summary: {
        totalEvents: history.length,
        recognizedEvents: recognizedHistory.length,
        totalPredictions: predictionHistory.length,
        correctPredictions: predictionHistory.filter(p => p.isCorrect).length,
        overallAccuracy: predictionHistory.length > 0
          ? (predictionHistory.filter(p => p.isCorrect).length / predictionHistory.length) * 100
          : 0,
        alphaCount: recognizedHistory.filter(c => c === 'alpha').length,
        omegaCount: recognizedHistory.filter(c => c === 'omega').length,
      },
      recognizedHistory,
      fullHistory: history,
      predictions: predictionHistory,
      methodPerformance: methodHistory,
      accuracyOverTime: accuracyHistory,
      currentWeights: adaptiveWeights,
      methodStats: getMethodStats()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prediction-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Экспорт завершён",
      description: "История сохранена в JSON",
    });
  };

  const exportToCSV = () => {
    const csvRows: string[] = [];
    
    csvRows.push('=== РАСПОЗНАННАЯ ИСТОРИЯ ===');
    csvRows.push('Номер,Колонка,Время');
    recognizedHistory.forEach((col, idx) => {
      const event = history.find(h => h.source === 'screen' && history.indexOf(h) >= idx);
      csvRows.push(`${idx + 1},${col},${event ? event.timestamp.toLocaleString() : 'N/A'}`);
    });

    csvRows.push('');
    csvRows.push('=== ИСТОРИЯ ПРОГНОЗОВ ===');
    csvRows.push('ID,Время,Прогноз,Факт,Результат,Уверенность');
    predictionHistory.forEach(pred => {
      csvRows.push(
        `${pred.id},${pred.timestamp.toLocaleString()},${pred.prediction},${pred.actual},${pred.isCorrect ? 'Верно' : 'Неверно'},${pred.confidence}%`
      );
    });

    csvRows.push('');
    csvRows.push('=== СТАТИСТИКА МЕТОДОВ ===');
    csvRows.push('Метод,Всего прогнозов,Верных,Точность,Средняя уверенность,Вес');
    getMethodStats().forEach(stat => {
      csvRows.push(
        `${stat.name},${stat.totalPredictions},${stat.correctPredictions},${stat.accuracy.toFixed(2)}%,${stat.avgConfidence.toFixed(2)}%,${stat.weight.toFixed(2)}`
      );
    });

    const overallAcc = predictionHistory.length > 0
      ? (predictionHistory.filter(p => p.isCorrect).length / predictionHistory.length) * 100
      : 0;

    csvRows.push('');
    csvRows.push('=== ОБЩАЯ СТАТИСТИКА ===');
    csvRows.push(`Распознано событий,${recognizedHistory.length}`);
    csvRows.push(`АЛЬФА,${recognizedHistory.filter(c => c === 'alpha').length}`);
    csvRows.push(`ОМЕГА,${recognizedHistory.filter(c => c === 'omega').length}`);
    csvRows.push(`Всего прогнозов,${predictionHistory.length}`);
    csvRows.push(`Верных прогнозов,${predictionHistory.filter(p => p.isCorrect).length}`);
    csvRows.push(`Общая точность,${overallAcc.toFixed(2)}%`);

    const csv = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prediction-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Экспорт завершён",
      description: "История сохранена в CSV",
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
    setAdaptiveWeights({
      pattern: 1.0,
      frequency: 1.0,
      markov: 1.0,
      sequenceDepth: 1.0,
      nGram: 1.0,
      entropy: 1.0,
      streak: 1.0
    });
    
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
      handleStart();
    } else {
      setIsPaused(!isPaused);
      toast({
        title: isPaused ? "Возобновлено" : "Пауза",
        description: isPaused ? "Система продолжает работу" : "Система на паузе",
      });
    }
  };

  const getMethodStats = (): MethodStats[] => {
    const methods = ['Pattern Recognition', 'Frequency Analysis', 'Markov Chain', 'Deep Sequence', 'N-Gram Analysis', 'Entropy Prediction', 'Streak Analysis'];
    
    return methods.map(method => {
      const methodPreds = methodHistory.filter(m => m.methodName === method);
      const correct = methodPreds.filter(m => m.isCorrect).length;
      const accuracy = methodPreds.length > 0 ? (correct / methodPreds.length) * 100 : 0;
      const avgConf = methodPreds.length > 0 
        ? methodPreds.reduce((sum, m) => sum + m.confidence, 0) / methodPreds.length 
        : 0;

      let weight = 1.0;
      if (method === 'Pattern Recognition') weight = adaptiveWeights.pattern;
      if (method === 'Frequency Analysis') weight = adaptiveWeights.frequency;
      if (method === 'Markov Chain') weight = adaptiveWeights.markov;
      if (method === 'Deep Sequence') weight = adaptiveWeights.sequenceDepth;
      if (method === 'N-Gram Analysis') weight = adaptiveWeights.nGram;
      if (method === 'Entropy Prediction') weight = adaptiveWeights.entropy;
      if (method === 'Streak Analysis') weight = adaptiveWeights.streak;

      return {
        name: method,
        totalPredictions: methodPreds.length,
        correctPredictions: correct,
        accuracy,
        avgConfidence: avgConf,
        weight
      };
    });
  };

  const overallAccuracy = predictionHistory.length > 0
    ? (predictionHistory.filter(p => p.isCorrect).length / predictionHistory.length) * 100
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        
        <Card className="bg-slate-800/50 border-purple-500/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Icon name="Brain" className="text-purple-400" size={36} />
              Адаптивная система прогнозирования
            </h1>
            <Badge variant="outline" className="text-lg px-4 py-2 bg-purple-500/20 border-purple-400">
              AI Learning v2.0
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-slate-700/50 border-slate-600 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="Target" className="text-green-400" size={20} />
                <span className="text-slate-300 text-sm">Общая точность</span>
              </div>
              <div className="text-3xl font-bold text-white">
                {overallAccuracy.toFixed(1)}%
              </div>
              <Progress value={overallAccuracy} className="mt-2 h-2" />
            </Card>

            <Card className="bg-slate-700/50 border-slate-600 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="Database" className="text-blue-400" size={20} />
                <span className="text-slate-300 text-sm">Распознано</span>
              </div>
              <div className="text-3xl font-bold text-white">
                {recognizedHistory.length}
              </div>
              <div className="text-slate-400 text-sm mt-1">
                α: {recognizedHistory.filter(c => c === 'alpha').length} / 
                ω: {recognizedHistory.filter(c => c === 'omega').length}
              </div>
            </Card>

            <Card className="bg-slate-700/50 border-slate-600 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="TrendingUp" className="text-purple-400" size={20} />
                <span className="text-slate-300 text-sm">Прогнозов</span>
              </div>
              <div className="text-3xl font-bold text-white">
                {predictionHistory.length}
              </div>
              <div className="text-slate-400 text-sm mt-1">
                Верных: {predictionHistory.filter(p => p.isCorrect).length}
              </div>
            </Card>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ScreenCapture
            isCapturing={isCapturing}
            isRunning={isRunning}
            isPaused={isPaused}
            captureArea={captureArea}
            lastRecognizedText={lastRecognizedText}
            captureLogs={captureLogs}
            onStartCapture={startScreenCapture}
            onStopCapture={stopScreenCapture}
            onPauseResume={handlePauseResume}
            onStop={handleStop}
            onAreaSelect={setCaptureArea}
            videoRef={videoRef}
            canvasRef={canvasRef}
            previewCanvasRef={previewCanvasRef}
          />

          <PredictionDisplay
            ensemblePrediction={ensemblePrediction}
            lastPredictionResult={lastPredictionResult}
            timeLeft={timeLeft}
            currentSuccess={currentSuccess}
            predictions={predictions}
            methodStats={getMethodStats()}
          />
        </div>

        <HistoryPanel
          history={history}
          onAddManual={addManualEntry}
          onExportJSON={exportToJSON}
          onExportCSV={exportToCSV}
          onReset={handleReset}
        />

      </div>
    </div>
  );
};

export default Index;