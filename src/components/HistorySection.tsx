import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';

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

interface HistorySectionProps {
  history: HistoryEvent[];
  predictionHistory: PredictionHistory[];
  lastPredictionResult: 'correct' | 'incorrect' | null;
}

export const HistorySection = ({ history, predictionHistory, lastPredictionResult }: HistorySectionProps) => {
  return (
    <>
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
                  {lastPredictionResult === 'correct' ? 'Прогноз верный!' : 'Прогноз неверный'}
                </h3>
                <p className="text-gray-400">
                  {lastPredictionResult === 'correct' 
                    ? 'Система точно предсказала следующее событие'
                    : 'Система ошиблась в прогнозе'}
                </p>
              </div>
            </div>
            
            {lastPredictionResult === 'correct' && (
              <div className="text-6xl">🎯</div>
            )}
          </div>
        </Card>
      )}

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
        
        {history.length > 0 ? (
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
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <Icon name="History" size={48} className="text-[#8B5CF6] mb-4" />
            <h3 className="text-xl font-bold mb-2">История событий и прогнозов</h3>
            <p className="text-gray-400 text-center">Начните добавлять события, чтобы увидеть историю</p>
          </div>
        )}
      </Card>
    </>
  );
};