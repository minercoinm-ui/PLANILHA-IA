import React, { useState } from 'react';
import {
  Check,
  Zap,
  ShieldCheck,
  CreditCard,
  X,
  Loader2,
  Sparkles,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { UserProfile } from '../types';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onPlanUpgraded: () => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onPlanUpgraded,
}) => {
  if (!isOpen) return null;

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [checkoutData, setCheckoutData] = useState<{
    preferenceId?: string;
    initPoint?: string;
    sandboxInitPoint?: string;
    mode?: string;
    message?: string;
  } | null>(null);

  const handleStartMercadoPago = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const response = await fetch('/api/mercadopago/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userProfile.id,
          returnUrl: window.location.href,
        }),
      });

      const data = await response.json();
      setCheckoutData(data);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Erro ao iniciar checkout: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateWebhookApproval = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      await fetch('/api/mercadopago/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'payment',
          action: 'payment.updated',
          status: 'approved',
          userId: userProfile.id,
          data: { id: `pay_${Date.now()}` },
        }),
      });

      onPlanUpgraded();
      setStatusMessage({ type: 'success', text: 'Pagamento aprovado com sucesso via Webhook do Mercado Pago! Plano Premium ativado.' });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Falha na simulação: ' + e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
              Planos e Assinaturas
            </h2>
            <p className="text-xs text-slate-500">
              Escolha o plano ideal para suas análises e dashboards com Inteligência Artificial
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Free Plan Card */}
            <div
              className={`p-5 rounded-2xl border ${
                userProfile.plan === 'free'
                  ? 'border-blue-600 bg-blue-50/20 dark:bg-blue-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'
              } flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Plano Gratuito</h3>
                  {userProfile.plan === 'free' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-md">
                      Plano Atual
                    </span>
                  )}
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mb-4">
                  R$ 0 <span className="text-xs font-normal text-slate-500">/ sempre</span>
                </div>

                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    Até <strong>3 importações</strong> por mês
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    Arquivos de até <strong>5 MB</strong> (.xlsx, .csv)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    Até <strong>2 dashboards salvos</strong>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <strong>5 consultas de IA</strong> por mês
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    Gráficos e filtros básicos
                  </li>
                  <li className="flex items-center gap-2 text-slate-400">
                    <X className="w-4 h-4 text-slate-300 shrink-0" />
                    Exportação com marca d'água
                  </li>
                </ul>
              </div>

              <div className="mt-6">
                <button
                  disabled
                  className="w-full py-2 px-4 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-500 cursor-not-allowed"
                >
                  {userProfile.plan === 'free' ? 'Plano Ativo' : 'Plano Básico'}
                </button>
              </div>
            </div>

            {/* Premium Plan Card */}
            <div
              className={`p-5 rounded-2xl border-2 ${
                userProfile.plan === 'premium'
                  ? 'border-emerald-600 bg-emerald-50/20 dark:bg-emerald-950/20'
                  : 'border-blue-600 bg-white dark:bg-slate-900'
              } shadow-lg relative flex flex-col justify-between`}
            >
              <div className="absolute -top-3 right-5">
                <span className="bg-gradient-to-r from-blue-600 to-violet-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Recomendado
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Plano Premium</h3>
                  {userProfile.plan === 'premium' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 rounded-md">
                      Assinatura Ativa
                    </span>
                  )}
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mb-4">
                  R$ 29,90 <span className="text-xs font-normal text-slate-500">/ mês</span>
                </div>

                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <strong>100 importações</strong> por mês
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    Arquivos grandes de até <strong>25 MB</strong>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <strong>Dashboards ilimitados</strong>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <strong>200 consultas de IA</strong> (Gemini 3.8 Flash)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    Filtros multidimensionais e análises avançadas
                  </li>
                  <li className="flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <strong>Vídeos Animados Executivos Full HD</strong> (1080p, 15s)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    Exportação executiva PDF/CSV <strong>sem marca d'água</strong>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    Histórico de versões de planilhas e vídeos
                  </li>
                </ul>
              </div>

              <div className="mt-6 space-y-2">
                {userProfile.plan === 'premium' ? (
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-center text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Sua assinatura está ativa!
                  </div>
                ) : (
                  <button
                    onClick={handleStartMercadoPago}
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" /> Assinar com Mercado Pago (R$ 29,90/mês)
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Mercado Pago Checkout Options when initiated */}
          {checkoutData && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  Checkout Mercado Pago Iniciado
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">
                  Preferência: {checkoutData.preferenceId}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                {checkoutData.message || 'Selecione como deseja prosseguir com a validação do pagamento:'}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {checkoutData.initPoint && (
                  <a
                    href={checkoutData.sandboxInitPoint || checkoutData.initPoint}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1.5"
                  >
                    Abrir Checkout Mercado Pago <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                {/* Simulation button so users can test full upgrade right away */}
                <button
                  onClick={handleSimulateWebhookApproval}
                  disabled={loading}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Simular Confirmação Webhook (Teste)
                </button>
              </div>
            </div>
          )}

          {/* Payment guarantees */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Processamento seguro com criptografia TLS
            </span>
            <span>Cancele quando quiser sem multas</span>
          </div>
        </div>
      </div>
    </div>
  );
};
