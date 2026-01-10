import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

type Column = 'alpha' | 'omega';

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

interface TopPatternsCardProps {
  topSequences: SequencePattern[];
  prediction: AdaptivePrediction | null;
}

export const TopPatternsCard = ({ topSequences, prediction }: TopPatternsCardProps) => {
  return (
    <Card className="bg-white/5 border-white/10 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Icon name="Database" size={24} className="text-[#0EA5E9]" />
        <h3 className="text-xl font-bold">Топ-5 паттернов из 5 событий</h3>
        {topSequences.length > 0 && (
          <Badge className="bg-[#0EA5E9]/20 text-[#0EA5E9] border-none">
            Найдено: {topSequences.length}
          </Badge>
        )}
        <span className="text-gray-400 text-sm ml-2">(4 события + 5-е событие = прогноз)</span>
      </div>
      
      {topSequences.length > 0 ? (
        <div className="space-y-3">
          {topSequences.map((seq, idx) => (
            <div 
              key={idx}
              className={`bg-white/5 rounded-lg p-4 border ${
                prediction && seq.pattern === prediction.pattern
                  ? 'border-[#D946EF] bg-[#D946EF]/10'
                  : 'border-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge className="bg-gradient-to-r from-[#0EA5E9] to-[#8B5CF6] text-white border-none text-lg px-3 py-1">
                    #{idx + 1}
                  </Badge>
                  
                  <Badge className="bg-[#D946EF]/20 text-[#D946EF] border-none text-xs">
                    Длина: {seq.length}
                  </Badge>
                  
                  <div className="flex items-center gap-2">
                    {seq.fullSequence.split('-').map((symbol, i) => (
                      <Badge 
                        key={i}
                        className={`${
                          symbol === 'α' 
                            ? 'bg-[#0EA5E9] text-white' 
                            : 'bg-[#8B5CF6] text-white'
                        } border-none text-sm font-bold ${i === seq.length - 1 ? 'ring-2 ring-[#D946EF]' : ''}`}
                      >
                        {symbol}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-gray-400">
                      Встречалась: <span className="text-white font-semibold">{seq.count} раз</span>
                    </div>
                    <div className="text-gray-400">
                      Точность: <span className="text-white font-semibold">{seq.confidence.toFixed(0)}%</span>
                    </div>
                    <div className="text-gray-400">
                      Рейтинг: <span className="text-white font-semibold">{seq.score.toFixed(0)}</span>
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
              
              {prediction && seq.pattern === prediction.pattern && (
                <div className="mt-3 pt-3 border-t border-[#D946EF]/30">
                  <div className="flex items-center gap-2">
                    <Icon name="Sparkles" size={16} className="text-[#D946EF]" />
                    <span className="text-[#D946EF] font-semibold text-sm">
                      🎯 Система выбрала этот паттерн для прогноза! Следующее событие с вероятностью {seq.confidence.toFixed(0)}%: {seq.prediction === 'alpha' ? 'Альфа' : 'Омега'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-gray-400 text-center">Накопите больше данных для анализа паттернов</p>
        </div>
      )}
    </Card>
  );
};
