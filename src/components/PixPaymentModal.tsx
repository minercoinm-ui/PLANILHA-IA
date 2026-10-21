import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Copy,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Loader2,
  ShieldCheck,
  Smartphone,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { formatCurrencyBRL } from '../lib/dataProcessor';
import { apiFetch } from '../lib/visitorId';

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceType: 'pdf' | 'video';
  title?: string;
  onPaymentApproved: (taskId: string) => void;
}

export const PixPaymentModal: React.FC<PixPaymentModalProps> = ({
  isOpen,
  onClose,
  serviceType,
  title,
  onPaymentApproved,
}) => {
  if (!isOpen) return null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentData, setPaymentData] = useState<{
    taskId: string;
    amount: number;
    pixQrCode?: string;
    pixCopiaECola?: string;
    isTestMode?: boolean;
    mode?: string;
    message?: string;
  } | null>(null);

  const [isApproved, setIsApproved] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes timer
  const [simulating, setSimulating] = useState(false);

  // Initialize Pix payment task on modal open
  useEffect(() => {
    let isMounted = true;
    const initPix = async () => {
      setLoading(true);
      setError(null);
      setIsApproved(false);
      try {
        const res = await apiFetch('/api/payment/pix/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceType,
            title: title || (serviceType === 'pdf' ? 'Relatório Executivo PDF' : 'Vídeo Executivo 1080p'),
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Erro HTTP ${res.status}`);
        }

        const data = await res.json();
        if (isMounted) {
          setPaymentData(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Falha ao gerar cobrança Pix.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initPix();
    return () => {
      isMounted = false;
    };
  }, [serviceType, title]);

  // Polling payment status every 2.5 seconds
  useEffect(() => {
    if (!paymentData?.taskId || isApproved) return;

    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/payment/pix/status/${paymentData.taskId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.paid) {
            setIsApproved(true);
            clearInterval(interval);
            setTimeout(() => {
              onPaymentApproved(paymentData.taskId);
            }, 1200);
          }
        }
      } catch (_) {}
    }, 2500);

    return () => clearInterval(interval);
  }, [paymentData?.taskId, isApproved, onPaymentApproved]);

  // Countdown timer
  useEffect(() => {
    if (isApproved || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isApproved, timeLeft]);

  const handleCopyPix = () => {
    if (!paymentData?.pixCopiaECola) return;
    navigator.clipboard.writeText(paymentData.pixCopiaECola);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSimulateApproval = async () => {
    if (!paymentData?.taskId) return;
    setSimulating(true);
    try {
      const res = await apiFetch('/api/payment/simulate-test-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: paymentData.taskId }),
      });
      if (res.ok) {
        setIsApproved(true);
        setTimeout(() => {
          onPaymentApproved(paymentData.taskId);
        }, 1200);
      }
    } catch (_) {
    } finally {
      setSimulating(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Pagamento Instantâneo via Pix
              </h2>
              <p className="text-[11px] text-slate-500">
                {serviceType === 'pdf' ? 'Download de Relatório Executivo PDF' : 'Renderização de Vídeo Full HD 1080p'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs text-slate-600 dark:text-slate-300">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="font-medium text-slate-700 dark:text-slate-300">
                Gerando cobrança Pix segura...
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Não foi possível gerar a cobrança</span>
              </div>
              <p className="text-[11px]">{error}</p>
            </div>
          )}

          {!loading && !error && isApproved && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Pagamento Confirmado!
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Liberando o processamento do seu arquivo com prioridade máxima...
                </p>
              </div>
            </div>
          )}

          {!loading && !error && !isApproved && paymentData && (
            <>
              {/* Price Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-blue-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                    Valor da Taxa Única
                  </span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {formatCurrencyBRL(paymentData.amount)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-xs border border-slate-200/60 dark:border-slate-700">
                    <Clock className="w-3 h-3 text-amber-500" />
                    Expira em {formatTime(timeLeft)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Liberação imediata</div>
                </div>
              </div>

              {/* QR Code Canvas / Image */}
              <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                {paymentData.pixQrCode ? (
                  <img
                    src={paymentData.pixQrCode}
                    alt="QR Code Pix"
                    className="w-44 h-44 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-lg">
                    <QrCode className="w-24 h-24 text-slate-400" />
                  </div>
                )}
                <span className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" /> Aponte a câmera do aplicativo do seu banco
                </span>
              </div>

              {/* Pix Copia e Cola */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Código Pix Copia e Cola</span>
                  <span className="text-[10px] font-normal text-slate-400">Clique para copiar</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={paymentData.pixCopiaECola || ''}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate focus:outline-none"
                  />
                  <button
                    onClick={handleCopyPix}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-xs ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copiar Código
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Waiting status pill */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-slate-600 dark:text-slate-300">
                    Aguardando confirmação do banco...
                  </span>
                </div>
                <span className="text-slate-400 font-mono text-[10px]">
                  ID: {paymentData.taskId.slice(-8)}
                </span>
              </div>

              {/* Sandbox Test Mode Quick Simulation Button */}
              {paymentData.isTestMode && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-[11px] space-y-2">
                  <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 font-bold">
                    <span>Ambiente de Demonstração / Testes</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-amber-200 dark:bg-amber-900 rounded-md">
                      Sandbox
                    </span>
                  </div>
                  <p className="text-amber-700 dark:text-amber-400 text-[10px]">
                    Nenhuma credencial de produção configurada ainda. Você pode simular a aprovação instantânea:
                  </p>
                  <button
                    onClick={handleSimulateApproval}
                    disabled={simulating}
                    className="w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    {simulating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    Simular Pagamento Pix Aprovado (Teste)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
