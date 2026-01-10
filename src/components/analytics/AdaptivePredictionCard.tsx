import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

type Column = 'alpha' | 'omega';

interface AdaptivePrediction {
  pattern: string;
  fullSequence: string;
  nextEvent: string;
  prediction: Column;
  confidence: number;
  alphaProb: number;
  omegaProb: number;
  occurrences: number;
  length: number;
  score: number;
  strategyName: string;
  strategyAccuracy: number;
  imbalance: number;
  balanceInfo: string;
}

interface SequencePattern {
  length: number;
  pattern: string;
  fullSequence: string;
  count: number;
  nextAlpha: number;
  nextOmega: number;
  prediction: 'alpha' | 'omega';
  nextEvent: string;
  confidence: number;
  alphaProb: number;
  omegaProb: number;
  score: number;
}

interface PredictionHistory {
  id: number;
  timestamp: Date;
  prediction: Column;
  actual: Column;
  isCorrect: boolean;
  confidence: number;
}

interface AdaptivePredictionCardProps {
  prediction: AdaptivePrediction | null;
  predictionHistory: PredictionHistory[];
  topSequences: SequencePattern[];
}

export const AdaptivePredictionCard = ({ prediction, predictionHistory, topSequences }: AdaptivePredictionCardProps) => {
  const lastPrediction = predictionHistory.length > 0 ? predictionHistory[predictionHistory.length - 1] : null;
  const isSequenceMode = predictionHistory.length < 5;

  return (
    <Card className="bg-gradient-to-br from-[#D946EF]/10 via-[#8B5CF6]/10 to-[#0EA5E9]/10 border-[#D946EF]/30 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-[#D946EF] to-[#8B5CF6] p-4 rounded-xl">
            <Icon name="Sparkles" size={32} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-1">
              {isSequenceMode ? 'Прогноз на основе последовательностей' : 'Адаптивный прогноз'}
            </h2>
            {isSequenceMode ? (
              <p className="text-gray-400 text-sm">
                Режим обучения: прогнозов {predictionHistory.length}/5
              </p>
            ) : (
              prediction && (
                <>
                  <p className="text-gray-400 text-sm">
                    Стратегия: {prediction.strategyName} • Точность: {prediction.strategyAccuracy.toFixed(1)}%
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    Текущий баланс: {prediction.balanceInfo} • Дисбаланс: {prediction.imbalance > 0 ? '+' : ''}{prediction.imbalance}
                  </p>
                </>
              )
            )}
          </div>
        </div>

        {lastPrediction && (
          <div className={`px-4 py-2 rounded-lg border-2 flex items-center gap-2 ${
            lastPrediction.isCorrect 
              ? 'bg-green-500/20 border-green-500' 
              : 'bg-red-500/20 border-red-500'
          }`}>
            <Icon 
              name={lastPrediction.isCorrect ? "Check" : "X"} 
              size={20} 
              className={lastPrediction.isCorrect ? "text-green-400" : "text-red-400"} 
            />
            <div className="text-sm">
              <div className={`font-semibold ${lastPrediction.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                {lastPrediction.isCorrect ? 'Успешно' : 'Ошибка'}
              </div>
              <div className="text-gray-400 text-xs">
                Прогноз: {lastPrediction.prediction === 'alpha' ? 'α' : 'ω'} → Факт: {lastPrediction.actual === 'alpha' ? 'α' : 'ω'}
              </div>
            </div>
          </div>
        )}
      </div>

      {isSequenceMode ? (
        <>
          {topSequences.length > 0 && prediction ? (
            <>
              <div className="flex items-center justify-center mb-4">
                <div className={`px-8 py-4 rounded-xl border-2 ${
                  prediction.prediction === 'alpha'
                    ? 'bg-[#0EA5E9]/20 border-[#0EA5E9]'
                    : 'bg-[#8B5CF6]/20 border-[#8B5CF6]'
                }`}>
                  <div className="text-sm text-gray-400 mb-1 text-center">Следующее событие</div>
                  <div className={`text-5xl font-bold ${
                    prediction.prediction === 'alpha' ? 'text-[#0EA5E9]' : 'text-[#8B5CF6]'
                  }`}>
                    {prediction.nextEvent}
                  </div>
                </div>
              </div>

              <div className="mb-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-3 mb-3">
                  <Icon name="Database" size={20} className="text-[#0EA5E9]" />
                  <h3 className="text-lg font-semibold">Топ-5 паттернов из 5 событий</h3>
                  <Badge className="bg-[#0EA5E9]/20 text-[#0EA5E9] border-none">
                    Найдено: {topSequences.length}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  {topSequences.map((seq, idx) => (
                    <div 
                      key={idx}
                      className={`bg-white/5 rounded-lg p-3 border ${
                        prediction && seq.pattern === prediction.pattern
                          ? 'border-[#D946EF] bg-[#D946EF]/10'
                          : 'border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge className="bg-gradient-to-r from-[#0EA5E9] to-[#8B5CF6] text-white border-none px-2 py-1">
                            #{idx + 1}
                          </Badge>
                          
                          <div className="flex items-center gap-1">
                            {seq.fullSequence.split('-').map((symbol, i) => (
                              <Badge 
                                key={i}
                                className={`${
                                  symbol === 'α' 
                                    ? 'bg-[#0EA5E9] text-white' 
                                    : 'bg-[#8B5CF6] text-white'
                                } border-none text-xs ${i === seq.length - 1 ? 'ring-2 ring-[#D946EF]' : ''}`}
                              >
                                {symbol}
                              </Badge>
                            ))}
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-gray-400">
                              Встречалась: <span className="text-white font-semibold">{seq.count}</span>
                            </span>
                            <span className="text-gray-400">
                              Точность: <span className="text-white font-semibold">{seq.confidence.toFixed(0)}%</span>
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded bg-[#0EA5E9]" />
                            <span className="text-gray-400">{seq.nextAlpha}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded bg-[#8B5CF6]" />
                            <span className="text-gray-400">{seq.nextOmega}</span>
                          </div>
                        </div>
                      </div>
                      
                      {prediction && seq.pattern === prediction.pattern && (
                        <div className="mt-2 pt-2 border-t border-[#D946EF]/30">
                          <div className="flex items-center gap-2">
                            <Icon name="Target" size={14} className="text-[#D946EF]" />
                            <span className="text-[#D946EF] font-semibold text-xs">
                              Выбран для прогноза
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-gray-400 text-center">Накопите минимум 5 событий для первого прогноза</p>
            </div>
          )}
        </>
      ) : (
        <>
          {prediction ? (
            <>
              <div className="flex items-center justify-center mb-4">
                <div className={`px-8 py-4 rounded-xl border-2 ${
                  prediction.prediction === 'alpha'
                    ? 'bg-[#0EA5E9]/20 border-[#0EA5E9]'
                    : 'bg-[#8B5CF6]/20 border-[#8B5CF6]'
                }`}>
                  <div className="text-sm text-gray-400 mb-1 text-center">Следующее событие</div>
                  <div className={`text-5xl font-bold ${
                    prediction.prediction === 'alpha' ? 'text-[#0EA5E9]' : 'text-[#8B5CF6]'
                  }`}>
                    {prediction.nextEvent}
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Паттерн ({prediction.length - 1} → 1):</span>
                    <div className="flex gap-1">
                      {prediction.fullSequence.split('-').map((s, i) => (
                        <Badge key={i} className={`${
                          s === 'α' ? 'bg-[#0EA5E9] text-white' : 'bg-[#8B5CF6] text-white'
                        } border-none ${i === prediction.length - 1 ? 'ring-2 ring-[#D946EF]' : ''}`}>{s}</Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-[#0EA5E9]" />
                      <span className="text-gray-400">α: {prediction.alphaProb.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-[#8B5CF6]" />
                      <span className="text-gray-400">ω: {prediction.omegaProb.toFixed(1)}%</span>
                    </div>
                    <span className="text-gray-400">Встречался: {prediction.occurrences} раз</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-gray-400 text-center">Недостаточно данных для адаптивного прогноза</p>
            </div>
          )}
        </>
      )}
    </Card>
  );
};