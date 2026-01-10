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

interface PredictionAnalyticsProps {
  history: HistoryEvent[];
  stats: {
    alpha: number;
    omega: number;
    total: number;
  };
  predictionHistory: PredictionHistory[];
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

export const PredictionAnalytics = ({ history, stats, predictionHistory }: PredictionAnalyticsProps) => {
  const analyzeSequencesForLength = (length: number): SequencePattern[] => {
    if (history.length < length) return [];
    
    const sequences = new Map<string, { count: number; nextAlpha: number; nextOmega: number; fullSequence: string }>();
    
    for (let i = 0; i < history.length - length + 1; i++) {
      const pattern = [];
      for (let j = 0; j < length - 1; j++) {
        pattern.push(history[i + j].column === 'alpha' ? 'α' : 'ω');
      }
      const patternStr = pattern.join('-');
      
      const nextEvent = history[i + length - 1].column === 'alpha' ? 'α' : 'ω';
      const fullSeq = patternStr + '-' + nextEvent;
      
      if (!sequences.has(patternStr)) {
        sequences.set(patternStr, { count: 0, nextAlpha: 0, nextOmega: 0, fullSequence: '' });
      }
      
      const data = sequences.get(patternStr)!;
      data.count++;
      if (nextEvent === 'α') {
        data.nextAlpha++;
      } else {
        data.nextOmega++;
      }
      data.fullSequence = fullSeq;
    }
    
    return Array.from(sequences.entries())
      .filter(([_, data]) => data.count >= 2)
      .map(([pattern, data]) => {
        const alphaProb = (data.nextAlpha / data.count) * 100;
        const omegaProb = (data.nextOmega / data.count) * 100;
        const maxProb = Math.max(alphaProb, omegaProb);
        
        return {
          length,
          pattern,
          fullSequence: data.fullSequence,
          count: data.count,
          nextAlpha: data.nextAlpha,
          nextOmega: data.nextOmega,
          prediction: alphaProb > omegaProb ? 'alpha' : 'omega',
          nextEvent: alphaProb > omegaProb ? 'α' : 'ω',
          confidence: maxProb,
          alphaProb,
          omegaProb,
          score: data.count * maxProb
        };
      })
      .filter(item => item.confidence >= 60);
  };

  const getAdaptiveAnalysis = () => {
    const patterns = analyzeSequencesForLength(5);
    
    const topOverall = patterns
      .sort((a, b) => {
        const timeFactor = 0.3;
        const scoreFactor = 0.7;
        return (b.score * scoreFactor) - (a.score * scoreFactor);
      })
      .slice(0, 5);
    
    return { topOverall };
  };

  const calculateStrategyAccuracy = (strategy: 'overall' | 'balance', windowSize: number = 10): number => {
    if (history.length < 5) return 0;
    
    let correct = 0;
    let total = 0;
    const startIdx = Math.max(5, history.length - windowSize);
    
    for (let i = startIdx; i < history.length; i++) {
      const pattern = history.slice(i - 4, i).map(e => e.column === 'alpha' ? 'α' : 'ω').join('-');
      const actual = history[i].column;
      
      const matches: { event: Column, pos: number }[] = [];
      for (let j = 0; j < i - 4; j++) {
        const histPattern = history.slice(j, j + 4).map(e => e.column === 'alpha' ? 'α' : 'ω').join('-');
        if (histPattern === pattern) {
          matches.push({ event: history[j + 4].column, pos: j });
        }
      }
      
      if (matches.length === 0) continue;
      
      let predicted: Column;
      
      if (strategy === 'balance') {
        const currentAlpha = history.slice(0, i).filter(e => e.column === 'alpha').length;
        const currentOmega = history.slice(0, i).filter(e => e.column === 'omega').length;
        const imbalance = currentAlpha - currentOmega;
        
        const alphaC = matches.filter(m => m.event === 'alpha').length;
        const omegaC = matches.filter(m => m.event === 'omega').length;
        const patternPrediction: Column = alphaC >= omegaC ? 'alpha' : 'omega';
        
        if (Math.abs(imbalance) >= 3) {
          const balancePrediction: Column = imbalance > 0 ? 'omega' : 'alpha';
          const balanceWeight = Math.min(0.7, Math.abs(imbalance) / 10);
          const patternWeight = 1 - balanceWeight;
          
          if (balancePrediction === patternPrediction) {
            predicted = patternPrediction;
          } else {
            predicted = balanceWeight > patternWeight ? balancePrediction : patternPrediction;
          }
        } else {
          predicted = patternPrediction;
        }
      } else {
        const alphaC = matches.filter(m => m.event === 'alpha').length;
        const omegaC = matches.filter(m => m.event === 'omega').length;
        predicted = alphaC >= omegaC ? 'alpha' : 'omega';
      }
      
      if (predicted === actual) correct++;
      total++;
    }
    
    return total > 0 ? (correct / total) * 100 : 0;
  };

  const getAdaptivePrediction = (): AdaptivePrediction | null => {
    if (history.length < 5) return null;
    
    const recent4 = history.slice(-4).map(e => e.column === 'alpha' ? 'α' : 'ω').join('-');
    
    const overallAccuracy = calculateStrategyAccuracy('overall');
    const balanceAccuracy = calculateStrategyAccuracy('balance');
    
    const bestStrategy = balanceAccuracy >= overallAccuracy ? 'balance' : 'overall';
    
    const matches: { event: Column, pos: number }[] = [];
    for (let j = 0; j < history.length - 4; j++) {
      const histPattern = history.slice(j, j + 4).map(e => e.column === 'alpha' ? 'α' : 'ω').join('-');
      if (histPattern === recent4) {
        matches.push({ event: history[j + 4].column, pos: j });
      }
    }
    
    if (matches.length === 0) return null;
    
    const currentAlpha = history.filter(e => e.column === 'alpha').length;
    const currentOmega = history.filter(e => e.column === 'omega').length;
    const imbalance = currentAlpha - currentOmega;
    const totalEvents = history.length;
    
    let prediction: Column;
    let confidence: number;
    let strategyName: string;
    
    if (bestStrategy === 'balance') {
      const alphaC = matches.filter(m => m.event === 'alpha').length;
      const omegaC = matches.filter(m => m.event === 'omega').length;
      const patternPrediction: Column = alphaC >= omegaC ? 'alpha' : 'omega';
      
      if (Math.abs(imbalance) >= 3) {
        const balancePrediction: Column = imbalance > 0 ? 'omega' : 'alpha';
        const balanceWeight = Math.min(0.7, Math.abs(imbalance) / totalEvents * 2);
        const patternWeight = 1 - balanceWeight;
        
        if (balancePrediction === patternPrediction) {
          prediction = patternPrediction;
          const dominant = Math.max(alphaC, omegaC);
          confidence = Math.min(95, 65 + (dominant / matches.length) * 30 + balanceWeight * 15);
        } else {
          prediction = balanceWeight > 0.5 ? balancePrediction : patternPrediction;
          const baseConfidence = balanceWeight > 0.5 ? 60 : 55;
          confidence = Math.min(90, baseConfidence + Math.abs(imbalance) * 3);
        }
        strategyName = `⚖️ Баланс (дисбаланс: ${imbalance > 0 ? '+' : ''}${imbalance})`;
      } else {
        prediction = patternPrediction;
        const dominant = Math.max(alphaC, omegaC);
        confidence = Math.min(95, 60 + (dominant / matches.length) * 35);
        strategyName = '⚖️ Баланс (паттерн)';
      }
    } else {
      const alphaC = matches.filter(m => m.event === 'alpha').length;
      const omegaC = matches.filter(m => m.event === 'omega').length;
      prediction = alphaC >= omegaC ? 'alpha' : 'omega';
      const dominant = Math.max(alphaC, omegaC);
      confidence = Math.min(95, 55 + (dominant / matches.length) * 40);
      strategyName = '🎯 Паттерн';
    }
    
    if (confidence < 60) return null;
    
    const alphaCount = matches.filter(m => m.event === 'alpha').length;
    const omegaCount = matches.filter(m => m.event === 'omega').length;
    const alphaProb = (alphaCount / matches.length) * 100;
    const omegaProb = (omegaCount / matches.length) * 100;
    
    return {
      pattern: recent4,
      fullSequence: recent4 + '-' + (prediction === 'alpha' ? 'α' : 'ω'),
      nextEvent: prediction === 'alpha' ? 'α' : 'ω',
      prediction,
      confidence,
      alphaProb,
      omegaProb,
      occurrences: matches.length,
      length: 5,
      score: matches.length * confidence,
      strategyName,
      strategyAccuracy: bestStrategy === 'balance' ? balanceAccuracy : overallAccuracy,
      imbalance,
      balanceInfo: `α:${currentAlpha} ω:${currentOmega}`
    };
  };

  const { topOverall: topSequences } = getAdaptiveAnalysis();
  const prediction = getAdaptivePrediction();

  return (
    <>
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

      <Card className="bg-white/5 border-white/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Icon name="Target" size={24} className="text-[#D946EF]" />
          <h3 className="text-xl font-bold">Адаптивный выбор стратегии</h3>
        </div>
        
        {history.length >= 10 ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">⚖️</span>
                  <span className="font-semibold text-sm">Баланс 50/50</span>
                </div>
                <p className="text-xs text-gray-400 mb-2">Стремление к равновесию</p>
                <div className="flex items-center gap-2">
                  <Progress value={calculateStrategyAccuracy('balance')} className="flex-1 h-2" />
                  <span className="text-sm font-semibold text-[#0EA5E9]">
                    {calculateStrategyAccuracy('balance').toFixed(1)}%
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
                  <Progress value={calculateStrategyAccuracy('overall')} className="flex-1 h-2" />
                  <span className="text-sm font-semibold text-[#0EA5E9]">
                    {calculateStrategyAccuracy('overall').toFixed(1)}%
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
    </>
  );
};