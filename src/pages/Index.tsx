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

const Index = () => {
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [currentSuccess, setCurrentSuccess] = useState<Column | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [predictions, setPredictions] = useState<AlgorithmPrediction[]>([]);
  const [ensemblePrediction, setEnsemblePrediction] = useState<{ column: Column; confidence: number } | null>(null);
  const [accuracyHistory, setAccuracyHistory] = useState<AccuracyPoint[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        videoRef.current.play();
      }

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenCapture();
      });

      toast({
        title: "Захват экрана запущен",
        description: "Система распознает SUCCESS на экране",
      });
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
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const analyzeScreenFrame = () => {
    if (!videoRef.current || !canvasRef.current || !isCapturing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx || video.videoWidth === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    let blueScore = 0;
    let purpleScore = 0;
    let successTextFound = false;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      if (b > 200 && g < 180 && r < 100) {
        blueScore++;
      }
      
      if (b > 150 && r > 100 && r < 200 && g < 150) {
        purpleScore++;
      }

      if (r > 240 && g > 240 && b > 240) {
        successTextFound = true;
      }
    }

    if (successTextFound && (blueScore > 10000 || purpleScore > 10000)) {
      const detectedColumn: Column = blueScore > purpleScore ? 'alpha' : 'omega';
      
      const lastEvent = history[history.length - 1];
      const timeSinceLastEvent = lastEvent ? 
        (Date.now() - lastEvent.timestamp.getTime()) / 1000 : 999;

      if (timeSinceLastEvent > 25) {
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
          title: `Обнаружен SUCCESS!`,
          description: `Колонка: ${detectedColumn === 'alpha' ? 'АЛЬФА (голубая)' : 'ОМЕГА (фиолетовая)'}`,
        });
      }
    }
  };

  useEffect(() => {
    if (isCapturing) {
      const interval = setInterval(analyzeScreenFrame, 1000);
      return () => clearInterval(interval);
    }
  }, [isCapturing, history]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (!isCapturing) {
            const nextColumn: Column = Math.random() > 0.5 ? 'alpha' : 'omega';
            const newEvent: HistoryEvent = {
              id: Date.now(),
              column: nextColumn,
              timestamp: new Date(),
              source: 'manual'
            };
            
            setHistory(prev => [...prev, newEvent]);
            setCurrentSuccess(nextColumn);
            
            setTimeout(() => setCurrentSuccess(null), 2000);
          }
          
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isCapturing]);

  useEffect(() => {
    if (history.length > 0) {
      const pattern = analyzePattern(history);
      const frequency = analyzeFrequency(history);
      const markov = analyzeMarkov(history);
      
      const newPredictions = [pattern, frequency, markov];
      setPredictions(newPredictions);
      
      const ensemble = calculateEnsemble(newPredictions);
      setEnsemblePrediction(ensemble);

      setAccuracyHistory(prev => [...prev, {
        timestamp: Date.now(),
        pattern: pattern.accuracy,
        frequency: frequency.accuracy,
        markov: markov.accuracy
      }].slice(-20));
    }
  }, [history]);

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
          <p className="text-gray-400">Система аналитического прогнозирования с захватом экрана</p>
        </div>

        <div className="flex gap-3 justify-center">
          <Button
            onClick={isCapturing ? stopScreenCapture : startScreenCapture}
            className={`${
              isCapturing 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-gradient-to-r from-[#8B5CF6] to-[#0EA5E9] hover:opacity-90'
            }`}
          >
            <Icon name={isCapturing ? "StopCircle" : "Monitor"} size={20} className="mr-2" />
            {isCapturing ? 'Остановить захват' : 'Начать захват экрана'}
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
        </div>

        {isCapturing && (
          <Card className="bg-green-500/10 border-green-500/30 p-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-400 font-semibold">Захват экрана активен - система распознает SUCCESS</span>
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
              <span className="text-lg">Следующее появление через:</span>
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
                        Захват
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
