import { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { toast } from '@/hooks/use-toast';
import { CaptureArea } from '@/types/prediction';

interface ScreenCaptureProps {
  isCapturing: boolean;
  isRunning: boolean;
  isPaused: boolean;
  captureArea: CaptureArea | null;
  lastRecognizedText: string;
  captureLogs: string[];
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
  captureLogs,
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
      
      toast({
        title: "Область выбрана",
        description: "Нажмите 'Старт' для начала распознавания",
      });
    }
  };

  useEffect(() => {
    if (!isCapturing || !videoRef.current || !previewCanvasRef.current) return;

    const video = videoRef.current;
    const canvas = previewCanvasRef.current;
    let animationId: number;

    const drawPreview = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationId = requestAnimationFrame(drawPreview);
        return;
      }

      if (video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        ctx.drawImage(video, 0, 0);

        if (captureArea) {
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 4;
          ctx.strokeRect(captureArea.x, captureArea.y, captureArea.width, captureArea.height);
          
          // Полупрозрачная заливка
          ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
          ctx.fillRect(captureArea.x, captureArea.y, captureArea.width, captureArea.height);
        }
      }

      animationId = requestAnimationFrame(drawPreview);
    };

    drawPreview();

    return () => cancelAnimationFrame(animationId);
  }, [isCapturing, captureArea]);

  return (
    <Card className="bg-slate-800/50 border-purple-500/30 p-6">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Icon name="Monitor" className="text-blue-400" size={24} />
        Захват экрана
      </h2>

      <div className="space-y-4">
        {!isCapturing ? (
          <>
            <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <Icon name="AlertTriangle" className="text-yellow-400 flex-shrink-0 mt-1" size={20} />
                <div className="text-sm text-yellow-200">
                  <p className="font-semibold mb-2">Яндекс.Браузер блокирует захват экрана</p>
                  <p className="mb-2">🔧 <strong>Решение проблемы:</strong></p>
                  <ol className="list-decimal ml-5 space-y-1">
                    <li>Откройте сайт в <strong>Google Chrome</strong> (скачать: chrome.google.com)</li>
                    <li>Или используйте <strong>Edge</strong> (встроен в Windows)</li>
                    <li>Или напишите в поддержку: <strong>t.me/+QgiLIa1gFRY4Y2Iy</strong></li>
                  </ol>
                </div>
              </div>
            </div>
            
            <Button 
              onClick={onStartCapture}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Icon name="ScreenShare" className="mr-2" size={20} />
              Начать захват экрана
            </Button>
            
            <div className="text-center text-slate-400 text-sm">
              <p>💬 Помощь: <a href="https://t.me/+QgiLIa1gFRY4Y2Iy" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">Telegram-сообщество</a></p>
            </div>
            
            {captureLogs.length > 0 && (
              <div className="bg-slate-900/80 border border-purple-500/30 rounded-lg p-3 mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="Terminal" className="text-green-400" size={16} />
                  <span className="text-xs font-mono text-green-400">Логи диагностики</span>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {captureLogs.map((log, idx) => (
                    <div key={idx} className="text-xs font-mono text-slate-300">{log}</div>
                  ))}
                </div>
              </div>
            )}
          </>
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
              
              {!isRunning && !captureArea && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-purple-600/90 px-4 py-2 rounded-lg pointer-events-none shadow-lg">
                  <div className="text-white text-center flex items-center gap-2">
                    <Icon name="MousePointer" className="text-white" size={20} />
                    <p className="text-sm font-semibold">Выделите область мышкой</p>
                  </div>
                </div>
              )}
              
              {!isRunning && captureArea && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
                  <div className="bg-green-600/90 px-4 py-2 rounded-lg shadow-lg animate-pulse">
                    <div className="text-white text-center flex items-center gap-2">
                      <Icon name="CheckCircle" className="text-white" size={20} />
                      <p className="text-sm font-semibold">Область выбрана! Нажмите "Начать захват"</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {!isRunning && captureArea && (
              <Button 
                onClick={onPauseResume}
                className="w-full bg-green-600 hover:bg-green-700 text-lg py-6"
                size="lg"
              >
                <Icon name="Play" className="mr-2" size={24} />
                Начать захват
              </Button>
            )}

            {isRunning && (
              <>

                <div className="flex gap-2">
                  <Button 
                    onClick={onPauseResume}
                    className={`flex-1 ${isPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                  >
                    <Icon name={isPaused ? "Play" : "Pause"} className="mr-2" size={20} />
                    {isPaused ? 'Продолжить' : 'Пауза'}
                  </Button>
                  
                  <Button 
                    onClick={onStop}
                    variant="destructive"
                    className="flex-1"
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
              </>
            )}
            
            {!isRunning && (
              <Button 
                onClick={onStopCapture}
                variant="outline"
                className="w-full"
              >
                <Icon name="X" className="mr-2" size={20} />
                Завершить захват экрана
              </Button>
            )}

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