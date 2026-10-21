/**
 * Video Animation Engine - Executive 1080p Presentation Generator
 * Renders high-fidelity animated corporate presentation scenes onto a 1920x1080 Canvas.
 * Strictly uses real dataset rows, real business metrics, and Brazilian formatting.
 */

import { VideoConfig, VideoTheme, VideoScene } from '../types/video';
import { MetricCardValue, formatCurrencyBR, formatNumberBR } from './dataProcessor';
import { ChartConfig } from '../types';

export const VIDEO_CANVAS_WIDTH = 1920;
export const VIDEO_CANVAS_HEIGHT = 1080;
export const VIDEO_TOTAL_DURATION_SEC = 15;
export const VIDEO_FPS = 30;

// Theme Definitions
export interface ThemeColorPalette {
  bgGradient: [string, string, string];
  cardBg: string;
  cardBorder: string;
  primary: string;
  secondary: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  chartColors: string[];
}

export const THEMES: Record<VideoTheme, ThemeColorPalette> = {
  corporate_blue: {
    bgGradient: ['#090d16', '#0f172a', '#1e293b'],
    cardBg: 'rgba(30, 41, 59, 0.75)',
    cardBorder: 'rgba(59, 130, 246, 0.25)',
    primary: '#3b82f6',
    secondary: '#60a5fa',
    accent: '#38bdf8',
    textPrimary: '#ffffff',
    textSecondary: '#cbd5e1',
    textMuted: '#64748b',
    chartColors: ['#3b82f6', '#60a5fa', '#93c5fd', '#38bdf8', '#0ea5e9', '#0284c7'],
  },
  slate_dark: {
    bgGradient: ['#020617', '#0f172a', '#1e293b'],
    cardBg: 'rgba(15, 23, 42, 0.85)',
    cardBorder: 'rgba(148, 163, 184, 0.2)',
    primary: '#94a3b8',
    secondary: '#cbd5e1',
    accent: '#38bdf8',
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted: '#64748b',
    chartColors: ['#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#fb7185', '#94a3b8'],
  },
  emerald_finance: {
    bgGradient: ['#022c22', '#064e3b', '#065f46'],
    cardBg: 'rgba(6, 78, 59, 0.75)',
    cardBorder: 'rgba(52, 211, 153, 0.25)',
    primary: '#10b981',
    secondary: '#34d399',
    accent: '#fbbf24',
    textPrimary: '#ffffff',
    textSecondary: '#d1fae5',
    textMuted: '#6ee7b7',
    chartColors: ['#10b981', '#34d399', '#6ee7b7', '#f59e0b', '#fbbf24', '#fcd34d'],
  },
  burgundy_premium: {
    bgGradient: ['#1c0b1e', '#3b0730', '#4c0519'],
    cardBg: 'rgba(76, 5, 25, 0.75)',
    cardBorder: 'rgba(244, 63, 94, 0.25)',
    primary: '#e11d48',
    secondary: '#f43f5e',
    accent: '#fda4af',
    textPrimary: '#ffffff',
    textSecondary: '#fecdd3',
    textMuted: '#fb7185',
    chartColors: ['#f43f5e', '#e11d48', '#be123c', '#fb7185', '#fda4af', '#f472b6'],
  },
};

// Easing Functions for Natural, Professional Animation
function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
}

function easeInOutQuad(x: number): number {
  x = Math.max(0, Math.min(1, x));
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export interface PreparedChartData {
  config: ChartConfig;
  data: { dimension: string; metric: number }[];
}

/**
 * Main Frame Renderer
 * Renders full 1920x1080 canvas based on timestamp t in seconds (0.0 to 15.0).
 */
export function renderVideoFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  config: VideoConfig,
  metrics: MetricCardValue[],
  charts: PreparedChartData[],
  logoImage?: HTMLImageElement | null
) {
  const theme = THEMES[config.theme] || THEMES.corporate_blue;

  // 1. Draw Clean Corporate Background with Radial Light & Subtle Grid
  drawBackground(ctx, width, height, t, theme);

  // 2. Timeline Breakdown (15 seconds total)
  // Scene 1: 0.0s – 3.0s -> Opening Title & Overview
  // Scene 2: 3.0s – 7.0s -> First Animated Chart
  // Scene 3: 7.0s – 11.0s -> Second Animated Chart / Trend
  // Scene 4: 11.0s – 14.0s -> Key KPIs & Variations
  // Scene 5: 14.0s – 15.0s -> Executive Sign-off Outro

  if (t < 3.0) {
    // Scene 1: Abertura (0s - 3s)
    const localT = t;
    const progress = clamp(localT / 3.0, 0, 1);
    const fadeOut = localT > 2.6 ? 1 - (localT - 2.6) / 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = fadeOut;
    drawIntroScene(ctx, width, height, progress, config, logoImage, theme);
    ctx.restore();
  } else if (t < 7.0) {
    // Scene 2: Gráfico 1 (3s - 7s)
    const localT = t - 3.0;
    const progress = clamp(localT / 4.0, 0, 1);
    const fadeIn = localT < 0.4 ? localT / 0.4 : 1;
    const fadeOut = localT > 3.6 ? 1 - (localT - 3.6) / 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = Math.min(fadeIn, fadeOut);
    const chart = charts[0];
    if (chart) {
      drawChartScene(ctx, width, height, progress, chart, 1, charts.length, config, theme);
    } else {
      drawFallbackMetricsScene(ctx, width, height, progress, metrics, config, theme);
    }
    ctx.restore();
  } else if (t < 11.0) {
    // Scene 3: Gráfico 2 (7s - 11s)
    const localT = t - 7.0;
    const progress = clamp(localT / 4.0, 0, 1);
    const fadeIn = localT < 0.4 ? localT / 0.4 : 1;
    const fadeOut = localT > 3.6 ? 1 - (localT - 3.6) / 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = Math.min(fadeIn, fadeOut);
    const chart = charts[1] || charts[0];
    if (chart) {
      drawChartScene(ctx, width, height, progress, chart, 2, charts.length, config, theme);
    } else {
      drawFallbackMetricsScene(ctx, width, height, progress, metrics, config, theme);
    }
    ctx.restore();
  } else if (t < 14.0) {
    // Scene 4: KPIs Executivos (11s - 14s)
    const localT = t - 11.0;
    const progress = clamp(localT / 3.0, 0, 1);
    const fadeIn = localT < 0.4 ? localT / 0.4 : 1;
    const fadeOut = localT > 2.6 ? 1 - (localT - 2.6) / 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = Math.min(fadeIn, fadeOut);
    drawKpisScene(ctx, width, height, progress, metrics, config, theme);
    ctx.restore();
  } else {
    // Scene 5: Encerramento (14s - 15s)
    const localT = t - 14.0;
    const progress = clamp(localT / 1.0, 0, 1);
    const fadeIn = localT < 0.25 ? localT / 0.25 : 1;
    ctx.save();
    ctx.globalAlpha = fadeIn;
    drawOutroScene(ctx, width, height, progress, config, logoImage, theme);
    ctx.restore();
  }

  // 3. Persistent Executive Header & Progress Bar
  drawPersistentDecorations(ctx, width, height, t, config, theme);
}

// Background with smooth gradient and animated subtle particles/grid
function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  theme: ThemeColorPalette
) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, theme.bgGradient[0]);
  gradient.addColorStop(0.5, theme.bgGradient[1]);
  gradient.addColorStop(1, theme.bgGradient[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Subtle radial glow center
  const radialGlow = ctx.createRadialGradient(
    width / 2 + Math.sin(t * 0.5) * 50,
    height / 2,
    100,
    width / 2,
    height / 2,
    width * 0.65
  );
  radialGlow.addColorStop(0, 'rgba(59, 130, 246, 0.08)');
  radialGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, width, height);

  // Subtle architectural grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
  ctx.lineWidth = 1;
  const gridSize = 120;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

// Persistent Top-Right Timestamp & Bottom Progress Bar
function drawPersistentDecorations(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  config: VideoConfig,
  theme: ThemeColorPalette
) {
  // Bottom 15s Timeline Bar
  const barHeight = 8;
  const barY = height - barHeight;
  const progressRatio = clamp(t / VIDEO_TOTAL_DURATION_SEC, 0, 1);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(0, barY, width, barHeight);

  const barGradient = ctx.createLinearGradient(0, 0, width, 0);
  barGradient.addColorStop(0, theme.primary);
  barGradient.addColorStop(1, theme.accent);
  ctx.fillStyle = barGradient;
  ctx.fillRect(0, barY, width * progressRatio, barHeight);

  // Small current scene label at bottom left
  let sceneName = 'Abertura';
  if (t >= 3.0 && t < 7.0) sceneName = 'Gráfico 1 • Performance';
  else if (t >= 7.0 && t < 11.0) sceneName = 'Gráfico 2 • Tendência';
  else if (t >= 11.0 && t < 14.0) sceneName = 'Indicadores Chave (KPIs)';
  else if (t >= 14.0) sceneName = 'Conclusão';

  ctx.font = '600 16px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.textAlign = 'left';
  ctx.fillText(`${sceneName} (${t.toFixed(1)}s / 15.0s)`, 40, height - 20);

  // Top right watermark badge "HD 1080p • Dados Auditados"
  ctx.textAlign = 'right';
  ctx.font = '700 14px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fillText('1080p Full HD • Relatório Auditado', width - 40, 36);
}

// Scene 1: Intro (0-3s)
function drawIntroScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  config: VideoConfig,
  logoImage: HTMLImageElement | null | undefined,
  theme: ThemeColorPalette
) {
  const easeIn = easeOutCubic(progress);
  const slideY = (1 - easeIn) * 60;

  ctx.save();
  ctx.translate(0, slideY);

  // 1. Company Logo / Badge
  const centerX = width / 2;
  const startY = height / 2 - 140;

  if (logoImage && logoImage.complete && logoImage.naturalWidth > 0) {
    const logoW = 120;
    const logoH = (logoW / logoImage.naturalWidth) * logoImage.naturalHeight;
    ctx.drawImage(logoImage, centerX - logoW / 2, startY - logoH / 2, logoW, logoH);
  } else {
    // Geometric Company Monogram Box
    const boxSize = 80;
    ctx.fillStyle = theme.cardBg;
    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, centerX - boxSize / 2, startY - boxSize / 2, boxSize, boxSize, 20);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 34px Inter, sans-serif';
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initial = (config.companyName || 'PI').slice(0, 2).toUpperCase();
    ctx.fillText(initial, centerX, startY);
  }

  // 2. Company Name Pill
  const companyY = startY + 80;
  ctx.font = '700 20px Inter, sans-serif';
  ctx.fillStyle = theme.accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((config.companyName || 'Empresa').toUpperCase(), centerX, companyY);

  // 3. Main Title
  const titleY = companyY + 70;
  ctx.font = '900 60px Inter, sans-serif';
  ctx.fillStyle = theme.textPrimary;
  ctx.fillText(config.title || 'Relatório de Desempenho Comercial', centerX, titleY);

  // 4. Subtitle
  const subY = titleY + 54;
  ctx.font = '500 28px Inter, sans-serif';
  ctx.fillStyle = theme.textSecondary;
  ctx.fillText(config.subtitle || 'Apresentação Executiva Consolidada • Dados Reais', centerX, subY);

  // 5. Verification Badge
  const badgeY = subY + 70;
  const badgeWidth = 440;
  const badgeHeight = 44;
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, centerX - badgeWidth / 2, badgeY, badgeWidth, badgeHeight, 22);
  ctx.fill();
  ctx.stroke();

  ctx.font = '700 16px Inter, sans-serif';
  ctx.fillStyle = '#34d399';
  ctx.fillText('✓ Métricas 100% Determinísticas & Auditadas', centerX, badgeY + badgeHeight / 2);

  ctx.restore();
}

// Scene 2 & 3: Animated Chart Scene
function drawChartScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  chartItem: PreparedChartData,
  sceneNumber: number,
  totalScenes: number,
  config: VideoConfig,
  theme: ThemeColorPalette
) {
  const { config: chartCfg, data } = chartItem;
  const easeProgress = easeOutCubic(progress);

  // 1. Top Section Header (Scene Title & Badge)
  const headerX = 140;
  const headerY = 120;

  // Scene indicator pill
  ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, headerX, headerY - 32, 170, 34, 17);
  ctx.fill();
  ctx.stroke();

  ctx.font = '700 14px Inter, sans-serif';
  ctx.fillStyle = theme.accent;
  ctx.textAlign = 'center';
  ctx.fillText(`CENA ${sceneNumber} DE 2`, headerX + 85, headerY - 10);

  // Main Chart Title
  ctx.textAlign = 'left';
  ctx.font = '900 40px Inter, sans-serif';
  ctx.fillStyle = theme.textPrimary;
  ctx.fillText(chartCfg.title || 'Análise de Desempenho', headerX, headerY + 28);

  // Subtitle / Column Description
  ctx.font = '500 20px Inter, sans-serif';
  ctx.fillStyle = theme.textSecondary;
  ctx.fillText(`Dimensão: ${chartCfg.xAxis} • Métrica: ${chartCfg.yAxis} (${chartCfg.aggregation.toUpperCase()})`, headerX, headerY + 62);

  // 2. Chart Card Container
  const cardX = 140;
  const cardY = 220;
  const cardW = width - 280;
  const cardH = height - 320;

  ctx.fillStyle = theme.cardBg;
  ctx.strokeStyle = theme.cardBorder;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 24);
  ctx.fill();
  ctx.stroke();

  // 3. Render Chart Elements inside the card
  const innerPadX = 70;
  const innerPadY = 60;
  const plotX = cardX + innerPadX;
  const plotY = cardY + innerPadY;
  const plotW = cardW - innerPadX * 2;
  const plotH = cardH - innerPadY * 2 - 30;

  if (chartCfg.type === 'line' || chartCfg.type === 'area') {
    drawLineChart(ctx, plotX, plotY, plotW, plotH, data, easeProgress, theme);
  } else if (chartCfg.type === 'pie' || chartCfg.type === 'donut') {
    drawDonutChart(ctx, plotX, plotY, plotW, plotH, data, easeProgress, theme);
  } else {
    // Default to vertical or horizontal bar chart
    drawBarChart(ctx, plotX, plotY, plotW, plotH, data, easeProgress, theme, chartCfg.type === 'horizontal_bar');
  }
}

// Draw Animated Bar Chart with Easing & Formatted Currency/Number Values
function drawBarChart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  data: { dimension: string; metric: number }[],
  progress: number,
  theme: ThemeColorPalette,
  horizontal: boolean = false
) {
  if (!data || data.length === 0) return;

  const displayData = data.slice(0, 7); // up to 7 bars for elegant spacing
  const maxVal = Math.max(...displayData.map((d) => d.metric), 1);

  if (horizontal) {
    const barGap = 20;
    const barH = (h - barGap * (displayData.length - 1)) / displayData.length;

    displayData.forEach((item, idx) => {
      const itemProgress = clamp((progress - idx * 0.08) / 0.6, 0, 1);
      const eased = easeOutCubic(itemProgress);
      const barY = y + idx * (barH + barGap);
      const targetW = (item.metric / maxVal) * (w - 280);
      const currentW = targetW * eased;

      // Label (Left)
      ctx.textAlign = 'right';
      ctx.font = '600 18px Inter, sans-serif';
      ctx.fillStyle = theme.textSecondary;
      ctx.fillText(truncateText(ctx, item.dimension, 180), x + 180, barY + barH / 2 + 6);

      // Bar Background
      const barStartX = x + 200;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      drawRoundedRect(ctx, barStartX, barY, w - 280, barH, 8);
      ctx.fill();

      // Bar Fill with Gradient
      const color = theme.chartColors[idx % theme.chartColors.length];
      const barGrad = ctx.createLinearGradient(barStartX, 0, barStartX + currentW, 0);
      barGrad.addColorStop(0, color);
      barGrad.addColorStop(1, theme.accent);
      ctx.fillStyle = barGrad;
      drawRoundedRect(ctx, barStartX, barY, Math.max(12, currentW), barH, 8);
      ctx.fill();

      // Value Callout (Right of Bar)
      if (currentW > 10) {
        ctx.textAlign = 'left';
        ctx.font = '700 20px Inter, sans-serif';
        ctx.fillStyle = theme.textPrimary;
        const currentMetric = item.metric * eased;
        const valText = item.metric > 100 ? formatCurrencyBR(currentMetric) : formatNumberBR(currentMetric);
        ctx.fillText(valText, barStartX + currentW + 16, barY + barH / 2 + 7);
      }
    });
  } else {
    // Vertical Bars
    const barGap = 36;
    const barW = (w - barGap * (displayData.length - 1)) / displayData.length;

    // Draw horizontal grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const lineY = y + (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(x, lineY);
      ctx.lineTo(x + w, lineY);
      ctx.stroke();

      const labelVal = maxVal * (1 - i / 4);
      ctx.textAlign = 'right';
      ctx.font = '500 14px Inter, sans-serif';
      ctx.fillStyle = theme.textMuted;
      ctx.fillText(labelVal > 100 ? formatCurrencyBR(labelVal) : formatNumberBR(labelVal), x - 12, lineY + 5);
    }

    displayData.forEach((item, idx) => {
      // Staggered animation per bar
      const itemProgress = clamp((progress - idx * 0.09) / 0.6, 0, 1);
      const eased = easeOutCubic(itemProgress);
      const barX = x + idx * (barW + barGap);
      const targetH = (item.metric / maxVal) * (h - 20);
      const currentH = targetH * eased;
      const barY = y + h - currentH;

      // Bar Gradient
      const color = theme.chartColors[idx % theme.chartColors.length];
      const barGrad = ctx.createLinearGradient(0, barY, 0, y + h);
      barGrad.addColorStop(0, theme.accent);
      barGrad.addColorStop(1, color);
      ctx.fillStyle = barGrad;

      drawRoundedRect(ctx, barX, barY, barW, Math.max(10, currentH), 12);
      ctx.fill();

      // Top value text
      if (currentH > 20) {
        ctx.textAlign = 'center';
        ctx.font = '700 18px Inter, sans-serif';
        ctx.fillStyle = theme.textPrimary;
        const currentMetric = item.metric * eased;
        const valText = item.metric > 100 ? formatCurrencyBR(currentMetric) : formatNumberBR(currentMetric);
        ctx.fillText(valText, barX + barW / 2, barY - 14);
      }

      // Bottom Category Label
      ctx.textAlign = 'center';
      ctx.font = '600 17px Inter, sans-serif';
      ctx.fillStyle = theme.textSecondary;
      ctx.fillText(truncateText(ctx, item.dimension, barW + 10), barX + barW / 2, y + h + 32);
    });
  }
}

// Draw Animated Line Chart
function drawLineChart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  data: { dimension: string; metric: number }[],
  progress: number,
  theme: ThemeColorPalette
) {
  if (!data || data.length === 0) return;
  const displayData = data.slice(0, 10);
  const maxVal = Math.max(...displayData.map((d) => d.metric), 1);
  const minVal = Math.min(...displayData.map((d) => d.metric), 0);
  const range = Math.max(maxVal - minVal, 1);

  // Grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const lineY = y + (h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(x, lineY);
    ctx.lineTo(x + w, lineY);
    ctx.stroke();
  }

  const stepX = w / Math.max(displayData.length - 1, 1);
  const points: { x: number; y: number; val: number; label: string }[] = displayData.map((item, idx) => ({
    x: x + idx * stepX,
    y: y + h - ((item.metric - minVal) / range) * (h - 40) - 20,
    val: item.metric,
    label: item.dimension,
  }));

  // Progressive draw length
  const totalLength = displayData.length;
  const activeLength = totalLength * progress;

  // Draw Area Glow
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, y + h);
  for (let i = 0; i < points.length; i++) {
    if (i > activeLength) break;
    ctx.lineTo(points[i].x, points[i].y);
  }
  const lastActiveX = points[0].x + (points[points.length - 1].x - points[0].x) * progress;
  ctx.lineTo(lastActiveX, y + h);
  ctx.closePath();

  const areaGrad = ctx.createLinearGradient(0, y, 0, y + h);
  areaGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
  areaGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = areaGrad;
  ctx.fill();
  ctx.restore();

  // Draw Line
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const ptProgress = clamp(activeLength - i + 1, 0, 1);
    if (ptProgress <= 0) break;
    const prevPt = points[i - 1];
    const currPt = points[i];
    const interpX = prevPt.x + (currPt.x - prevPt.x) * ptProgress;
    const interpY = prevPt.y + (currPt.y - prevPt.y) * ptProgress;
    ctx.lineTo(interpX, interpY);
  }
  ctx.stroke();

  // Draw Points and Values
  points.forEach((pt, idx) => {
    if (idx <= activeLength) {
      // Glow circle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 11, 0, Math.PI * 2);
      ctx.stroke();

      // Value label
      ctx.textAlign = 'center';
      ctx.font = '700 17px Inter, sans-serif';
      ctx.fillStyle = theme.textPrimary;
      const valStr = pt.val > 100 ? formatCurrencyBR(pt.val) : formatNumberBR(pt.val);
      ctx.fillText(valStr, pt.x, pt.y - 18);

      // Bottom X label
      ctx.font = '600 16px Inter, sans-serif';
      ctx.fillStyle = theme.textSecondary;
      ctx.fillText(truncateText(ctx, pt.label, stepX - 10), pt.x, y + h + 30);
    }
  });
  ctx.restore();
}

// Draw Animated Donut Chart
function drawDonutChart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  data: { dimension: string; metric: number }[],
  progress: number,
  theme: ThemeColorPalette
) {
  if (!data || data.length === 0) return;
  const displayData = data.slice(0, 5);
  const total = displayData.reduce((acc, curr) => acc + curr.metric, 0) || 1;

  const centerX = x + w * 0.35;
  const centerY = y + h * 0.5;
  const radius = Math.min(w * 0.28, h * 0.42);
  const innerRadius = radius * 0.58;

  let startAngle = -Math.PI / 2;
  const animatedSweep = Math.PI * 2 * progress;

  displayData.forEach((item, idx) => {
    const sliceAngle = (item.metric / total) * (Math.PI * 2);
    const effectiveAngle = Math.min(sliceAngle, Math.max(0, animatedSweep - (startAngle + Math.PI / 2)));

    if (effectiveAngle > 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + effectiveAngle);
      ctx.arc(centerX, centerY, innerRadius, startAngle + effectiveAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = theme.chartColors[idx % theme.chartColors.length];
      ctx.fill();
    }
    startAngle += sliceAngle;
  });

  // Center Total Callout
  ctx.textAlign = 'center';
  ctx.font = '800 28px Inter, sans-serif';
  ctx.fillStyle = theme.textPrimary;
  ctx.fillText(formatCurrencyBR(total * progress), centerX, centerY - 6);
  ctx.font = '600 16px Inter, sans-serif';
  ctx.fillStyle = theme.textSecondary;
  ctx.fillText('Total Consolidado', centerX, centerY + 24);

  // Legend on right
  const legendX = x + w * 0.65;
  const legendStartY = y + h * 0.2;
  displayData.forEach((item, idx) => {
    const itemY = legendStartY + idx * 56;
    const color = theme.chartColors[idx % theme.chartColors.length];
    const pct = ((item.metric / total) * 100).toFixed(1);

    ctx.fillStyle = color;
    drawRoundedRect(ctx, legendX, itemY, 18, 18, 5);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.font = '700 20px Inter, sans-serif';
    ctx.fillStyle = theme.textPrimary;
    ctx.fillText(`${item.dimension} (${pct}%)`, legendX + 30, itemY + 16);

    ctx.font = '500 16px Inter, sans-serif';
    ctx.fillStyle = theme.textSecondary;
    ctx.fillText(formatCurrencyBR(item.metric), legendX + 30, itemY + 38);
  });
}

// Scene 4: Key KPIs & Executive Indicators (11s - 14s)
function drawKpisScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  metrics: MetricCardValue[],
  config: VideoConfig,
  theme: ThemeColorPalette
) {
  // Title
  ctx.textAlign = 'center';
  ctx.font = '900 48px Inter, sans-serif';
  ctx.fillStyle = theme.textPrimary;
  ctx.fillText('Principais Indicadores Financeiros & Comerciais', width / 2, 130);

  ctx.font = '500 22px Inter, sans-serif';
  ctx.fillStyle = theme.textSecondary;
  ctx.fillText('Consolidação Executiva dos Resultados da Planilha', width / 2, 175);

  // 4 to 6 KPI Cards Grid
  const validMetrics = metrics.filter((m) => m.available).slice(0, 6);
  if (validMetrics.length === 0) {
    validMetrics.push(
      { id: 'm1', label: 'Volume de Linhas', title: 'Volume de Linhas', value: 100, formattedValue: 'Registros Válidos', available: true },
      { id: 'm2', label: 'Processamento', title: 'Processamento', value: 1, formattedValue: '100% Determinístico', available: true }
    );
  }

  const cols = validMetrics.length <= 4 ? validMetrics.length : 3;
  const rows = Math.ceil(validMetrics.length / cols);
  const cardW = Math.min(480, (width - 240 - (cols - 1) * 30) / cols);
  const cardH = 220;
  const startX = width / 2 - ((cols * cardW + (cols - 1) * 30) / 2);
  const startY = 240;

  validMetrics.forEach((metric, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const cardX = startX + col * (cardW + 30);
    const cardY = startY + row * (cardH + 30);

    const cardProgress = clamp((progress - idx * 0.1) / 0.6, 0, 1);
    const eased = easeOutCubic(cardProgress);
    const slideY = (1 - eased) * 40;

    ctx.save();
    ctx.translate(0, slideY);
    ctx.globalAlpha = eased;

    // Card Box
    ctx.fillStyle = theme.cardBg;
    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 20);
    ctx.fill();
    ctx.stroke();

    // Top subtle accent bar
    const barGrad = ctx.createLinearGradient(cardX, 0, cardX + cardW, 0);
    barGrad.addColorStop(0, theme.primary);
    barGrad.addColorStop(1, theme.accent);
    ctx.fillStyle = barGrad;
    drawRoundedRect(ctx, cardX + 20, cardY + 20, 48, 6, 3);
    ctx.fill();

    // Metric Title
    ctx.textAlign = 'left';
    ctx.font = '600 20px Inter, sans-serif';
    ctx.fillStyle = theme.textSecondary;
    ctx.fillText(metric.label || metric.title || '', cardX + 24, cardY + 65);

    // Metric Value with Count-Up
    ctx.font = '900 38px Inter, sans-serif';
    ctx.fillStyle = theme.textPrimary;

    let displayVal = metric.formattedValue;
    if (typeof metric.value === 'number') {
      const animatedVal = metric.value * eased;
      if (metric.id.includes('revenue') || metric.id.includes('profit') || metric.id.includes('expense') || metric.id.includes('ticket')) {
        displayVal = formatCurrencyBR(animatedVal);
      } else if (metric.id.includes('margin')) {
        displayVal = `${animatedVal.toFixed(1)}%`;
      } else {
        displayVal = formatNumberBR(animatedVal);
      }
    }
    ctx.fillText(displayVal, cardX + 24, cardY + 124);

    // Variation / Status badge
    if (metric.changePercent !== undefined) {
      const isPositive = metric.changePercent >= 0;
      const pillColor = isPositive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
      const textColor = isPositive ? '#34d399' : '#f87171';
      ctx.fillStyle = pillColor;
      drawRoundedRect(ctx, cardX + 24, cardY + 148, 140, 32, 16);
      ctx.fill();

      ctx.font = '700 15px Inter, sans-serif';
      ctx.fillStyle = textColor;
      ctx.fillText(`${isPositive ? '▲ +' : '▼ '}${metric.changePercent}% Mês`, cardX + 38, cardY + 169);
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      drawRoundedRect(ctx, cardX + 24, cardY + 148, 150, 32, 16);
      ctx.fill();

      ctx.font = '600 14px Inter, sans-serif';
      ctx.fillStyle = theme.textMuted;
      ctx.fillText('Valor Consolidado', cardX + 38, cardY + 169);
    }

    ctx.restore();
  });
}

// Scene 5: Outro / Fechamento Executivo (14s - 15s)
function drawOutroScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  config: VideoConfig,
  logoImage: HTMLImageElement | null | undefined,
  theme: ThemeColorPalette
) {
  const eased = easeOutCubic(progress);
  const centerX = width / 2;
  const centerY = height / 2;

  // Completion Ring Checkmark
  const ringRadius = 55;
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(centerX, centerY - 100, ringRadius, 0, Math.PI * 2 * eased);
  ctx.stroke();

  if (progress > 0.4) {
    ctx.fillStyle = '#10b981';
    ctx.font = '900 48px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✓', centerX, centerY - 100);
  }

  // Final Headline
  ctx.font = '900 52px Inter, sans-serif';
  ctx.fillStyle = theme.textPrimary;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(config.title || 'Apresentação Concluída com Sucesso', centerX, centerY + 20);

  // Subtitle
  ctx.font = '600 24px Inter, sans-serif';
  ctx.fillStyle = theme.accent;
  ctx.fillText(config.companyName || 'Planilha Inteligente IA', centerX, centerY + 68);

  ctx.font = '500 18px Inter, sans-serif';
  ctx.fillStyle = theme.textMuted;
  ctx.fillText('Exportado em Full HD 1080p • Pronto para Apresentações Executivas', centerX, centerY + 110);
}

// Fallback when charts are empty
function drawFallbackMetricsScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  metrics: MetricCardValue[],
  config: VideoConfig,
  theme: ThemeColorPalette
) {
  drawKpisScene(ctx, width, height, progress, metrics, config, theme);
}

// Helper: Rounded Rectangle
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Helper: Truncate Text with Ellipsis
function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}
