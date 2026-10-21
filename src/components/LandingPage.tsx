import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Sparkles,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ArrowRight,
  UploadCloud,
  Zap,
  DollarSign,
  PieChart,
  HelpCircle,
  Clock,
  Layers,
  Database,
  Search,
} from 'lucide-react';

interface LandingPageProps {
  onOpenImport: () => void;
  onOpenPricing: () => void;
  onGoToDashboard: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenImport,
  onOpenPricing,
  onGoToDashboard,
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const faqs = [
    {
      q: 'A aplicação usa dados fictícios ou simulados?',
      a: 'Não! A plataforma foi construída para trabalhar exclusivamente com dados reais enviados por você. Não exibimos nem calculamos dados fictícios. Todos os gráficos, indicadores e respostas da inteligência artificial são 100% auditados e gerados diretamente a partir do seu arquivo.',
    },
    {
      q: 'Como funciona a importação de planilhas?',
      a: 'Basta arrastar seu arquivo Excel (.xlsx, .xls) ou CSV. Nosso motor inteligente analisa automaticamente as colunas, detecta valores em reais (R$), percentuais, datas no padrão brasileiro (DD/MM/AAAA) e gera seu dashboard em segundos.',
    },
    {
      q: 'Meus dados financeiros estão seguros?',
      a: 'Sim, absolutamente. O processamento dos cálculos é feito diretamente no seu navegador. Nenhuma fórmula oculta ou macro é executada, e você tem controle total sobre quais colunas deseja analisar.',
    },
    {
      q: 'O que o Analista IA faz?',
      a: 'O Analista IA utiliza o modelo Gemini 3.8 Flash integrado ao servidor para responder dúvidas em português sobre seus números reais, apontar variações entre períodos, identificar produtos mais rentáveis e sugerir gráficos adicionais.',
    },
    {
      q: 'Como funciona o pagamento da assinatura?',
      a: 'A assinatura do Plano Premium custa R$ 29,90 por mês e é processada de forma 100% segura pelo Mercado Pago. Você pode cancelar a qualquer momento sem burocracia.',
    },
    {
      q: 'Posso atualizar o dashboard quando tiver uma nova planilha?',
      a: 'Sim! Com o recurso "Atualizar dados", você pode enviar a nova versão da planilha e o sistema compara as colunas, identifica novas linhas e atualiza todos os gráficos instantaneamente.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={onGoToDashboard}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">
                Planilha Inteligente <span className="text-blue-600 dark:text-blue-400">IA</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                100% Dados Reais
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-blue-600 transition-colors">Funcionalidades</a>
            <a href="#fluxo" className="hover:text-blue-600 transition-colors">Como Funciona</a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">Planos</a>
            <a href="#faq" className="hover:text-blue-600 transition-colors">Dúvidas</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={onGoToDashboard}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Acessar Painel
            </button>
            <button
              onClick={onOpenImport}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all"
            >
              <UploadCloud className="w-3.5 h-3.5" /> Importar Minha Planilha
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-semibold mb-6">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Trabalhe exclusivamente com seus dados reais — Sem dados fictícios
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-tight">
            Sua planilha do Excel vira um{' '}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Dashboard Interativo
            </span>{' '}
            em segundos.
          </h1>

          <p className="mt-5 text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Carregue sua planilha (.xlsx, .xls ou .csv) e visualize indicadores financeiros reais, gráficos dinâmicos Recharts, comparativos de períodos e um Analista IA dedicado aos seus números.
          </p>

          {/* Action buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <button
              onClick={onOpenImport}
              className="px-7 py-3.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 hover:scale-[1.02] transition-all"
            >
              <UploadCloud className="w-4 h-4" /> Importar Minha Planilha Agora
            </button>
            <button
              onClick={onGoToDashboard}
              className="px-7 py-3.5 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl shadow-xs flex items-center gap-2 transition-all"
            >
              Abrir Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-slate-400 mt-3">
            Formatos suportados: .xlsx, .xls e .csv • Padrão financeiro brasileiro (R$ e DD/MM/AAAA)
          </p>
        </div>

        {/* Real Data Showcase Card */}
        <div id="fluxo" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-5 mb-6 gap-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Fluxo de Análise 100% Baseado nos Seus Arquivos
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nenhum número inventado. Todos os cálculos matemáticos são auditados e precisos.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Pronto para Importar
                </span>
              </div>
            </div>

            {/* Direct Upload Banner */}
            <div
              onClick={onOpenImport}
              className="border-2 border-dashed border-blue-400 hover:border-blue-600 dark:border-blue-600 dark:hover:border-blue-400 rounded-2xl p-8 cursor-pointer bg-blue-50/30 dark:bg-blue-950/20 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 transition-all flex flex-col items-center justify-center text-center gap-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 flex items-center justify-center">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-base">
                  Arraste seu arquivo Excel ou CSV para esta área
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Ou clique aqui para selecionar no seu computador (.xlsx, .xls ou .csv)
                </p>
              </div>
              <span className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20">
                Selecionar Minha Planilha Real
              </span>
            </div>

            {/* 4 Pillars of Precision */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6 text-left text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">1. Detecção Inteligente</span>
                <p className="text-slate-500 text-[11px]">Reconhece moedas (R$ 1.250,50), datas (DD/MM/AAAA) e delimitadores (; e ,).</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">2. KPIs Verificados</span>
                <p className="text-slate-500 text-[11px]">Faturamento, despesas, margem de lucro e ticket médio calculados por código.</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">3. Gráficos Dinâmicos</span>
                <p className="text-slate-500 text-[11px]">Barras, linhas de tendência, áreas e rosca configuráveis por dimensão e métrica.</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">4. Analista IA</span>
                <p className="text-slate-500 text-[11px]">Respostas em português contextualizadas unicamente nos números da sua planilha.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Target Audiences / Benefits */}
      <section id="features" className="py-16 bg-white dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2">
              Feito para o Mercado Brasileiro
            </h2>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">
              Chega de passar horas montando gráficos manuais no Excel
            </h3>
            <p className="text-slate-500 text-sm mt-3">
              Solução sob medida para gestores, empresários e profissionais que lidam com números no dia a dia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 hover:border-blue-500 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 flex items-center justify-center mb-4">
                <DollarSign className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-base mb-2">Pequenas e Médias Empresas</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tenha clareza imediata sobre faturamento, despesas operacionais e margem de lucro sem precisar de uma equipe técnica de Business Intelligence.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 hover:border-blue-500 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-base mb-2">Vendas & Lojistas</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Acompanhe vendas por produto, categoria, vendedor e região. Identifique os itens de maior faturamento e tome decisões rápidas.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 hover:border-blue-500 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/60 text-violet-600 flex items-center justify-center mb-4">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-base mb-2">Contabilidade & Finanças</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Importe extratos e relatórios de receitas e despesas. Normalize valores no formato brasileiro (R$) com suporte a UTF-8 BOM e ponto-e-vírgula.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Comparison */}
      <section id="pricing" className="py-20 bg-slate-50 dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2">
              Planos Transparentes
            </h2>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">
              Comece grátis, faça upgrade quando crescer
            </h3>
            <p className="text-slate-500 text-sm mt-2">
              Sem contratos de longo prazo. Pagamento seguro via Mercado Pago.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Free Plan */}
            <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-xs">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Plano Gratuito</span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-slate-900 dark:text-white">R$ 0</span>
                  <span className="text-xs text-slate-500">/mês para sempre</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">Ideal para experimentar e criar os primeiros dashboards com seus dados reais.</p>

                <ul className="mt-6 space-y-3 text-xs text-slate-700 dark:text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    Até 3 importações de planilhas por mês
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    Arquivos de até 5 MB (.xlsx, .xls, .csv)
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    Até 2 dashboards salvos
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    5 perguntas mensais ao Analista IA
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    Filtros por período e categorias
                  </li>
                </ul>
              </div>

              <button
                onClick={onOpenImport}
                className="mt-8 w-full py-3 text-xs font-bold text-slate-800 dark:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Usar Plano Gratuito
              </button>
            </div>

            {/* Premium Plan */}
            <div className="p-8 rounded-3xl bg-gradient-to-b from-blue-900/10 via-white to-white dark:from-blue-950/40 dark:via-slate-900 dark:to-slate-900 border-2 border-blue-600 rounded-3xl flex flex-col justify-between shadow-xl relative">
              <div className="absolute -top-3 right-8 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
                Recomendado
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Plano Premium</span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-slate-900 dark:text-white">R$ 29,90</span>
                  <span className="text-xs text-slate-500">/mês via Mercado Pago</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">Para profissionais, consultores e empresas que demandam análises contínuas.</p>

                <ul className="mt-6 space-y-3 text-xs text-slate-700 dark:text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <strong>Importações ilimitadas</strong> de planilhas
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    Arquivos grandes de até <strong>25 MB</strong>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    Dashboards salvos ilimitados
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <strong>200 perguntas/mês</strong> com o Analista IA
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    Exportação em PDF Executivo e CSV sem marca d'água
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    Atualização inteligente de dados sem perder gráficos
                  </li>
                </ul>
              </div>

              <button
                onClick={onOpenPricing}
                className="mt-8 w-full py-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all"
              >
                <Zap className="w-4 h-4 fill-current" /> Assinar Premium por R$ 29,90/mês
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2">
              Tire Suas Dúvidas
            </h2>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              Perguntas Frequentes
            </h3>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/40"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-sm text-slate-900 dark:text-white hover:text-blue-600 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        isOpen ? 'rotate-180 text-blue-600' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-5 sm:px-5 sm:pb-5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-200/60 dark:border-slate-800/60 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-900 text-slate-400 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
              P
            </div>
            <span className="font-bold text-slate-200">Planilha Inteligente IA</span>
            <span>• SaaS de Análise Financeira e Operacional</span>
          </div>

          <div className="flex items-center gap-6 text-[11px]">
            <span>100% Dados Reais</span>
            <span>Segurança & RLS</span>
            <span>Mercado Pago Oficial</span>
            <span>© {new Date().getFullYear()} Todos os direitos reservados.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
