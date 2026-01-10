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

interface AdaptivePredictionCardProps {
  prediction: AdaptivePrediction | null;
}

export const AdaptivePredictionCard = ({ prediction }: AdaptivePredictionCardProps) => {
  return (
    <Card className="bg-gradient-to-br from-[#D946EF]/10 via-[#8B5CF6]/10 to-[#0EA5E9]/10 border-[#D946EF]/30 p-6">
      {prediction ? (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-[#D946EF] to-[#8B5CF6] p-4 rounded-xl">
                <Icon name="Sparkles" size={32} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">Адаптивный прогноз</h2>
                <p className="text-gray-400 text-sm">
                  Стратегия: {prediction.strategyName} • Точность: {prediction.strategyAccuracy.toFixed(1)}%
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Текущий баланс: {prediction.balanceInfo} • Дисбаланс: {prediction.imbalance > 0 ? '+' : ''}{prediction.imbalance}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
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
          </div>
          
          <div className="mt-4 pt-4 border-t border-white/10">
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
          <div className="bg-gradient-to-br from-[#D946EF] to-[#8B5CF6] p-4 rounded-xl mb-4">
            <Icon name="Sparkles" size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Адаптивный прогноз</h2>
          <p className="text-gray-400 text-center">Накопите минимум 5 событий для первого прогноза</p>
        </div>
      )}
    </Card>
  );
};
