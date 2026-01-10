import { useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from '@/hooks/use-toast';

type Column = 'alpha' | 'omega';

interface CaptureArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ScreenCaptureSectionProps {
  isCapturing: boolean;
  setIsCapturing: (value: boolean) => void;
  isRunning: boolean;
  setIsRunning: (value: boolean) => void;
  isPaused: boolean;
  setIsPaused: (value: boolean) => void;
  captureArea: CaptureArea | null;
  setCaptureArea: (area: CaptureArea | null) => void;
  onReset: () => void;
  onExportCSV: () => void;
  historyLength: number;
  onEventDetected: (column: Column) => void;
}

export const ScreenCaptureSection = ({
  isCapturing,
  setIsCapturing,
  isRunning,
  setIsRunning,
  isPaused,
  setIsPaused,
  captureArea,
  setCaptureArea,
  onReset,
  onExportCSV,
  historyLength,
  onEventDetected
}: ScreenCaptureSectionProps) => {
  const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);
  const [isSelectingArea, setIsSelectingArea] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [currentMousePos, setCurrentMousePos] = useState<{ x: number; y: number } | null>(null);
  const [lastRecognizedText, setLastRecognizedText] = useState<string>('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const startScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' }
      });
      
      setCaptureStream(stream);
      setIsCapturing(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenCapture();
      });

      toast({
        title: "Захват экрана запущен",
        description: "Теперь выберите область для распознавания",
      });

      setTimeout(() => {
        setIsSelectingArea(true);
      }, 500);
    } catch (error) {
      toast({
        title: "Ошибка захвата",
        description: "Не удалось начать захват экрана",
        variant: "destructive"
      });
    }
  };

  const stopScreenCapture = () => {
    if (captureStream) {
      captureStream.getTracks().forEach(track => track.stop());
      setCaptureStream(null);
    }
    setIsCapturing(false);
    setCaptureArea(null);
    setIsSelectingArea(false);
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelectingArea || !previewCanvasRef.current) return;
    
    const canvas = previewCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 640 / rect.width;
    const scaleY = 360 / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    setSelectionStart({ x, y });
    setCurrentMousePos({ x, y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelectingArea || !selectionStart || !previewCanvasRef.current) return;
    
    const canvas = previewCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 640 / rect.width;
    const scaleY = 360 / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    setCurrentMousePos({ x, y });
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelectingArea || !selectionStart || !previewCanvasRef.current) return;
    
    const canvas = previewCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 640 / rect.width;
    const scaleY = 360 / rect.height;
    
    const endX = (e.clientX - rect.left) * scaleX;
    const endY = (e.clientY - rect.top) * scaleY;
    
    const x = Math.min(selectionStart.x, endX);
    const y = Math.min(selectionStart.y, endY);
    const width = Math.abs(endX - selectionStart.x);
    const height = Math.abs(endY - selectionStart.y);
    
    if (width > 20 && height > 20) {
      const videoScaleX = videoRef.current ? videoRef.current.videoWidth / 640 : 1;
      const videoScaleY = videoRef.current ? videoRef.current.videoHeight / 360 : 1;
      
      setCaptureArea({
        x: Math.round(x * videoScaleX),
        y: Math.round(y * videoScaleY),
        width: Math.round(width * videoScaleX),
        height: Math.round(height * videoScaleY)
      });
      
      setIsSelectingArea(false);
      
      toast({
        title: "Область выбрана",
        description: "Теперь нажмите 'Начать' для запуска распознавания",
      });
    }
    
    setSelectionStart(null);
    setCurrentMousePos(null);
  };

  const handleReselectArea = () => {
    setCaptureArea(null);
    setIsSelectingArea(true);
    toast({
      title: "Выбор области",
      description: "Нарисуйте новый прямоугольник на превью",
    });
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current || !captureArea || isPaused) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = captureArea.width;
    canvas.height = captureArea.height;

    ctx.drawImage(
      videoRef.current,
      captureArea.x,
      captureArea.y,
      captureArea.width,
      captureArea.height,
      0,
      0,
      captureArea.width,
      captureArea.height
    );

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let totalBlue = 0;
    let totalPurple = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const blueScore = b - (r + g) / 2;
      if (blueScore > 30) {
        totalBlue++;
      }

      const purpleScore = (r + b) / 2 - g;
      if (purpleScore > 30 && r > 100) {
        totalPurple++;
      }
    }

    const bluePercent = (totalBlue / pixelCount) * 100;
    const purplePercent = (totalPurple / pixelCount) * 100;

    let detectedColumn: Column | null = null;

    if (bluePercent > 5 && bluePercent > purplePercent) {
      detectedColumn = 'alpha';
      setLastRecognizedText('Альфа');
    } else if (purplePercent > 5) {
      detectedColumn = 'omega';
      setLastRecognizedText('Омега');
    }

    if (detectedColumn) {
      onEventDetected(detectedColumn);
    }
  };

  const updatePreview = () => {
    if (!videoRef.current || !previewCanvasRef.current) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || !videoRef.current.videoWidth) return;

    ctx.clearRect(0, 0, 640, 360);
    ctx.drawImage(videoRef.current, 0, 0, 640, 360);

    if (captureArea && !isSelectingArea) {
      const scaleX = 640 / videoRef.current.videoWidth;
      const scaleY = 360 / videoRef.current.videoHeight;
      
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        captureArea.x * scaleX,
        captureArea.y * scaleY,
        captureArea.width * scaleX,
        captureArea.height * scaleY
      );
    }

    if (isSelectingArea && selectionStart && currentMousePos) {
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        selectionStart.x,
        selectionStart.y,
        currentMousePos.x - selectionStart.x,
        currentMousePos.y - selectionStart.y
      );
    }

    requestAnimationFrame(updatePreview);
  };

  const handleStart = () => {
    setIsRunning(true);
    setIsPaused(false);
    toast({
      title: "Система запущена",
      description: "Начато автоматическое распознавание",
    });
  };

  const handleStop = () => {
    setIsRunning(false);
    setIsPaused(false);
    toast({
      title: "Система остановлена",
      description: "Распознавание приостановлено",
    });
  };

  const handlePauseResume = () => {
    setIsPaused(!isPaused);
    toast({
      title: isPaused ? "Система возобновлена" : "Система на паузе",
      description: isPaused ? "Распознавание продолжено" : "Таймер остановлен",
    });
  };

  // Effect для захвата и анализа каждые 30 секунд
  if (isRunning && !isPaused && captureArea) {
    const interval = setInterval(() => {
      captureAndAnalyze();
    }, 30000);
    return () => clearInterval(interval);
  }

  // Effect для обновления превью
  if (isCapturing && videoRef.current) {
    updatePreview();
  }

  return (
    <>
      <video ref={videoRef} className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex gap-3 justify-center flex-wrap">
        <Button
          onClick={isCapturing ? stopScreenCapture : startScreenCapture}
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
                onClick={handleStart}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-90 text-white text-lg px-8 py-6"
                disabled={!captureArea}
              >
                <Icon name="Play" size={24} className="mr-2" />
                Начать
              </Button>
            ) : (
              <Button
                onClick={handleStop}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:opacity-90 text-white text-lg px-8 py-6"
              >
                <Icon name="Square" size={24} className="mr-2" />
                Стоп
              </Button>
            )}

            <Button
              onClick={handlePauseResume}
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

      {!isCapturing && (
        <Card className="bg-blue-500/10 border-blue-500/30 p-4">
          <div className="flex items-center gap-3">
            <Icon name="Info" size={20} className="text-blue-400" />
            <span className="text-blue-400 font-semibold">Шаг 1: Нажмите "Начать захват экрана" для активации системы распознавания</span>
          </div>
        </Card>
      )}

      {isCapturing && !captureArea && (
        <Card className="bg-yellow-500/10 border-yellow-500/30 p-4">
          <div className="flex items-center gap-3">
            <Icon name="Target" size={20} className="text-yellow-400" />
            <span className="text-yellow-400 font-semibold">Шаг 2: Выберите область на экране для отслеживания (нарисуйте прямоугольник мышью)</span>
          </div>
        </Card>
      )}

      {isCapturing && captureArea && !isRunning && (
        <Card className="bg-green-500/10 border-green-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-400 font-semibold">Область выбрана! Шаг 3: Нажмите "Начать" для запуска распознавания цвета каждые 30 секунд</span>
          </div>
        </Card>
      )}

      {isCapturing && isRunning && !isPaused && (
        <Card className="bg-green-500/10 border-green-500/30 p-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-400 font-semibold">Система работает - распознавание цвета активно (каждые 30 секунд)</span>
          </div>
        </Card>
      )}

      {isPaused && (
        <Card className="bg-yellow-500/10 border-yellow-500/30 p-4">
          <div className="flex items-center gap-3">
            <Icon name="Pause" size={20} className="text-yellow-400" />
            <span className="text-yellow-400 font-semibold">Система на паузе - таймер остановлен</span>
          </div>
        </Card>
      )}

      {isCapturing && captureArea && !isRunning && historyLength > 0 && (
        <Card className="bg-orange-500/10 border-orange-500/30 p-4">
          <div className="flex items-center gap-3">
            <Icon name="AlertCircle" size={20} className="text-orange-400" />
            <span className="text-orange-400 font-semibold">Система остановлена - нажмите "Начать" для продолжения</span>
          </div>
        </Card>
      )}

      {isCapturing && (
        <Card className="bg-white/5 border-white/10 p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Icon name="Video" size={20} className="text-[#8B5CF6]" />
                Превью захвата экрана
              </h3>
              {lastRecognizedText && (
                <Badge className="bg-[#0EA5E9]">
                  Распознано: {lastRecognizedText}
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-400">
              {isSelectingArea 
                ? 'Нарисуйте прямоугольник вокруг голубой (Альфа) или фиолетовой (Омега) области'
                : captureArea 
                  ? 'Область выбрана (синий прямоугольник). Система определяет доминирующий цвет: голубой = Альфа, фиолетовый = Омега.'
                  : 'Ожидание выбора области...'
              }
            </p>
            <div className="space-y-2">
              <canvas
                ref={previewCanvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                className={`w-full border-2 ${
                  isSelectingArea ? 'border-yellow-500 cursor-crosshair' : 'border-white/20'
                } rounded-lg`}
                width={640}
                height={360}
              />
              {captureArea && !isRunning && (
                <Button
                  onClick={handleReselectArea}
                  variant="outline"
                  className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/10 w-full"
                >
                  <Icon name="RefreshCw" size={16} className="mr-2" />
                  Изменить область захвата
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}
    </>
  );
};