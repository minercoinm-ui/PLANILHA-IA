import React, { useState, useEffect } from 'react';
import {
  Download,
  FileText,
  FileSpreadsheet,
  X,
  Sparkles,
  ShieldCheck,
  Gift,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { exportToCsvBR, downloadExecutivePdfReport } from '../lib/exportUtils';
import { ProcessedDataset, MetricCardValue, formatCurrencyBRL } from '../lib/dataProcessor';
import { ChartConfig } from '../types';
import { PixPaymentModal } from './PixPaymentModal';
import {
  apiFetch,
  isFreePdfClaimedLocally,
  markFreePdfClaimedLocally,
} from '../lib/visitorId';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: ProcessedDataset;
  metrics: MetricCardValue[];
  charts: { config: ChartConfig; data: { dimension: string; metric: number }[] }[];
  activeFilterSummary: string;
  onOpenVideoEditor: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  dataset,
  metrics,
  charts,
  activeFilterSummary,
  onOpenVideoEditor,
}) => {
  // Check local storage immediately on initial state to prevent any flicker of free badge
  const initialLocalClaim = isFreePdfClaimedLocally();

  const [eligibility, setEligibility] = useState<{
    hasFreePdfRemaining: boolean;
    price: number;
    message?: string;
  }>({
    hasFreePdfRemaining: !initialLocalClaim,
    price: 4.90,
  });

  const [loadingEligibility, setLoadingEligibility] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [showPixPdfModal, setShowPixPdfModal] = useState(false);

  // Fetch free PDF eligibility on mount/open combining server state and local persistent state
  const fetchEligibility = async () => {
    // If already claimed locally in browser storage, immediately enforce block
    if (isFreePdfClaimedLocally()) {
      setEligibility((prev) => ({ ...prev, hasFreePdfRemaining: false }));
    }

    setLoadingEligibility(true);
    try {
      const res = await apiFetch('/api/pdf/eligibility');
      if (res.ok) {
        const data = await res.json();
        const serverHasFree = Boolean(data.hasFreePdfRemaining);
        const finalHasFree = serverHasFree && !isFreePdfClaimedLocally();

        if (!finalHasFree) {
          markFreePdfClaimedLocally();
        }

        setEligibility({
          hasFreePdfRemaining: finalHasFree,
          price: data.price || 4.90,
          message: data.message,
        });
      }
    } catch (_) {
      // On error, if locally claimed, keep blocked
      if (isFreePdfClaimedLocally()) {
        setEligibility((prev) => ({ ...prev, hasFreePdfRemaining: false }));
      }
    } finally {
      setLoadingEligibility(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setDownloadStatus(null);
      fetchEligibility();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExportPDF = async () => {
    if (downloadingPdf) return;

    // Check if free benefit is available
    if (eligibility.hasFreePdfRemaining && !isFreePdfClaimedLocally()) {
      setDownloadingPdf(true);
      setDownloadStatus(null);

      try {
        // Step 1: Request strict authorization gatekeeper from backend BEFORE downloading
        const authRes = await apiFetch('/api/pdf/authorize-download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isFreeRequested: true, title: dataset.name }),
        });

        const authData = await authRes.json().catch(() => ({}));

        if (!authRes.ok || !authData.authorized) {
          // Backend determined free benefit has already been consumed!
          markFreePdfClaimedLocally();
          setEligibility((prev) => ({ ...prev, hasFreePdfRemaining: false }));
          setDownloadStatus({
            type: 'error',
            text:
              authData.error ||
              'O 1º download gratuito já foi utilizado. Próximos downloads exigem pagamento avulso via Pix.',
          });
          setShowPixPdfModal(true);
          return;
        }

        // Step 2: Benefit is valid and authorized. Permanently lock next downloads locally
        markFreePdfClaimedLocally();
        setEligibility((prev) => ({ ...prev, hasFreePdfRemaining: false }));

        // Step 3: Generate and trigger direct binary PDF download
        const result = await downloadExecutivePdfReport(
          dataset.name,
          metrics,
          charts,
          activeFilterSummary,
          false
        );

        setDownloadStatus({
          type: 'success',
          text: `Arquivo "${result.filename}" baixado com sucesso! Seu download gratuito foi consumido; as próximas exportações serão liberadas após pagamento Pix.`,
        });

        setTimeout(() => {
          onClose();
        }, 3000);
      } catch (err: any) {
        console.error('[PDF Export Error]:', err);
        setDownloadStatus({
          type: 'error',
          text: `Falha ao processar o relatório PDF: ${err.message || 'Erro inesperado'}.`,
        });
      } finally {
        setDownloadingPdf(false);
      }
    } else {
      // Free download already consumed or blocked: strictly require Pix payment!
      setShowPixPdfModal(true);
    }
  };

  const handlePdfPaymentApproved = async (taskId: string) => {
    setShowPixPdfModal(false);
    setDownloadingPdf(true);
    setDownloadStatus(null);

    try {
      // Verify payment authorization from backend gatekeeper
      const authRes = await apiFetch('/api/pdf/authorize-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFreeRequested: false, taskId, title: dataset.name }),
      });

      const authData = await authRes.json().catch(() => ({}));
      if (!authRes.ok || !authData.authorized) {
        throw new Error(authData.error || 'Pagamento ainda não foi confirmado pelo servidor.');
      }

      // Download the PDF
      const result = await downloadExecutivePdfReport(
        dataset.name,
        metrics,
        charts,
        activeFilterSummary,
        false
      );

      // Ensure local state remains paid-only
      markFreePdfClaimedLocally();
      setEligibility((prev) => ({ ...prev, hasFreePdfRemaining: false }));

      setDownloadStatus({
        type: 'success',
        text: `Pagamento Pix confirmado! Arquivo "${result.filename}" baixado com sucesso!`,
      });

      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (err: any) {
      console.error('[PDF Export Error after Pix]:', err);
      setDownloadStatus({
        type: 'error',
        text: `Erro ao liberar download: ${err.message}.`,
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleExportCSV = () => {
    exportToCsvBR(dataset.rows, dataset.name);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Exportar Relatórios</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4 text-xs">
            <p className="text-slate-500">
              Gere relatórios executivos em PDF com download direto, vídeos animados em 1080p ou planilhas tratadas em formato brasileiro.
            </p>

            {/* Status Feedback Notice */}
            {downloadStatus && (
              <div
                className={`p-3 rounded-2xl flex items-start gap-2.5 animate-in fade-in ${
                  downloadStatus.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {downloadStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span className="text-[11px] font-medium leading-relaxed">{downloadStatus.text}</span>
              </div>
            )}

            <div className="space-y-3 pt-1">
              {/* Option 1: Executive PDF Report (1st Free, Subsequent Strictly Paid via Pix) */}
              <div
                onClick={handleExportPDF}
                className={`p-4 border rounded-2xl cursor-pointer transition-all flex items-start gap-3 group shadow-xs hover:shadow-md ${
                  downloadingPdf
                    ? 'opacity-80 pointer-events-none'
                    : eligibility.hasFreePdfRemaining
                    ? 'border-emerald-500/60 hover:border-emerald-600 bg-emerald-50/20 dark:bg-emerald-950/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    eligibility.hasFreePdfRemaining
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600'
                      : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600'
                  }`}
                >
                  {downloadingPdf ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : eligibility.hasFreePdfRemaining ? (
                    <Gift className="w-5 h-5" />
                  ) : (
                    <Lock className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white text-sm mb-0.5">
                    <span className="flex items-center gap-1.5">
                      Relatório Executivo PDF
                      {downloadingPdf && (
                        <span className="text-[11px] font-normal text-blue-600 dark:text-blue-400">
                          Processando...
                        </span>
                      )}
                    </span>
                    {eligibility.hasFreePdfRemaining ? (
                      <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Gift className="w-3 h-3" /> 1º Grátis
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Lock className="w-3 h-3" /> {formatCurrencyBRL(eligibility.price)} via Pix
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {eligibility.hasFreePdfRemaining
                      ? 'Seu primeiro download é 100% gratuito. Uma vez baixado, os próximos downloads exigirão pagamento Pix.'
                      : 'Benefício gratuito já utilizado. Próximos downloads são liberados exclusivamente após pagamento via Pix.'}
                  </p>

                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={downloadingPdf}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors ${
                        eligibility.hasFreePdfRemaining
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                      }`}
                    >
                      {downloadingPdf ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando...
                        </>
                      ) : eligibility.hasFreePdfRemaining ? (
                        <>
                          <Download className="w-3.5 h-3.5" /> Baixar 1º PDF Grátis
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" /> Pagar {formatCurrencyBRL(eligibility.price)} via Pix
                        </>
                      )}
                    </button>
                    <span className="text-[10px] text-slate-400">
                      {eligibility.hasFreePdfRemaining ? '1 cota gratuita' : 'Pagamento avulso sem assinatura'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Option 2: Executive Animated Video (Full HD 1080p - Strictly Paid Only) */}
              <div
                onClick={() => {
                  onClose();
                  onOpenVideoEditor();
                }}
                className="p-4 border-2 border-indigo-500/40 hover:border-indigo-600 rounded-2xl bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-violet-50/40 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-violet-950/40 cursor-pointer transition-all flex items-start gap-3 group shadow-xs hover:shadow-md"
              >
                <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shrink-0 shadow-md shadow-blue-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white text-sm mb-0.5">
                    <span>Vídeo Animado Executivo</span>
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                      Full HD 1080p
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Apresentação dinâmica dos indicadores e gráficos para diretoria e clientes (MP4 / WebM pago individualmente).
                  </p>
                </div>
              </div>

              {/* Option 3: Clean CSV (Always Free) */}
              <div
                onClick={handleExportCSV}
                className="p-4 border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-2xl bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-all flex items-start gap-3 group"
              >
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white text-sm mb-0.5">
                    <span>Planilha CSV Tratada (Padrão Excel)</span>
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded-md">
                      Grátis
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Separador por ponto e vírgula (;), numeração brasileira e codificação UTF-8 BOM para Excel.
                  </p>
                </div>
              </div>
            </div>

            {/* Benefit info */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-[11px] text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Sem assinaturas ou cobranças recorrentes
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-300">Pagamento avulso Pix</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pix Payment Modal for PDF when not free */}
      <PixPaymentModal
        isOpen={showPixPdfModal}
        onClose={() => setShowPixPdfModal(false)}
        serviceType="pdf"
        title={`Relatório Executivo PDF — ${dataset.name}`}
        onPaymentApproved={handlePdfPaymentApproved}
      />
    </>
  );
};
