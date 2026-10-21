import { ChartConfig } from './index';

export type VideoTheme = 'corporate_blue' | 'slate_dark' | 'emerald_finance' | 'burgundy_premium';
export type VideoFormat = 'mp4' | 'webm';
export type VideoResolution = '1080p'; // 1920x1080 Full HD

export type VideoJobStatus =
  | 'queued'
  | 'preparing'
  | 'rendering'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'canceled';

export interface VideoScene {
  id: string;
  type: 'intro' | 'chart' | 'kpis' | 'outro';
  title: string;
  subtitle?: string;
  chartId?: string;
  chartConfig?: ChartConfig;
  chartData?: { dimension: string; metric: number }[];
  duration: number; // in seconds
  order: number;
}

export interface VideoConfig {
  title: string;
  subtitle: string;
  companyName: string;
  logoUrl?: string;
  theme: VideoTheme;
  format: VideoFormat;
  resolution: VideoResolution;
  durationSeconds: number; // strictly 15s default
  selectedChartIds: string[];
}

export interface VideoExportRecord {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  durationSeconds: number;
  resolution: string;
  format: VideoFormat;
  fileSizeBytes: number;
  downloadUrl: string;
  mp4DownloadUrl?: string;
  webmDownloadUrl?: string;
  availableFormats?: ('mp4' | 'webm')[];
  status: VideoJobStatus;
  errorMessage?: string;
}

export interface VideoJobProgress {
  jobId: string;
  status: VideoJobStatus;
  progressPercent: number;
  statusMessage: string;
  downloadUrl?: string;
  mp4DownloadUrl?: string;
  webmDownloadUrl?: string;
  availableFormats?: ('mp4' | 'webm')[];
  fileSizeBytes?: number;
  error?: string;
}

export interface VideoUsageInfo {
  plan: 'free' | 'premium';
  usedThisMonth: number;
  limit: number;
  remaining: number;
  canExport: boolean;
}
