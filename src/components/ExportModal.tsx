import React from 'react';
import { Download, FileText, FileSpreadsheet, X, Sparkles, ShieldCheck } from 'lucide-react';
import { exportToCsvBR, printExecutiveReport } from '../lib/exportUtils';
import { ProcessedDataset, MetricCardValue } from '../lib/dataProcessor';
import { ChartConfig, UserProfile } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: ProcessedDataset;
  metrics: MetricCardValue[];
  charts: { config: ChartConfig; data: { dimension: string; metric: number }[] }[];
  activeFilterSummary: string;
  userProfile: UserProfile;
  onOpenPricing: () => void;
  onOpenVideoEditor: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  dataset,
  metrics,
  charts,
  activeFilterSummary,
  userProfile,
  onOpenPricing,
  onOpenVideoEditor,
}) => {
  if (!isOpen) return null;

  const handleExportPDF = () => {
    printExecutiveReport(
      dataset.name,
      metrics,
      charts,
      activeFilterSummary,
      userProfile.plan === 'free' // watermark if free
    );
    onClose();
  };

  const handleExportCSV = () => {
    exportToCsvBR(dataset.rows, dataset.name);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Exportar Relatórios</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <p className="text-slate-500">
            Exporte os dados consolidados e os gráficos do seu dashboard nos formatos mais utilizados por empresas e contadores.
          </p>

          <div className="space-y-3 pt-1">
            {/* Animated Presentation Video Option (Premium) */}
            <div
              onClick={() => {
                onClose();
                onOpenVideoEditor();
              }}
              className="p-4 border-2 border-indigo-500/40 hover:border-indigo-600 rounded-xl bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-violet-50/40 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-violet-950/40 cursor-pointer transition-all flex items-start gap-3 group shadow-xs hover:shadow-md"
            >
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shrink-0 shadow-md shadow-blue-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white text-sm mb-0.5">
                  <span>Vídeo Animado Executivo</span>
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                    Full HD • 15s
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Transforme os gráficos e indicadores em um vídeo corporativo animado em 1920 × 1080 (MP4/WebM).
                </p>
              </div>
            </div>

            {/* PDF Report Option */}
            <div
              onClick={handleExportPDF}
              className="p-4 border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-all flex items-start gap-3 group"
            >
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white text-sm mb-0.5">
                  <span>Relatório Executivo PDF</span>
                  {userProfile.plan === 'free' && (
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 rounded-sm">
                      Com marca d'água
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Documento pronto para impressão com cabeçalho corporativo, cartões de KPIs e tabelas detalhadas.
                </p>
              </div>
            </div>

            {/* Clean CSV Option */}
            <div
              onClick={handleExportCSV}
              className="p-4 border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-all flex items-start gap-3 group"
            >
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-900 dark:text-white text-sm mb-0.5">
                  Planilha CSV Tratada (Padrão Excel Brasil)
                </div>
                <p className="text-[11px] text-slate-500">
                  Separador por ponto e vírgula (;), numeração brasileira e codificação UTF-8 BOM para acentuação perfeita no Excel.
                </p>
              </div>
            </div>
          </div>

          {userProfile.plan === 'free' && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900 flex items-center justify-between text-xs text-blue-900 dark:text-blue-300">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                Remova a marca d'água no Premium
              </span>
              <button
                onClick={() => {
                  onClose();
                  onOpenPricing();
                }}
                className="font-bold underline text-blue-700 dark:text-blue-400 hover:text-blue-900"
              >
                Ver Plano
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
