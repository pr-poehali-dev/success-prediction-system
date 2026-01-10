import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';

interface StrategySelectionCardProps {
  historyLength: number;
  balanceAccuracy: number;
  overallAccuracy: number;
}

export const StrategySelectionCard = ({ historyLength, balanceAccuracy, overallAccuracy }: StrategySelectionCardProps) => {
  return (
    <Card className="bg-white/5 border-white/10 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Icon name="Target" size={24} className="text-[#D946EF]" />
        <h3 className="text-xl font-bold">Адаптивный выбор стратегии</h3>
      </div>
      
      {historyLength >= 10 ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">⚖️</span>
                <span className="font-semibold text-sm">Баланс 50/50</span>
              </div>
              <p className="text-xs text-gray-400 mb-2">Стремление к равновесию</p>
              <div className="flex items-center gap-2">
                <Progress value={balanceAccuracy} className="flex-1 h-2" />
                <span className="text-sm font-semibold text-[#0EA5E9]">
                  {balanceAccuracy.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🎯</span>
                <span className="font-semibold text-sm">Паттерн</span>
              </div>
              <p className="text-xs text-gray-400 mb-2">Анализ последовательностей</p>
              <div className="flex items-center gap-2">
                <Progress value={overallAccuracy} className="flex-1 h-2" />
                <span className="text-sm font-semibold text-[#0EA5E9]">
                  {overallAccuracy.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-[#D946EF]/10 border border-[#D946EF]/30 rounded-lg">
            <p className="text-sm text-gray-300">
              <Icon name="Info" size={16} className="inline mr-2 text-[#D946EF]" />
              Система автоматически выбирает стратегию с наилучшей точностью. <strong>Стратегия Баланс</strong> учитывает стремление к равновесию 50/50 между α и ω.
            </p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-gray-400 text-center">Накопите минимум 10 событий для анализа стратегий</p>
        </div>
      )}
    </Card>
  );
};
