import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScreenCaptureSection } from '@/components/ScreenCaptureSection';
import { PredictionAnalytics } from '@/components/PredictionAnalytics';
import { HistorySection } from '@/components/HistorySection';

type Column = 'alpha' | 'omega';

interface HistoryEvent {
  id: number;
  column: Column;
  timestamp: Date;
  source: 'manual' | 'screen';
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

const Index = () => {
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [currentSuccess, setCurrentSuccess] = useState<Column | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [previousPrediction, setPreviousPrediction] = useState<Column | null>(null);
  const [lastPredictionResult, setLastPredictionResult] = useState<'correct' | 'incorrect' | null>(null);
  const [predictionHistory, setPredictionHistory] = useState<PredictionHistory[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [captureArea, setCaptureArea] = useState<CaptureArea | null>(null);

  const stats = {
    alpha: history.filter(e => e.column === 'alpha').length,
    omega: history.filter(e => e.column === 'omega').length,
    total: history.length
  };

  const addEvent = (column: Column, source: 'manual' | 'screen' = 'manual') => {
    const newEvent: HistoryEvent = {
      id: Date.now(),
      column,
      timestamp: new Date(),
      source
    };
    
    setHistory(prev => [...prev, newEvent]);
    setCurrentSuccess(column);
    
    setTimeout(() => setCurrentSuccess(null), 2000);

    if (previousPrediction && history.length >= 5) {
      const isCorrect = previousPrediction === column;
      setLastPredictionResult(isCorrect ? 'correct' : 'incorrect');
      
      const predictionRecord: PredictionHistory = {
        id: Date.now(),
        timestamp: new Date(),
        prediction: previousPrediction,
        actual: column,
        isCorrect,
        confidence: 75
      };
      
      setPredictionHistory(prev => [...prev, predictionRecord]);
      
      setTimeout(() => {
        setLastPredictionResult(null);
      }, 5000);
    }

    setPreviousPrediction(null);
  };

  const handleReset = () => {
    setHistory([]);
    setPredictionHistory([]);
    setCurrentSuccess(null);
    setLastPredictionResult(null);
    setPreviousPrediction(null);
    setTimeLeft(30);
  };

  const exportToCSV = () => {
    const csvContent = [
      ['#', 'Колонка', 'Время', 'Источник'].join(','),
      ...history.map((event, idx) => 
        [
          idx + 1,
          event.column === 'alpha' ? 'Альфа' : 'Омега',
          event.timestamp.toLocaleString('ru-RU'),
          event.source === 'screen' ? 'Захват экрана' : 'Ручной'
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `success-predictor-${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (!isRunning || isPaused) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, isPaused]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A1F2C] via-[#221F26] to-[#1A1F2C] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#0EA5E9] via-[#8B5CF6] to-[#D946EF] bg-clip-text text-transparent">
            SUCCESS Predictor
          </h1>
          <p className="text-gray-400">Адаптивная система прогнозирования с машинным обучением</p>
          <p className="text-sm text-gray-500">Анализ паттернов из 5 событий • Автоматический выбор стратегии • Самообучение</p>
          
          <div className="mt-4 max-w-md mx-auto">
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="flex items-center justify-between mb-2 text-xs text-gray-400">
                <span>α: {stats.alpha}</span>
                <span className={`font-semibold ${
                  Math.abs(stats.alpha - stats.omega) < 3 ? 'text-green-400' :
                  Math.abs(stats.alpha - stats.omega) < 6 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  Баланс: {stats.total > 0 ? ((Math.min(stats.alpha, stats.omega) / Math.max(stats.alpha, stats.omega)) * 100).toFixed(0) : 0}%
                </span>
                <span>ω: {stats.omega}</span>
              </div>
              <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
                {stats.total > 0 ? (
                  <>
                    <div 
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#0EA5E9] to-[#0EA5E9]/80 transition-all duration-300"
                      style={{ width: `${(stats.alpha / (stats.alpha + stats.omega)) * 100}%` }}
                    />
                    <div 
                      className="absolute right-0 top-0 h-full bg-gradient-to-l from-[#8B5CF6] to-[#8B5CF6]/80 transition-all duration-300"
                      style={{ width: `${(stats.omega / (stats.alpha + stats.omega)) * 100}%` }}
                    />
                    <div className="absolute left-1/2 top-0 w-0.5 h-full bg-white/50 -translate-x-1/2" />
                  </>
                ) : (
                  <div className="absolute left-0 top-0 h-full w-full bg-white/5" />
                )}
              </div>
              <div className="flex items-center justify-center mt-2 text-xs">
                <span className={`${
                  stats.total === 0 ? 'text-gray-400' :
                  Math.abs(stats.alpha - stats.omega) < 3 ? 'text-green-400' :
                  Math.abs(stats.alpha - stats.omega) < 6 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {stats.total === 0 ? 'Нет данных для анализа баланса' :
                   Math.abs(stats.alpha - stats.omega) < 3 ? '✓ Система сбалансирована' :
                   Math.abs(stats.alpha - stats.omega) < 6 ? '⚠ Небольшой дисбаланс' : 
                   `⚡ Дисбаланс: ${stats.alpha > stats.omega ? 'α' : 'ω'} доминирует`}
                </span>
              </div>
            </div>
          </div>
        </div>

        <ScreenCaptureSection
          isCapturing={isCapturing}
          setIsCapturing={setIsCapturing}
          isRunning={isRunning}
          setIsRunning={setIsRunning}
          isPaused={isPaused}
          setIsPaused={setIsPaused}
          captureArea={captureArea}
          setCaptureArea={setCaptureArea}
          onReset={handleReset}
          onExportCSV={exportToCSV}
          historyLength={history.length}
          onEventDetected={(column) => addEvent(column, 'screen')}
        />

        <PredictionAnalytics history={history} stats={stats} />

        <HistorySection 
          history={history}
          predictionHistory={predictionHistory}
          lastPredictionResult={lastPredictionResult}
        />

        <Card className="bg-white/5 border-white/10 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg">Следующее сканирование через:</span>
            </div>
            <div className="text-3xl font-bold text-[#0EA5E9]">{timeLeft}s</div>
          </div>
          <Progress value={(30 - timeLeft) / 30 * 100} className="mt-4 h-2" />
        </Card>
      </div>
    </div>
  );
};

export default Index;
