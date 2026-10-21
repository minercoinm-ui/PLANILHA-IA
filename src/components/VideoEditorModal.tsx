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
  Zap,
} from 'lucide-react';
import {
  VideoConfig,
  VideoTheme,
  VideoFormat,
  VideoJobStatus,
  VideoUsageInfo,
} from '../types/video';
import { ChartConfig, UserProfile, UserUsage } from '../types';
import { MetricCardValue } from '../lib/dataProcessor';
import {
  renderVideoFrame,
  VIDEO_CANVAS_WIDTH,
  VIDEO_CANVAS_HEIGHT,
  VIDEO_TOTAL_DURATION_SEC,
  PreparedChartData,
  THEMES,
} from '../lib/videoEngine';

interface VideoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetName: string;
  charts: { config: ChartConfig; data: { dimension: string; metric: number }[] }[];
  metrics: MetricCardValue[];
  userProfile: UserProfile;
  userUsage: UserUsage;
  onUsageUpdated: () => void;
  onOpenPricing: () => void;
  onOpenHistory: () => void;
}

export const VideoEditorModal: React.FC<VideoEditorModalProps> = ({
  isOpen,
  onClose,
  datasetName,
  charts,
  metrics,
  userProfile,
  userUsage,
  onUsageUpdated,
  onOpenPricing,
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

  // Video Usage State
  const [usageInfo, setUsageInfo] = useState<VideoUsageInfo>({
    plan: userProfile.plan,
    usedThisMonth: userUsage.videoExportsCount || 0,
    limit: userProfile.plan === 'premium' ? 10 : 0,
    remaining: Math.max(0, (userProfile.plan === 'premium' ? 10 : 0) - (userUsage.videoExportsCount || 0)),
    canExport: userProfile.plan === 'premium',
  });

  const fetchUsage = async () => {
    try {
      const res = await fetch('/api/video/usage', {
        headers: { 'x-user-id': userProfile.id },
      });
      if (res.ok) {
        const data = await res.json();
        setUsageInfo(data);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchUsage();
  }, [userProfile.id]);

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

  // Render Canvas Frame
  const renderCurrentFrame = (t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderVideoFrame(
      ctx,
      VIDEO_CANVAS_WIDTH,
      VIDEO_CANVAS_HEIGHT,
      t,
      videoConfig,
      metrics,
      orderedCharts,
      logoImage
    );
  };

  // Initial & configuration frame render
  useEffect(() => {
    renderCurrentFrame(currentTime);
  }, [currentTime, videoConfig, orderedCharts, metrics, logoImage]);

  // Preview Playback Loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = null;
      return;
    }

    const step = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }
      const dt = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      setCurrentTime((prev) => {
        const next = prev + dt;
        if (next >= VIDEO_TOTAL_DURATION_SEC) {
          setIsPlaying(false);
          return 0; // Loop or stop at beginning
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying]);

  // Reorder chart scenes
  const moveChart = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= selectedChartIds.length) return;
    const copy = [...selectedChartIds];
    const temp = copy[index];
    copy[index] = copy[newIdx];
    copy[newIdx] = temp;
    setSelectedChartIds(copy);
  };

  // Toggle chart selection (max 3 charts)
  const toggleChart = (id: string) => {
    if (selectedChartIds.includes(id)) {
      if (selectedChartIds.length <= 1) return; // Keep at least 1 chart
      setSelectedChartIds((prev) => prev.filter((item) => item !== id));
    } else {
      if (selectedChartIds.length >= 3) return; // Max 3 charts in 15 seconds
      setSelectedChartIds((prev) => [...prev, id]);
    }
  };

  // ---------------------------------------------------------------------------
  // GENERATE VIDEO PROCESS (MediaRecorder + Backend FFmpeg 1080p Verification)
  // ---------------------------------------------------------------------------
  const handleGenerateVideo = async () => {
    // 1. Check user permission
    if (userProfile.plan !== 'premium') {
      onOpenPricing();
      return;
    }

    if (usageInfo.remaining <= 0) {
      setErrorMessage('Limite mensal de vídeos do seu plano atingido.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Reset error & download states
    setErrorMessage(null);
    setDownloadUrl(null);
    setFileSizeBytes(null);

    // State 1: Na fila
    setJobStatus('queued');
    setProgressPercent(5);
    setStatusMessage('Na fila: Solicitando autorização de renderização...');

    try {
      // Create render job in backend
      const createRes = await fetch('/api/video/create-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userProfile.id,
        },
        body: JSON.stringify({
          title,
          format,
          durationSeconds: VIDEO_TOTAL_DURATION_SEC,
          userId: userProfile.id,
        }),
      });

      const createText = await createRes.text();
      let createData: any;
      try {
        createData = JSON.parse(createText);
      } catch (_e) {
        const snippet = createText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
        throw new Error(snippet ? `Erro no servidor: ${snippet}` : `Erro HTTP ${createRes.status} ao criar tarefa.`);
      }

      if (!createRes.ok) {
        if (createData.upgradeRequired) {
          onOpenPricing();
          throw new Error(createData.error || 'Acesso exclusivo para assinantes Premium.');
        }
        throw new Error(createData.error || 'Não foi possível iniciar a tarefa.');
      }

      const jobId = createData.jobId;

      // State 2: Preparando
      setJobStatus('preparing');
      setProgressPercent(15);
      setStatusMessage('Preparando: Inicializando motor de renderização 1080p...');

      // State 3: Renderizando frames
      setJobStatus('rendering');
      setStatusMessage('Renderizando: Gravando composição em Full HD (1920×1080)...');

      // Set up Canvas Stream and MediaRecorder (3.5 Mbps optimal Full HD for charts)
      const stream = canvas.captureStream(30); // 30 FPS Full HD Stream
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 3_500_000, // 3.5 Mbps Full HD
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      const recordPromise = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          resolve(blob);
        };
        recorder.onerror = (err) => reject(err);
      });

      recorder.start(100);

      // Render all 450 frames (15s @ 30fps) with accurate timing
      const totalFrames = VIDEO_TOTAL_DURATION_SEC * 30;
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

        // Update progress bar realistically
        const renderPct = 20 + Math.round((f / totalFrames) * 45); // 20% to 65%
        setProgressPercent(renderPct);
        setCurrentTime(frameTime);

        // Small interval to let canvas paint to stream
        await new Promise((r) => setTimeout(r, 1000 / 30));
      }

      recorder.stop();
      const recordedBlob = await recordPromise;

      // State 4: Finalizando no servidor via FFmpeg
      setJobStatus('finalizing');
      setProgressPercent(75);
      setStatusMessage(
        format === 'mp4'
          ? 'Finalizando: Transcodificando para MP4 (H.264) e validando integridade...'
          : 'Finalizando: Consolidando contêiner WebM 1080p e validando...'
      );

      // Send direct raw binary WebM stream to backend pipeline (no base64 memory bloat)
      const renderRes = await fetch(
        `/api/video/render-stream?jobId=${encodeURIComponent(jobId)}&format=${encodeURIComponent(format)}&title=${encodeURIComponent(title || 'Apresentacao')}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'video/webm',
            'x-user-id': userProfile.id,
            'x-job-id': jobId,
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
        throw new Error(renderData.error || `Erro na codificação do servidor (${renderRes.status}).`);
      }

      // State 5: Concluído
      setJobStatus('completed');
      setProgressPercent(100);
      setStatusMessage('Concluído: Vídeo gerado em 1920×1080 com sucesso!');
      setDownloadUrl(renderData.downloadUrl);
      setFileSizeBytes(renderData.fileSizeBytes);

      // Refresh limits & usage
      fetchUsage();
      onUsageUpdated();
    } catch (err: any) {
      console.error('Failed to generate video:', err);
      setJobStatus('failed');
      setErrorMessage(err.message || 'Falha inesperada durante a renderização do vídeo.');
    }
  };

  // Direct Download Trigger with safe filename
  const triggerDownload = () => {
    if (!downloadUrl) return;
    const cleanSafeTitle = (title || 'relatorio_executivo')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'apresentacao_executiva';
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${cleanSafeTitle}_1080p.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-6xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 text-slate-100">
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
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <Zap className="w-3 h-3 fill-current" /> Premium Exclusivo
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Geração em Full HD (1920 × 1080) • 15 Segundos • 100% Dados Reais Auditados
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
          {/* Left Column: Settings & Scene Ordering (5 cols) */}
          <div className="lg:col-span-5 p-5 space-y-5 overflow-y-auto max-h-[78vh]">
            {/* Monthly Quota Indicator */}
            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400">Consumo mensal:</span>{' '}
                <strong className="text-white">
                  {usageInfo.usedThisMonth} de {usageInfo.limit} vídeos gerados
                </strong>
                <p className="text-[11px] text-emerald-400 mt-0.5 font-medium">
                  Restam {usageInfo.remaining} exportações disponíveis neste ciclo
                </p>
              </div>
              {userProfile.plan === 'free' && (
                <button
                  onClick={onOpenPricing}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition-colors"
                >
                  Upgrade
                </button>
              )}
            </div>

            {/* Presentation Titles */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-blue-400" /> Títulos & Identificação
              </label>

              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Título Principal</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Relatório de Desempenho Comercial"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Subtítulo Executivo</label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Ex: Indicadores Chave & Variações Mês a Mês"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-400 mb-1 block">Nome da Empresa</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Sua Empresa"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 mb-1 block">Logotipo (Opcional)</label>
                  <label className="w-full px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs flex items-center justify-center cursor-pointer truncate transition-colors">
                    <Building2 className="w-3.5 h-3.5 mr-1.5 text-slate-400 shrink-0" />
                    <span className="truncate">{logoFile ? logoFile.name : 'Subir imagem'}</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            {/* Visual Theme */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-indigo-400" /> Tema Visual Corporativo
              </label>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'corporate_blue', name: 'Azul Executivo', color: '#3b82f6' },
                  { id: 'slate_dark', name: 'Grafite Moderno', color: '#94a3b8' },
                  { id: 'emerald_finance', name: 'Esmeralda Financeiro', color: '#10b981' },
                  { id: 'burgundy_premium', name: 'Vinho Premium', color: '#e11d48' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id as VideoTheme)}
                    className={`px-3 py-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                      theme === t.id
                        ? 'border-blue-500 bg-blue-950/40 text-white'
                        : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: t.color }} />
                      <span>{t.name}</span>
                    </div>
                    {theme === t.id && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Format Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-amber-400" /> Formato de Exportação
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormat('mp4')}
                  className={`p-3 rounded-xl border text-left text-xs transition-all ${
                    format === 'mp4'
                      ? 'border-blue-500 bg-blue-950/40 text-white'
                      : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-slate-200">
                    <span>MP4 (H.264)</span>
                    <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-sm">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Compatível universalmente com PowerPoint, WhatsApp, LinkedIn e TV.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat('webm')}
                  className={`p-3 rounded-xl border text-left text-xs transition-all ${
                    format === 'webm'
                      ? 'border-blue-500 bg-blue-950/40 text-white'
                      : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-slate-200">
                    <span>WebM (VP9)</span>
                    <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-sm">
                      Web Nativo
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Ideal para navegadores modernos e compartilhamento em nuvem.
                  </p>
                </button>
              </div>
            </div>

            {/* Selection & Reordering of Charts */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" /> Gráficos Participantes (Máx 3)
                </label>
                <span className="text-[11px] text-slate-500">
                  {selectedChartIds.length} selecionado(s)
                </span>
              </div>

              {charts.length === 0 ? (
                <div className="p-3 bg-slate-800/40 rounded-xl text-center text-xs text-slate-500">
                  Nenhum gráfico disponível no dashboard.
                </div>
              ) : (
                <div className="space-y-2">
                  {charts.map((item, idx) => {
                    const isSelected = selectedChartIds.includes(item.config.id);
                    const selectedIndex = selectedChartIds.indexOf(item.config.id);

                    return (
                      <div
                        key={item.config.id}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                          isSelected
                            ? 'border-slate-700 bg-slate-800/70 text-white'
                            : 'border-slate-800/60 bg-slate-800/30 text-slate-500 hover:border-slate-800'
                        }`}
                      >
                        <div
                          className="flex items-center gap-2.5 cursor-pointer flex-1"
                          onClick={() => toggleChart(item.config.id)}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded-md border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                          />
                          <div>
                            <span className="font-semibold block">{item.config.title}</span>
                            <span className="text-[10px] text-slate-400">
                              Tipo: {item.config.type} • Métrica: {item.config.yAxis}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex items-center gap-1 ml-2">
                            <span className="px-2 py-0.5 rounded-md bg-blue-900/60 text-blue-300 font-mono text-[10px] font-bold">
                              Cena {selectedIndex + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => moveChart(selectedIndex, 'up')}
                              disabled={selectedIndex === 0}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                              title="Subir ordem"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveChart(selectedIndex, 'down')}
                              disabled={selectedIndex === selectedChartIds.length - 1}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                              title="Descer ordem"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: 16:9 Full HD Preview & Export Hub (7 cols) */}
          <div className="lg:col-span-7 p-6 flex flex-col justify-between space-y-4">
            <div>
              {/* Player Top Bar */}
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-blue-400" /> Pré-Visualização da Apresentação
                </span>
                <span className="text-[11px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                  {currentTime.toFixed(1)}s / {VIDEO_TOTAL_DURATION_SEC}.0s
                </span>
              </div>

              {/* 16:9 Full HD Canvas Container */}
              <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={VIDEO_CANVAS_WIDTH}
                  height={VIDEO_CANVAS_HEIGHT}
                  className="w-full h-full object-contain"
                />

                {/* Overlay During Rendering */}
                {jobStatus && jobStatus !== 'completed' && jobStatus !== 'failed' && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center mb-4 animate-pulse">
                      <RefreshCw className="w-7 h-7 animate-spin" />
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">
                      Renderizando Vídeo Full HD (1080p)
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm mb-4">{statusMessage}</p>

                    {/* Progress Bar */}
                    <div className="w-full max-w-md bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold text-blue-400 mt-2">
                      {progressPercent}% Concluído
                    </span>
                  </div>
                )}
              </div>

              {/* Scrubber & Timeline Scenes */}
              <div className="mt-4 space-y-2">
                {/* 5-Scene visual markers */}
                <div className="grid grid-cols-5 gap-1 text-[10px] text-slate-400 text-center font-semibold">
                  <div className={`p-1 rounded-md border ${currentTime < 3 ? 'border-blue-500 bg-blue-950/40 text-blue-300' : 'border-slate-800 bg-slate-800/30'}`}>
                    0-3s • Abertura
                  </div>
                  <div className={`p-1 rounded-md border ${currentTime >= 3 && currentTime < 7 ? 'border-blue-500 bg-blue-950/40 text-blue-300' : 'border-slate-800 bg-slate-800/30'}`}>
                    3-7s • Gráfico 1
                  </div>
                  <div className={`p-1 rounded-md border ${currentTime >= 7 && currentTime < 11 ? 'border-blue-500 bg-blue-950/40 text-blue-300' : 'border-slate-800 bg-slate-800/30'}`}>
                    7-11s • Gráfico 2
                  </div>
                  <div className={`p-1 rounded-md border ${currentTime >= 11 && currentTime < 14 ? 'border-blue-500 bg-blue-950/40 text-blue-300' : 'border-slate-800 bg-slate-800/30'}`}>
                    11-14s • KPIs
                  </div>
                  <div className={`p-1 rounded-md border ${currentTime >= 14 ? 'border-blue-500 bg-blue-950/40 text-blue-300' : 'border-slate-800 bg-slate-800/30'}`}>
                    14-15s • Encerramento
                  </div>
                </div>

                {/* Interactive Time Slider */}
                <input
                  type="range"
                  min="0"
                  max={VIDEO_TOTAL_DURATION_SEC}
                  step="0.05"
                  value={currentTime}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setCurrentTime(parseFloat(e.target.value));
                  }}
                  className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />

                {/* Player Controls */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      {isPlaying ? 'Pausar' : 'Reproduzir'}
                    </button>

                    <button
                      onClick={() => {
                        setIsPlaying(false);
                        setCurrentTime(0);
                      }}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                      title="Reiniciar prévia"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-500">
                    A pré-visualização não consome créditos de renderização.
                  </span>
                </div>
              </div>
            </div>

            {/* Error Feedback */}
            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <strong className="block text-white">Falha na renderização</strong>
                  <span>{errorMessage}</span>
                </div>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-rose-400 hover:text-white font-bold text-[11px]"
                >
                  Fechar
                </button>
              </div>
            )}

            {/* Success Download Banner */}
            {jobStatus === 'completed' && downloadUrl && (
              <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-800/70 text-xs text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-800/40 text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-white text-sm">Vídeo Pronto para Download!</strong>
                    <span className="text-slate-300 text-[11px]">
                      1920 × 1080 Full HD • Formato {format.toUpperCase()} • 15s •{' '}
                      {fileSizeBytes ? `${(fileSizeBytes / 1024 / 1024).toFixed(2)} MB` : ''}
                    </span>
                  </div>
                </div>

                <button
                  onClick={triggerDownload}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
                >
                  <Download className="w-4 h-4" /> Baixar Vídeo {format.toUpperCase()}
                </button>
              </div>
            )}

            {/* Bottom Actions Hub */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Arquivo MP4 / WebM genuíno e testado via FFprobe</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Fechar
                </button>

                <button
                  type="button"
                  onClick={handleGenerateVideo}
                  disabled={jobStatus === 'rendering' || jobStatus === 'preparing' || jobStatus === 'finalizing'}
                  className="px-6 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50"
                >
                  <Film className="w-4 h-4" />
                  {jobStatus === 'completed' ? 'Gerar Nova Versão' : 'Gerar Vídeo de Apresentação'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
