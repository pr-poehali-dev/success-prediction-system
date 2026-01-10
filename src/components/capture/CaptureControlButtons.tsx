import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface CaptureControlButtonsProps {
  isCapturing: boolean;
  isRunning: boolean;
  isPaused: boolean;
  captureArea: { x: number; y: number; width: number; height: number } | null;
  historyLength: number;
  onStartCapture: () => void;
  onStopCapture: () => void;
  onStart: () => void;
  onStop: () => void;
  onPauseResume: () => void;
  onReset: () => void;
  onExportCSV: () => void;
}

export const CaptureControlButtons = ({
  isCapturing,
  isRunning,
  isPaused,
  captureArea,
  historyLength,
  onStartCapture,
  onStopCapture,
  onStart,
  onStop,
  onPauseResume,
  onReset,
  onExportCSV
}: CaptureControlButtonsProps) => {
  return (
    <div className="flex gap-3 justify-center flex-wrap">
      <Button
        onClick={isCapturing ? onStopCapture : onStartCapture}
        className={`${
          isCapturing 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-gradient-to-r from-[#8B5CF6] to-[#0EA5E9] hover:opacity-90'
        } text-lg px-8 py-6`}
      >
        <Icon name={isCapturing ? "StopCircle" : "Monitor"} size={24} className="mr-2" />
        {isCapturing ? 'Остановить захват' : 'Начать захват экрана'}
      </Button>

      {isCapturing && (
        <>
          {!isRunning ? (
            <Button
              onClick={onStart}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-90 text-white text-lg px-8 py-6"
              disabled={!captureArea}
            >
              <Icon name="Play" size={24} className="mr-2" />
              Начать
            </Button>
          ) : (
            <Button
              onClick={onStop}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:opacity-90 text-white text-lg px-8 py-6"
            >
              <Icon name="Square" size={24} className="mr-2" />
              Стоп
            </Button>
          )}

          <Button
            onClick={onPauseResume}
            variant="outline"
            className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!isRunning}
          >
            <Icon name={isPaused ? "Play" : "Pause"} size={20} className="mr-2" />
            {isPaused ? 'Возобновить' : 'Пауза'}
          </Button>

          <Button
            onClick={onReset}
            variant="outline"
            className="border-red-500 text-red-400 hover:bg-red-500/10"
          >
            <Icon name="RotateCcw" size={20} className="mr-2" />
            Сброс
          </Button>

          {historyLength > 0 && (
            <Button
              onClick={onExportCSV}
              variant="outline"
              className="border-[#8B5CF6] text-[#8B5CF6] hover:bg-[#8B5CF6]/10"
            >
              <Icon name="Download" size={20} className="mr-2" />
              Экспорт в CSV
            </Button>
          )}
        </>
      )}
    </div>
  );
};
