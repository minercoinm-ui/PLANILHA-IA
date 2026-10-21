import { ColumnMeta, DataQualityReport, MetricCardValue } from '../lib/dataProcessor';

export type ChartType = 'bar' | 'horizontal_bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'table';
export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max';
export type ColorPalette = 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'indigo';

export interface ChartConfig {
  id: string;
  title: string;
  type: ChartType;
  xAxis: string; // Column key for dimension
  yAxis: string; // Column key for metric
  aggregation: AggregationType;
  colorPalette: ColorPalette;
  sortBy?: 'metric_desc' | 'metric_asc' | 'dimension';
  description?: string;
}

export interface FilterState {
  dateRange: string; // 'all' | '30d' | '90d' | 'year' | 'custom'
  startDate?: string;
  endDate?: string;
  categoricalFilters: Record<string, string[]>; // columnKey -> selected values
  searchTerm?: string;
}

export interface Dashboard {
  id: string;
  title: string;
  description?: string;
  datasetId: string;
  charts: ChartConfig[];
  filters: FilterState;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  plan: 'free' | 'premium';
  createdAt: string;
}

export interface PlanLimits {
  maxFileSizeMb: number;
  maxImportsPerMonth: number;
  maxDashboards: number;
  maxAiQueriesPerMonth: number;
  maxVideoExportsPerMonth: number;
  hasAdvancedExports: boolean;
  hasVideoExport: boolean;
  hasWatermark: boolean;
}

export interface UserUsage {
  userId: string;
  period: string;
  importsCount: number;
  aiQueriesCount: number;
  dashboardsCount: number;
  videoExportsCount: number;
}

export * from './video';
