import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Column, HistoryEvent } from '@/types/prediction';

interface HistoryPanelProps {
  history: HistoryEvent[];
  onAddManual: (column: Column) => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onReset: () => void;
}

export const HistoryPanel = ({
  history,
  onAddManual,
  onExportJSON,
  onExportCSV,
  onReset
}: HistoryPanelProps) => {
  return (
    <Card className="bg-slate-800/50 border-purple-500/30 p-6">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Icon name="History" className="text-orange-400" size={24} />
        История ({history.length})
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <Button 
          onClick={() => onAddManual('alpha')}
          className="bg-green-600 hover:bg-green-700"
        >
          <Icon name="Plus" className="mr-2" size={20} />
          АЛЬФА
        </Button>
        
        <Button 
          onClick={() => onAddManual('omega')}
          className="bg-red-600 hover:bg-red-700"
        >
          <Icon name="Plus" className="mr-2" size={20} />
          ОМЕГА
        </Button>

        <Button 
          onClick={onExportJSON}
          variant="outline"
          disabled={history.length === 0}
        >
          <Icon name="Download" className="mr-2" size={20} />
          JSON
        </Button>

        <Button 
          onClick={onExportCSV}
          variant="outline"
          disabled={history.length === 0}
        >
          <Icon name="FileSpreadsheet" className="mr-2" size={20} />
          CSV
        </Button>

        <Button 
          onClick={onReset}
          variant="outline"
        >
          <Icon name="RotateCcw" className="mr-2" size={20} />
          Сброс
        </Button>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {history.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            <Icon name="Inbox" className="mx-auto mb-2 text-slate-600" size={48} />
            <p>История пуста</p>
          </div>
        ) : (
          history.slice().reverse().map((event) => (
            <div 
              key={event.id}
              className={`p-3 rounded-lg flex items-center justify-between ${
                event.column === 'alpha' 
                  ? 'bg-green-900/30 border border-green-500/30' 
                  : 'bg-red-900/30 border border-red-500/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <Badge className={`${
                  event.column === 'alpha' 
                    ? 'bg-green-600' 
                    : 'bg-red-600'
                } text-white px-3 py-1`}>
                  {event.column === 'alpha' ? 'АЛЬФА' : 'ОМЕГА'}
                </Badge>
                <span className="text-slate-300 text-sm">
                  {event.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <Badge variant="outline" className="text-xs">
                <Icon 
                  name={event.source === 'screen' ? 'Monitor' : 'Hand'} 
                  className="mr-1" 
                  size={12} 
                />
                {event.source === 'screen' ? 'Экран' : 'Вручную'}
              </Badge>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
