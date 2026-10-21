import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  AlertCircle,
  Lightbulb,
  TrendingUp,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { ProcessedDataset, MetricCardValue } from '../lib/dataProcessor';
import { UserProfile, UserUsage } from '../types';

interface AiAnalystDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: ProcessedDataset;
  metrics: MetricCardValue[];
  userProfile: UserProfile;
  userUsage: UserUsage;
  onUsageUpdated: () => void;
  onOpenPricing: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}

export const AiAnalystDrawer: React.FC<AiAnalystDrawerProps> = ({
  isOpen,
  onClose,
  dataset,
  metrics,
  userProfile,
  userUsage,
  onUsageUpdated,
  onOpenPricing,
}) => {
  if (!isOpen) return null;

  const [inputQuestion, setInputQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Olá! Sou o seu **Analista IA**. Já processei a planilha **"${dataset.name}"** com ${dataset.rows.length} registros e calculei os indicadores essenciais.\n\nVocê pode me fazer perguntas de negócio ou clicar em uma das sugestões abaixo.`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const maxQueries = userProfile.plan === 'premium' ? 200 : 5;
  const remaining = Math.max(0, maxQueries - userUsage.aiQueriesCount);

  const quickQuestions = [
    'Qual produto gerou maior faturamento?',
    'Como está o lucro e a margem?',
    'Qual o ticket médio e volume de vendas?',
    'Identifique discrepâncias ou valores atípicos',
    'Resuma os principais destaques para a diretoria',
  ];

  const handleSend = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || loading) return;

    if (remaining <= 0) {
      setErrorMsg(`Você atingiu o limite mensal de consultas à IA (${maxQueries}/${maxQueries}) do plano gratuito.`);
      return;
    }

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion('');
    setLoading(true);
    setErrorMsg(null);

    try {
      // Data minimization: send only metrics, column names/types, and small aggregation summary
      const columnsSummary = dataset.columns.map((c) => ({
        name: c.name,
        type: c.type,
      }));

      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userProfile.id,
        },
        body: JSON.stringify({
          question: q,
          summaryMetrics: metrics.filter((m) => m.available),
          columnsMetadata: columnsSummary,
          sampleAggregations: {
            totalRows: dataset.rows.length,
            topDimensions: dataset.columns
              .filter((c) => c.type === 'categorical')
              .slice(0, 3)
              .map((c) => c.name),
          },
          userId: userProfile.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao consultar o Analista IA.');
      }

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: data.answer,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
      onUsageUpdated();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-violet-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              Analista IA
              <span className="text-[10px] font-semibold px-2 py-0.2 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-full">
                Gemini 3.8
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Consultas: {userUsage.aiQueriesCount}/{maxQueries} este mês
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Usage Limit Banner if close or reached */}
      {remaining <= 2 && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
          <span>{remaining === 0 ? 'Limite de consultas atingido.' : `Resta apenas ${remaining} consulta.`}</span>
          <button onClick={onOpenPricing} className="font-bold underline hover:text-amber-900">
            Fazer Upgrade
          </button>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.sender === 'ai' && (
              <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-xs leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-xs whitespace-pre-wrap'
              }`}
            >
              {m.text}
              <div
                className={`text-[9px] mt-1 text-right ${
                  m.sender === 'user' ? 'text-blue-200' : 'text-slate-400'
                }`}
              >
                {m.timestamp}
              </div>
            </div>

            {m.sender === 'user' && (
              <div className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>Processando resposta com base nos dados auditados...</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Suggested Quick Questions */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          <Lightbulb className="w-3 h-3 text-amber-500" /> Perguntas Frequentes
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              disabled={loading || remaining <= 0}
              className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(inputQuestion);
        }}
        className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900"
      >
        <input
          type="text"
          placeholder={remaining > 0 ? 'Pergunte sobre seus dados...' : 'Limite atingido'}
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          disabled={loading || remaining <= 0}
          className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!inputQuestion.trim() || loading || remaining <= 0}
          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs disabled:opacity-50 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-500" /> Cálculos Determinísticos Seguros
        </span>
        <span>Privacidade Garantida</span>
      </div>
    </div>
  );
};
