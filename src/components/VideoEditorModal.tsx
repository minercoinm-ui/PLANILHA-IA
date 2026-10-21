import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Video,
  Play,
  Pause,
  RotateCcw,
  Download,
  Settings,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
  Building2,
  Type,
  Palette,
  Clock,
  Film,
  ArrowUp,
  ArrowDown,
  Check,
  RefreshCw,
  ShieldCheck,
  QrCode,
  Loader2,
} from 'lucide-react';
import {
  VideoConfig,
  VideoTheme,
  VideoFormat,
  VideoJobStatus,
} from '../types/video';
import { ChartConfig } from '../types';
import { MetricCardValue, formatCurrencyBRL } from '../lib/dataProcessor';
import {
  renderVideoFrame,
  VIDEO_CANVAS_WIDTH,
  VIDEO_CANVAS_HEIGHT,
  VIDEO_TOTAL_DURATION_SEC,
  PreparedChartData,
  THEMES,
} from '../lib/videoEngine';
import { PixPaymentModal } from './PixPaymentModal';
import { downloadVideoWithVerification, DownloadProgressInfo } from '../lib/videoDownloader';

interface VideoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetName: string;
  charts: { config: ChartConfig; data: { dimension: string; metric: number }[] }[];
  metrics: MetricCardValue[];
  onOpenHistory: () => void;
}

export const VideoEditorModal: React.FC<VideoEditorModalProps> = ({
  isOpen,
  onClose,
  datasetName,
  charts,
  metrics,
  onOpenHistory,
}) => {
  // Selected charts for video (defaults to up to 2 charts)
  const [selectedChartIds, setSelectedChartIds] = useState<string[]>(() => {
    return charts.slice(0, 2).map((c) => c.config.id);
  });

  // Presentation Metadata
  const [title, setTitle] = useState<string>(() => `Relatório Executivo • ${datasetName}`);
  const [subtitle, setSubtitle] = useState<string>('Desempenho Comercial & Indicadores Chave');
  const [companyName, setCompanyName] = useState<string>('Sua Empresa');
  const [theme, setTheme] = useState<VideoTheme>('corporate_blue');
  const [format, setFormat] = useState<VideoFormat>('mp4');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);

  // Pricing info
  const [videoPrice, setVideoPrice] = useState<number>(14.90);

  // Fetch current video price
  useEffect(() => {
    fetch('/api/public/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.pricing?.videoPrice) {
          setVideoPrice(data.pricing.videoPrice);
        }
      })
      .catch(() => {});
  }, []);

  // Handle Logo Upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => setLogoImage(img);
    }
  };

  // Canvas & Preview State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0); // 0 to 15s
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Render Job State
  const [jobStatus, setJobStatus] = useState<VideoJobStatus | null>(null);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressInfo | null>(null);

  // Pix payment modal state
  const [showPixModal, setShowPixModal] = useState<boolean>(false);
  const [activePaidTaskId, setActivePaidTaskId] = useState<string | null>(null);

  // Prepared chart items ordered by selection
  const orderedCharts: PreparedChartData[] = useMemo(() => {
    return selectedChartIds
      .map((id) => charts.find((c) => c.config.id === id))
      .filter(Boolean) as PreparedChartData[];
  }, [selectedChartIds, charts]);

  const videoConfig: VideoConfig = useMemo(
    () => ({
      title,
      subtitle,
      companyName,
      theme,
      format,
      resolution: '1080p',
      durationSeconds: VIDEO_TOTAL_DURATION_SEC,
      selectedChartIds,
    }),
    [title, subtitle, companyName, theme, format, selectedChartIds]
  );

  // Paint single frame to preview canvas
  const drawCurrentFrame = (timeSec: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderVideoFrame(
      ctx,
      VIDEO_CANVAS_WIDTH,
      VIDEO_CANVAS_HEIGHT,
      timeSec,
      videoConfig,
      metrics,
      orderedCharts,
      logoImage
    );
  };

  // Draw current frame on config changes
  useEffect(() => {
    if (!isPlaying) {
      drawCurrentFrame(currentTime);
    }
  }, [currentTime, videoConfig, metrics, orderedCharts, logoImage]);

  // Animation Loop for Player
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = null;
      return;
    }

    const loop = (now: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
      }
      const deltaSec = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      setCurrentTime((prev) => {
        const nextTime = prev + deltaSec;
        if (nextTime >= VIDEO_TOTAL_DURATION_SEC) {
          setIsPlaying(false);
          return 0;
        }
        drawCurrentFrame(nextTime);
        return nextTime;
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying]);

  // Click Handler for "Gerar Vídeo em Full HD"
  const handleInitiateRender = () => {
    if (activePaidTaskId) {
      // Already paid, start rendering directly
      runVideoRenderingPipeline(activePaidTaskId);
    } else {
      // Require Pix payment first
      setShowPixModal(true);
    }
  };

  // Callback when Pix is confirmed
  const handlePixApproved = (taskId: string) => {
    setShowPixModal(false);
    setActivePaidTaskId(taskId);
    runVideoRenderingPipeline(taskId);
  };

  // Core Video Rendering & Cloud Transcoding Pipeline
  const runVideoRenderingPipeline = async (taskId: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setErrorMessage(null);
    setDownloadUrl(null);
    setFileSizeBytes(null);

    // State 1: Preparando gravação
    setJobStatus('preparing');
    setProgressPercent(10);
    setStatusMessage('Inicializando estúdio de renderização Full HD (1920×1080)...');

    try {
      // State 2: Gravando frames
      setJobStatus('rendering');
      setStatusMessage('Gravando 450 quadros a 30 FPS com fidelidade visual máxima...');

      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 4_000_000, // 4 Mbps
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const recordPromise = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
        recorder.onerror = (err) => reject(err);
      });

      recorder.start(100);

      const totalFrames = VIDEO_TOTAL_DURATION_SEC * 30; // 450 frames
      const ctx = canvas.getContext('2d')!;

      for (let f = 0; f < totalFrames; f++) {
        const frameTime = f / 30;
        renderVideoFrame(
          ctx,
          VIDEO_CANVAS_WIDTH,
          VIDEO_CANVAS_HEIGHT,
          frameTime,
          videoConfig,
          metrics,
          orderedCharts,
          logoImage
        );

        const renderPct = 15 + Math.round((f / totalFrames) * 45); // 15% to 60%
        setProgressPercent(renderPct);
        setCurrentTime(frameTime);

        await new Promise((r) => setTimeout(r, 1000 / 30));
      }

      recorder.stop();
      const recordedBlob = await recordPromise;

      // State 3: Finalizando no servidor com FFmpeg
      setJobStatus('finalizing');
      setProgressPercent(70);
      setStatusMessage(
        format === 'mp4'
          ? 'Transcodificando no servidor via FFmpeg para MP4 H.264 (compatível com Windows Media Player)...'
          : 'Finalizando contêiner WebM 1080p no servidor com FFmpeg...'
      );

      const renderRes = await fetch(
        `/api/video/render-stream?taskId=${encodeURIComponent(taskId)}&format=${encodeURIComponent(format)}&title=${encodeURIComponent(title || 'Apresentacao')}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'video/webm',
            'x-task-id': taskId,
            'x-video-format': format,
          },
          body: recordedBlob,
        }
      );

      const renderText = await renderRes.text();
      let renderData: any;
      try {
        renderData = JSON.parse(renderText);
      } catch (_jsonErr) {
        const snippet = renderText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
        throw new Error(snippet ? `Erro no servidor: ${snippet}` : `Erro HTTP ${renderRes.status} durante a transcodificação.`);
      }

      if (!renderRes.ok) {
        throw new Error(renderData.error || `Erro na codificação (${renderRes.status}).`);
      }

      // State 4: Concluído
      setJobStatus('completed');
      setProgressPercent(100);
      setStatusMessage('Concluído: Vídeo Full HD gerado com sucesso e pronto para download!');
      setDownloadUrl(renderData.downloadUrl);
      setFileSizeBytes(renderData.fileSizeBytes);
    } catch (err: any) {
      console.error('Failed to generate video:', err);
      setJobStatus('failed');
      setErrorMessage(err.message || 'Falha inesperada durante a renderização do vídeo.');
    }
  };

  // Verified Client-Side Download Trigger (Guarantees binary delivery without saving HTML errors)
  const handleDownload = async () => {
    if (!downloadUrl) return;

    setDownloading(true);
    const cleanSafeTitle = (title || 'relatorio_executivo')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'apresentacao_executiva';

    const filename = `${cleanSafeTitle}_1080p.${format}`;

    try {
      await downloadVideoWithVerification({
        videoUrl: downloadUrl,
        filename,
        format,
        onProgress: (info) => setDownloadProgress(info),
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao baixar vídeo.');
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-6xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[94vh] text-slate-100">
          {/* Top Header */}
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Film className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-white tracking-tight">
                    Estúdio de Vídeo Animado Executivo
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 fill-current" /> Full HD 1080p
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Geração em 1920 × 1080 • 15 Segundos • Codificação Real via FFmpeg no Servidor
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenHistory}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 transition-colors"
              >
                <Film className="w-4 h-4 text-blue-400" /> Meus Vídeos
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Studio Body: Left Configuration & Right Preview */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
            {/* Left Column: Settings (5 cols) */}
            <div className="lg:col-span-5 p-5 space-y-5 overflow-y-auto max-h-[78vh]">
              {/* Pay-Per-Task Notice */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/60 to-indigo-950/60 border border-blue-800/60 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-300 font-medium">Taxa única de exportação:</span>{' '}
                  <strong className="text-emerald-400 text-sm font-bold">
                    {formatCurrencyBRL(videoPrice)}
                  </strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Pagamento individual por Pix • Sem mensalidades ou planos
                  </p>
                </div>
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <QrCode className="w-4 h-4" />
                </div>
              </div>

              {/* Title & Metadata */}
              <div className="space-y-3 bg-slate-850/40 p-4 rounded-2xl border border-slate-800">
                <span className="text-[11px] font-bold text-slate-300 uppercase flex items-center gap-1.5">
                  <Type className="w-4 h-4 text-blue-400" /> Informações da Apresentação
                </span>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Título Principal</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Resultados Comerciais Q1"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Subtítulo ou Período</label>
                    <input
                      type="text"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="Ex: Análise de Indicadores Chave"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Nome da Empresa</label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Ex: Sua Marca"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Formato de Saída</label>
                      <select
                        value={format}
                        onChange={(e) => setFormat(e.target.value as VideoFormat)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="mp4">MP4 (H.264 / AAC Universal)</option>
                        <option value="webm">WebM (VP9 / Web Nativo)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Theme Selection */}
              <div className="space-y-3 bg-slate-850/40 p-4 rounded-2xl border border-slate-800">
                <span className="text-[11px] font-bold text-slate-300 uppercase flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-violet-400" /> Tema Visual Corporativo
                </span>

                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(THEMES) as VideoTheme[]).map((tKey) => {
                    const t = THEMES[tKey];
                    const labelInfo = {
                      corporate_blue: { name: 'Azul Corporativo', desc: 'Profissional e executivo' },
                      slate_dark: { name: 'Grafite Noturno', desc: 'Moderno e sofisticado' },
                      emerald_finance: { name: 'Esmeralda', desc: 'Finanças e rentabilidade' },
                      burgundy_premium: { name: 'Rubi Executivo', desc: 'Decisões de diretoria' },
                    }[tKey];
                    const isSelected = theme === tKey;
                    return (
                      <button
                        key={tKey}
                        onClick={() => setTheme(tKey)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: t.primary }}
                          />
                          <span className="text-xs font-bold text-white">{labelInfo.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{labelInfo.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chart Selection */}
              <div className="space-y-2 bg-slate-850/40 p-4 rounded-2xl border border-slate-800">
                <span className="text-[11px] font-bold text-slate-300 uppercase flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-400" /> Gráficos Selecionados ({selectedChartIds.length})
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {charts.map((c) => {
                    const isChecked = selectedChartIds.includes(c.config.id);
                    return (
                      <label
                        key={c.config.id}
                        className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer text-xs ${
                          isChecked
                            ? 'border-blue-500/60 bg-blue-500/10 text-white font-medium'
                            : 'border-slate-800 bg-slate-800/20 text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedChartIds([...selectedChartIds, c.config.id]);
                            } else {
                              setSelectedChartIds(selectedChartIds.filter((id) => id !== c.config.id));
                            }
                          }}
                          className="rounded-sm bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                        />
                        <span className="truncate">{c.config.title}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Live Player & Render Action (7 cols) */}
            <div className="lg:col-span-7 p-5 flex flex-col justify-between space-y-4">
              {/* Canvas Preview Container (16:9 Aspect Ratio) */}
              <div className="relative aspect-video w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center group">
                <canvas
                  ref={canvasRef}
                  width={VIDEO_CANVAS_WIDTH}
                  height={VIDEO_CANVAS_HEIGHT}
                  className="w-full h-full object-contain"
                />

                {/* Overlaid Play/Pause Button on Hover */}
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-slate-900/70 hover:bg-slate-900/90 text-white flex items-center justify-center backdrop-blur-xs border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                >
                  {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                </button>

                {/* Time Badge */}
                <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-xs text-[11px] font-mono text-slate-300 border border-white/10">
                  {currentTime.toFixed(1)}s / {VIDEO_TOTAL_DURATION_SEC}s
                </div>
              </div>

              {/* Timeline Slider & Player Controls */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentTime(0);
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <input
                    type="range"
                    min={0}
                    max={VIDEO_TOTAL_DURATION_SEC}
                    step={0.1}
                    value={currentTime}
                    onChange={(e) => {
                      setIsPlaying(false);
                      setCurrentTime(parseFloat(e.target.value));
                    }}
                    className="flex-1 accent-blue-600 bg-slate-800 rounded-lg h-2 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-400 min-w-[50px] text-right">
                    {currentTime.toFixed(1)}s
                  </span>
                </div>
              </div>

              {/* Render Status & Progress Bar */}
              {jobStatus && (
                <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-2">
                      {jobStatus === 'rendering' || jobStatus === 'finalizing' ? (
                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                      ) : jobStatus === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      )}
                      {statusMessage}
                    </span>
                    <span className="font-mono text-blue-400 font-bold">{progressPercent}%</span>
                  </div>

                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700/60">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {errorMessage && (
                    <div className="p-2.5 rounded-xl bg-rose-950/60 text-rose-300 text-xs border border-rose-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {downloadProgress && (
                    <div className="text-[11px] text-slate-400 font-mono">
                      {downloadProgress.message}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons: Render or Download */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                {downloadUrl ? (
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="flex-1 py-3 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    {downloading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                    Baixar Vídeo Final ({format.toUpperCase()})
                    {fileSizeBytes && (
                      <span className="text-xs font-normal opacity-80">
                        • {(fileSizeBytes / 1024 / 1024).toFixed(1)} MB
                      </span>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleInitiateRender}
                    disabled={jobStatus === 'rendering' || jobStatus === 'finalizing'}
                    className="flex-1 py-3 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-5 h-5" />
                    {activePaidTaskId ? 'Iniciar Renderização' : `Gerar Vídeo em Full HD (${formatCurrencyBRL(videoPrice)})`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pix Payment Modal */}
      <PixPaymentModal
        isOpen={showPixModal}
        onClose={() => setShowPixModal(false)}
        serviceType="video"
        title={`Vídeo Executivo Full HD 1080p — ${title}`}
        onPaymentApproved={handlePixApproved}
      />
    </>
  );
};
