import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import { Column, AlgorithmPrediction, MethodStats } from '@/types/prediction';

interface PredictionDisplayProps {
  ensemblePrediction: { column: Column; confidence: number } | null;
  lastPredictionResult: 'correct' | 'incorrect' | null;
  timeLeft: number;
  currentSuccess: Column | null;
  predictions: AlgorithmPrediction[];
  methodStats: MethodStats[];
}

export const PredictionDisplay = ({
  ensemblePrediction,
  lastPredictionResult,
  timeLeft,
  currentSuccess,
  predictions,
  methodStats
}: PredictionDisplayProps) => {
  return (
    <>
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
              {methodStats
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
    </>
  );
};
