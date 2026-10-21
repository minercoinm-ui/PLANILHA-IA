import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, Percent, ShoppingBag, CreditCard, Info } from 'lucide-react';
import { MetricCardValue } from '../lib/dataProcessor';

interface MetricCardProps {
  metric: MetricCardValue;
}

export const MetricCard: React.FC<MetricCardProps> = ({ metric }) => {
  const getIcon = () => {
    switch (metric.id) {
      case 'metric_revenue':
        return <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'metric_expense':
        return <TrendingDown className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
      case 'metric_profit':
        return <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case 'metric_margin':
        return <Percent className="w-5 h-5 text-violet-600 dark:text-violet-400" />;
      case 'metric_avg_ticket':
        return <CreditCard className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      case 'metric_volume':
      default:
        return <ShoppingBag className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
    }
  };

  if (!metric.available) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{metric.label}</span>
          <span className="text-slate-400"><Info className="w-4 h-4" /></span>
        </div>
        <div className="my-2">
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500 italic">Não disponível</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{metric.missingExplanation || 'Coluna não identificada na planilha.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {metric.label}
        </span>
        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80">
          {getIcon()}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {metric.formattedValue}
        </div>

        {metric.changePercent !== undefined && (
          <div className="flex items-center gap-1.5 mt-2">
            <span
              className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md ${
                metric.changeType === 'positive'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
              }`}
            >
              {metric.changePercent >= 0 ? '+' : ''}{metric.changePercent}%
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">vs período anterior</span>
          </div>
        )}
      </div>

      {metric.tooltip && (
        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400 dark:text-slate-500 truncate" title={metric.tooltip}>
          {metric.tooltip}
        </div>
      )}
    </div>
  );
};
