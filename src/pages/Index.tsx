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
  weight: number;
}

interface AccuracyPoint {
  timestamp: number;
  pattern: number;
  frequency: number;
  markov: number;
  ensemble: number;
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
  weight: number;
}

interface AdaptiveWeights {
  pattern: number;
  frequency: number;
  markov: number;
  sequenceDepth: number;
  nGram: number;
  entropy: number;
  streak: number;
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
  const [lastRecognizedText, setLastRecognizedText] = useState<string>('');
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

  const calculateMethodAccuracy = (methodName: string): number => {
    const methodPredictions = methodHistory.filter(m => m.methodName === methodName);
    if (methodPredictions.length === 0) return 0;
    const correct = methodPredictions.filter(m => m.isCorrect).length;
    return (correct / methodPredictions.length) * 100;
  };

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

  const analyzePattern = (recHist: Column[]): AlgorithmPrediction => {
    if (recHist.length < 3) {
      return {
        name: 'Pattern Recognition',
        prediction: 'alpha',
        confidence: 50,
        accuracy: calculateMethodAccuracy('Pattern Recognition'),
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
        accuracy: calculateMethodAccuracy('Pattern Recognition'),
        description: `Паттерн найден: ${bestMatch}`,
        weight: adaptiveWeights.pattern
      };
    }

    return {
      name: 'Pattern Recognition',
      prediction: 'alpha',
      confidence: 50,
      accuracy: calculateMethodAccuracy('Pattern Recognition'),
      description: 'Паттерн не найден',
      weight: adaptiveWeights.pattern
    };
  };

  const analyzeFrequency = (recHist: Column[]): AlgorithmPrediction => {
    if (recHist.length === 0) {
      return {
        name: 'Frequency Analysis',
        prediction: 'alpha',
        confidence: 50,
        accuracy: calculateMethodAccuracy('Frequency Analysis'),
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
      accuracy: calculateMethodAccuracy('Frequency Analysis'),
      description: `α:${alphaCount} ω:${omegaCount} → ${prediction === 'alpha' ? 'α' : 'ω'}`,
      weight: adaptiveWeights.frequency
    };
  };

  const analyzeMarkov = (recHist: Column[]): AlgorithmPrediction => {
    if (recHist.length < 2) {
      return {
        name: 'Markov Chain',
        prediction: 'alpha',
        confidence: 50,
        accuracy: calculateMethodAccuracy('Markov Chain'),
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
        accuracy: calculateMethodAccuracy('Markov Chain'),
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
      accuracy: calculateMethodAccuracy('Markov Chain'),
      description: `${lastColumn} → α:${trans.alpha} ω:${trans.omega}`,
      weight: adaptiveWeights.markov
    };
  };

  const analyzeDeepSequence = (recHist: Column[]): AlgorithmPrediction => {
    if (recHist.length < 4) {
      return {
        name: 'Deep Sequence',
        prediction: 'alpha',
        confidence: 50,
        accuracy: calculateMethodAccuracy('Deep Sequence'),
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
          accuracy: calculateMethodAccuracy('Deep Sequence'),
          description: `Глубина: ${len}, совпадений: ${outcomes.length}`,
          weight: adaptiveWeights.sequenceDepth
        };
      }
    }

    return {
      name: 'Deep Sequence',
      prediction: 'alpha',
      confidence: 50,
      accuracy: calculateMethodAccuracy('Deep Sequence'),
      description: 'Глубокая последовательность не найдена',
      weight: adaptiveWeights.sequenceDepth
    };
  };

  const analyzeNGram = (recHist: Column[]): AlgorithmPrediction => {
    if (recHist.length < 3) {
      return {
        name: 'N-Gram Analysis',
        prediction: 'alpha',
        confidence: 50,
        accuracy: calculateMethodAccuracy('N-Gram Analysis'),
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
        accuracy: calculateMethodAccuracy('N-Gram Analysis'),
        description: `Биграмма: ${lastBigram}`,
        weight: adaptiveWeights.nGram
      };
    }

    return {
      name: 'N-Gram Analysis',
      prediction: 'alpha',
      confidence: 50,
      accuracy: calculateMethodAccuracy('N-Gram Analysis'),
      description: 'Биграмма не найдена',
      weight: adaptiveWeights.nGram
    };
  };

  const analyzeEntropy = (recHist: Column[]): AlgorithmPrediction => {
    if (recHist.length < 10) {
      return {
        name: 'Entropy Prediction',
        prediction: 'alpha',
        confidence: 50,
        accuracy: calculateMethodAccuracy('Entropy Prediction'),
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
      accuracy: calculateMethodAccuracy('Entropy Prediction'),
      description: `Энтропия: ${entropy.toFixed(2)}`,
      weight: adaptiveWeights.entropy
    };
  };

  const analyzeStreak = (recHist: Column[]): AlgorithmPrediction => {
    if (recHist.length < 3) {
      return {
        name: 'Streak Analysis',
        prediction: 'alpha',
        confidence: 50,
        accuracy: calculateMethodAccuracy('Streak Analysis'),
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
      accuracy: calculateMethodAccuracy('Streak Analysis'),
      description: `Серия: ${currentStreak}, макс: ${maxStreak}`,
      weight: adaptiveWeights.streak
    };
  };

  const calculateEnsemble = (preds: AlgorithmPrediction[]): { column: Column; confidence: number } => {
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

  useEffect(() => {
    if (recognizedHistory.length > 0) {
      updateAdaptiveWeights();

      const newPredictions: AlgorithmPrediction[] = [
        analyzePattern(recognizedHistory),
        analyzeFrequency(recognizedHistory),
        analyzeMarkov(recognizedHistory),
        analyzeDeepSequence(recognizedHistory),
        analyzeNGram(recognizedHistory),
        analyzeEntropy(recognizedHistory),
        analyzeStreak(recognizedHistory),
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

  const startScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' }
      });

      setCaptureStream(stream);
      setIsCapturing(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      toast({
        title: "Захват экрана начат",
        description: "Теперь выберите область для распознавания",
      });
    } catch (error) {
      toast({
        title: "Ошибка захвата экрана",
        description: "Не удалось начать захват",
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

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCapturing || isRunning) return;

    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    setIsSelectingArea(true);
    setSelectionStart({ x, y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelectingArea || !selectionStart) return;

    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const area: CaptureArea = {
      x: Math.min(selectionStart.x, x),
      y: Math.min(selectionStart.y, y),
      width: Math.abs(x - selectionStart.x),
      height: Math.abs(y - selectionStart.y)
    };

    setCaptureArea(area);
  };

  const handleCanvasMouseUp = () => {
    if (isSelectingArea && captureArea && captureArea.width > 10 && captureArea.height > 10) {
      setIsSelectingArea(false);
      setSelectionStart(null);
      
      toast({
        title: "Область выбрана",
        description: "Нажмите 'Старт' для начала распознавания",
      });
    }
  };

  useEffect(() => {
    if (!isCapturing || !videoRef.current || !previewCanvasRef.current) return;

    const drawPreview = () => {
      const video = videoRef.current;
      const canvas = previewCanvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.drawImage(video, 0, 0);

      if (captureArea) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(captureArea.x, captureArea.y, captureArea.width, captureArea.height);
      }

      requestAnimationFrame(drawPreview);
    };

    drawPreview();
  }, [isCapturing, captureArea]);

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
    let totalR = 0, totalG = 0, totalB = 0, pixelCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      totalR += data[i];
      totalG += data[i + 1];
      totalB += data[i + 2];
      pixelCount++;
    }

    const avgR = totalR / pixelCount;
    const avgG = totalG / pixelCount;
    const avgB = totalB / pixelCount;

    const brightness = (avgR + avgG + avgB) / 3;

    if (brightness < 30) {
      setLastRecognizedText('Темный экран');
      return null;
    }

    if (avgG > avgR && avgG > avgB && avgG > 100) {
      setLastRecognizedText('Обнаружен зеленый → АЛЬФА');
      return 'alpha';
    }

    if (avgR > avgG && avgR > avgB && avgR > 100) {
      setLastRecognizedText('Обнаружен красный → ОМЕГА');
      return 'omega';
    }

    setLastRecognizedText(`RGB: ${avgR.toFixed(0)}, ${avgG.toFixed(0)}, ${avgB.toFixed(0)}`);
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

  const handleStart = () => {
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
    
    toast({
      title: "Система запущена",
      description: "Начато распознавание и прогнозирование",
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
          
          <Card className="bg-slate-800/50 border-purple-500/30 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Icon name="Monitor" className="text-blue-400" size={24} />
              Захват экрана
            </h2>

            <div className="space-y-4">
              {!isCapturing ? (
                <Button 
                  onClick={startScreenCapture}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <Icon name="ScreenShare" className="mr-2" size={20} />
                  Начать захват экрана
                </Button>
              ) : (
                <>
                  <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                    <video 
                      ref={videoRef} 
                      className="hidden"
                      autoPlay 
                      playsInline 
                      muted
                    />
                    <canvas 
                      ref={canvasRef} 
                      className="hidden"
                    />
                    <canvas 
                      ref={previewCanvasRef}
                      className="w-full h-full cursor-crosshair"
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                    />
                    
                    {!isRunning && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
                        <div className="text-white text-center">
                          <Icon name="MousePointer" className="mx-auto mb-2 text-purple-400" size={48} />
                          <p className="text-lg">Выделите область для анализа</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handlePauseResume}
                      className={`flex-1 ${isPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                      disabled={!captureArea}
                    >
                      <Icon name={isPaused ? "Play" : isRunning ? "Pause" : "Play"} className="mr-2" size={20} />
                      {isPaused ? 'Продолжить' : isRunning ? 'Пауза' : 'Старт'}
                    </Button>
                    
                    <Button 
                      onClick={handleStop}
                      variant="destructive"
                      className="flex-1"
                      disabled={!isRunning}
                    >
                      <Icon name="Square" className="mr-2" size={20} />
                      Стоп
                    </Button>

                    <Button 
                      onClick={stopScreenCapture}
                      variant="outline"
                      className="flex-1"
                    >
                      <Icon name="X" className="mr-2" size={20} />
                      Завершить
                    </Button>
                  </div>

                  {lastRecognizedText && (
                    <div className="bg-slate-700/50 p-3 rounded-lg">
                      <p className="text-slate-300 text-sm">
                        <Icon name="Info" className="inline mr-2" size={16} />
                        {lastRecognizedText}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          <Card className="bg-slate-800/50 border-purple-500/30 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Icon name="Sparkles" className="text-yellow-400" size={24} />
              Ансамблевый прогноз
            </h2>

            {ensemblePrediction ? (
              <div className="space-y-4">
                <div className={`relative p-8 rounded-xl border-4 ${
                  ensemblePrediction.column === 'alpha' 
                    ? 'bg-green-500/20 border-green-400' 
                    : 'bg-red-500/20 border-red-400'
                }`}>
                  <div className="text-center">
                    <div className="text-6xl font-bold text-white mb-2">
                      {ensemblePrediction.column === 'alpha' ? 'АЛЬФА' : 'ОМЕГА'}
                    </div>
                    <div className="text-2xl text-white/80">
                      Уверенность: {ensemblePrediction.confidence}%
                    </div>
                  </div>

                  {lastPredictionResult && (
                    <div className={`absolute top-2 right-2 ${
                      lastPredictionResult === 'correct' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      <Icon 
                        name={lastPredictionResult === 'correct' ? "CheckCircle" : "XCircle"} 
                        size={32} 
                      />
                    </div>
                  )}
                </div>

                <div className="bg-slate-700/50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-300">До следующего анализа</span>
                    <span className="text-2xl font-bold text-white">{timeLeft}с</span>
                  </div>
                  <Progress value={(timeLeft / 30) * 100} className="h-3" />
                </div>

                {currentSuccess && (
                  <div className={`p-4 rounded-lg ${
                    currentSuccess === 'alpha' 
                      ? 'bg-green-500/30 border border-green-400' 
                      : 'bg-red-500/30 border border-red-400'
                  }`}>
                    <div className="flex items-center gap-2 text-white font-bold">
                      <Icon name="CheckCircle" size={24} />
                      Распознано: {currentSuccess === 'alpha' ? 'АЛЬФА' : 'ОМЕГА'}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-slate-400 py-12">
                <Icon name="Brain" className="mx-auto mb-4 text-slate-600" size={64} />
                <p>Накопление данных для прогноза...</p>
              </div>
            )}
          </Card>
        </div>

        <Card className="bg-slate-800/50 border-purple-500/30 p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Icon name="Zap" className="text-yellow-400" size={24} />
            Адаптивные алгоритмы (7 методов с автоподстройкой)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {predictions.map((pred, idx) => (
              <Card 
                key={idx} 
                className={`p-4 border-2 ${
                  pred.prediction === 'alpha' 
                    ? 'bg-green-900/30 border-green-500/50' 
                    : 'bg-red-900/30 border-red-500/50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-sm font-semibold text-white">{pred.name}</div>
                  <Badge 
                    variant="outline" 
                    className={`${
                      pred.prediction === 'alpha' 
                        ? 'bg-green-500/20 border-green-400' 
                        : 'bg-red-500/20 border-red-400'
                    }`}
                  >
                    {pred.prediction === 'alpha' ? 'α' : 'ω'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Уверенность</span>
                      <span className="font-bold">{pred.confidence}%</span>
                    </div>
                    <Progress value={pred.confidence} className="h-2" />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Точность</span>
                      <span className="font-bold">{pred.accuracy.toFixed(1)}%</span>
                    </div>
                    <Progress value={pred.accuracy} className="h-2" />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Вес</span>
                      <span className="font-bold">{pred.weight.toFixed(2)}x</span>
                    </div>
                    <Progress value={(pred.weight / 3) * 100} className="h-2" />
                  </div>

                  <p className="text-xs text-slate-400 mt-2">{pred.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </Card>

        <Card className="bg-slate-800/50 border-purple-500/30 p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Icon name="BarChart3" className="text-blue-400" size={24} />
            Статистика методов
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-slate-700/50 text-slate-300">
                <tr>
                  <th className="px-4 py-3">Метод</th>
                  <th className="px-4 py-3">Прогнозов</th>
                  <th className="px-4 py-3">Верных</th>
                  <th className="px-4 py-3">Точность</th>
                  <th className="px-4 py-3">Ср. уверенность</th>
                  <th className="px-4 py-3">Вес</th>
                </tr>
              </thead>
              <tbody>
                {getMethodStats()
                  .sort((a, b) => b.accuracy - a.accuracy)
                  .map((stat, idx) => (
                  <tr key={idx} className="border-b border-slate-700 text-white">
                    <td className="px-4 py-3 font-medium">{stat.name}</td>
                    <td className="px-4 py-3">{stat.totalPredictions}</td>
                    <td className="px-4 py-3">{stat.correctPredictions}</td>
                    <td className="px-4 py-3">
                      <Badge variant={stat.accuracy >= 60 ? 'default' : 'destructive'}>
                        {stat.accuracy.toFixed(1)}%
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{stat.avgConfidence.toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="bg-purple-500/20">
                        {stat.weight.toFixed(2)}x
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="bg-slate-800/50 border-purple-500/30 p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Icon name="History" className="text-orange-400" size={24} />
            История ({history.length})
          </h2>

          <div className="flex gap-2 mb-4">
            <Button 
              onClick={() => addManualEntry('alpha')}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Icon name="Plus" className="mr-2" size={20} />
              Добавить АЛЬФА
            </Button>
            
            <Button 
              onClick={() => addManualEntry('omega')}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              <Icon name="Plus" className="mr-2" size={20} />
              Добавить ОМЕГА
            </Button>

            <Button 
              onClick={handleReset}
              variant="outline"
              className="flex-1"
            >
              <Icon name="RotateCcw" className="mr-2" size={20} />
              Сброс
            </Button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {history.length === 0 ? (
              <div className="text-center text-slate-400 py-8">
                <Icon name="Inbox" className="mx-auto mb-2 text-slate-600" size={48} />
                <p>История пуста</p>
              </div>
            ) : (
              history.slice().reverse().map((event) => (
                <div 
                  key={event.id}
                  className={`p-3 rounded-lg flex items-center justify-between ${
                    event.column === 'alpha' 
                      ? 'bg-green-900/30 border border-green-500/30' 
                      : 'bg-red-900/30 border border-red-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Badge className={`${
                      event.column === 'alpha' 
                        ? 'bg-green-600' 
                        : 'bg-red-600'
                    } text-white px-3 py-1`}>
                      {event.column === 'alpha' ? 'АЛЬФА' : 'ОМЕГА'}
                    </Badge>
                    <span className="text-slate-300 text-sm">
                      {event.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <Icon 
                      name={event.source === 'screen' ? 'Monitor' : 'Hand'} 
                      className="mr-1" 
                      size={12} 
                    />
                    {event.source === 'screen' ? 'Экран' : 'Вручную'}
                  </Badge>
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
