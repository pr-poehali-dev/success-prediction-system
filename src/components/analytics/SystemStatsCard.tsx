import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';

type Column = 'alpha' | 'omega';

interface PredictionHistory {
  id: number;
  timestamp: Date;
  prediction: Column;
  actual: Column;
  isCorrect: boolean;
  confidence: number;
}

interface SystemStatsCardProps {
  predictionHistory: PredictionHistory[];
}

export const SystemStatsCard = ({ predictionHistory }: SystemStatsCardProps) => {
  return (
    <Card className="bg-gradient-to-br from-[#0EA5E9]/5 via-[#8B5CF6]/5 to-[#D946EF]/5 border-white/10 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Icon name="TrendingUp" size={24} className="text-[#0EA5E9]" />
        <h3 className="text-xl font-bold">Статистика точности системы</h3>
      </div>
      
      {predictionHistory.length > 0 ? (
        <>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="text-sm text-gray-400 mb-1">Всего прогнозов</div>
              <div className="text-3xl font-bold text-white">{predictionHistory.length}</div>
            </div>

            <div className="bg-white/5 rounded-lg p-4 border border-green-500/30">
              <div className="text-sm text-gray-400 mb-1">Успешных</div>
              <div className="text-3xl font-bold text-green-400">
                {predictionHistory.filter(p => p.isCorrect).length}
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-4 border border-red-500/30">
              <div className="text-sm text-gray-400 mb-1">Ошибок</div>
              <div className="text-3xl font-bold text-red-400">
                {predictionHistory.filter(p => !p.isCorrect).length}
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-4 border border-[#D946EF]/30">
              <div className="text-sm text-gray-400 mb-1">Точность</div>
              <div className="text-3xl font-bold text-[#D946EF]">
                {((predictionHistory.filter(p => p.isCorrect).length / predictionHistory.length) * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-2">Последние 5 прогнозов</div>
              <div className="flex gap-2">
                {predictionHistory.slice(-5).map((p) => (
                  <div 
                    key={p.id}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      p.isCorrect ? 'bg-green-500/20 border border-green-500' : 'bg-red-500/20 border border-red-500'
                    }`}
                  >
                    <Icon name={p.isCorrect ? "Check" : "X"} size={20} className={p.isCorrect ? "text-green-400" : "text-red-400"} />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-2">Средняя уверенность</div>
              <div className="flex items-center gap-3">
                <Progress 
                  value={predictionHistory.reduce((sum, p) => sum + p.confidence, 0) / predictionHistory.length} 
                  className="flex-1 h-3"
                />
                <span className="text-lg font-semibold text-[#0EA5E9]">
                  {(predictionHistory.reduce((sum, p) => sum + p.confidence, 0) / predictionHistory.length).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-gray-400 text-center">Пока нет данных о прогнозах</p>
        </div>
      )}
    </Card>
  );
};
