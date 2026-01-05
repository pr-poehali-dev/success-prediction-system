import { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { CaptureArea } from '@/types/prediction';

interface ScreenCaptureProps {
  isCapturing: boolean;
  isRunning: boolean;
  isPaused: boolean;
  captureArea: CaptureArea | null;
  lastRecognizedText: string;
  onStartCapture: () => void;
  onStopCapture: () => void;
  onPauseResume: () => void;
  onStop: () => void;
  onAreaSelect: (area: CaptureArea | null) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  previewCanvasRef: React.RefObject<HTMLCanvasElement>;
}

export const ScreenCapture = ({
  isCapturing,
  isRunning,
  isPaused,
  captureArea,
  lastRecognizedText,
  onStartCapture,
  onStopCapture,
  onPauseResume,
  onStop,
  onAreaSelect,
  videoRef,
  canvasRef,
  previewCanvasRef
}: ScreenCaptureProps) => {
  const isSelectingAreaRef = useRef(false);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCapturing || isRunning) return;

    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    isSelectingAreaRef.current = true;
    selectionStartRef.current = { x, y };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelectingAreaRef.current || !selectionStartRef.current) return;

    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const area: CaptureArea = {
      x: Math.min(selectionStartRef.current.x, x),
      y: Math.min(selectionStartRef.current.y, y),
      width: Math.abs(x - selectionStartRef.current.x),
      height: Math.abs(y - selectionStartRef.current.y)
    };

    onAreaSelect(area);
  };

  const handleCanvasMouseUp = () => {
    if (isSelectingAreaRef.current && captureArea && captureArea.width > 10 && captureArea.height > 10) {
      isSelectingAreaRef.current = false;
      selectionStartRef.current = null;
    }
  };

  useEffect(() => {
    if (!isCapturing || !videoRef.current || !previewCanvasRef.current) return;

    const drawPreview = () => {
      const video = videoRef.current;
      const canvas = previewCanvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.drawImage(video, 0, 0);

      if (captureArea) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(captureArea.x, captureArea.y, captureArea.width, captureArea.height);
      }

      requestAnimationFrame(drawPreview);
    };

    drawPreview();
  }, [isCapturing, captureArea, videoRef, previewCanvasRef]);

  return (
    <Card className="bg-slate-800/50 border-purple-500/30 p-6">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Icon name="Monitor" className="text-blue-400" size={24} />
        Захват экрана
      </h2>

      <div className="space-y-4">
        {!isCapturing ? (
          <Button 
            onClick={onStartCapture}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Icon name="ScreenShare" className="mr-2" size={20} />
            Начать захват экрана
          </Button>
        ) : (
          <>
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <video 
                ref={videoRef} 
                className="hidden"
                autoPlay 
                playsInline 
                muted
              />
              <canvas 
                ref={canvasRef} 
                className="hidden"
              />
              <canvas 
                ref={previewCanvasRef}
                className="w-full h-full cursor-crosshair"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
              />
              
              {!isRunning && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
                  <div className="text-white text-center">
                    <Icon name="MousePointer" className="mx-auto mb-2 text-purple-400" size={48} />
                    <p className="text-lg">Выделите область для анализа</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={onPauseResume}
                className={`flex-1 ${isPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                disabled={!captureArea}
              >
                <Icon name={isPaused ? "Play" : isRunning ? "Pause" : "Play"} className="mr-2" size={20} />
                {isPaused ? 'Продолжить' : isRunning ? 'Пауза' : 'Старт'}
              </Button>
              
              <Button 
                onClick={onStop}
                variant="destructive"
                className="flex-1"
                disabled={!isRunning}
              >
                <Icon name="Square" className="mr-2" size={20} />
                Стоп
              </Button>

              <Button 
                onClick={onStopCapture}
                variant="outline"
                className="flex-1"
              >
                <Icon name="X" className="mr-2" size={20} />
                Завершить
              </Button>
            </div>

            {lastRecognizedText && (
              <div className="bg-slate-700/50 p-3 rounded-lg">
                <p className="text-slate-300 text-sm">
                  <Icon name="Info" className="inline mr-2" size={16} />
                  {lastRecognizedText}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
};
