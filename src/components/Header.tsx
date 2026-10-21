import React from 'react';
import {
  FileSpreadsheet,
  Sparkles,
  Zap,
  Shield,
  Moon,
  Sun,
  User,
  ShieldCheck,
  UploadCloud,
  CheckCircle2,
} from 'lucide-react';
import { UserProfile, UserUsage, PlanLimits } from '../types';

interface HeaderProps {
  userProfile: UserProfile;
  userUsage: UserUsage;
  planLimits: PlanLimits;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenPricing: () => void;
  onOpenAdmin: () => void;
  onOpenTests: () => void;
  onOpenImport: () => void;
  onGoHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  userProfile,
  userUsage,
  planLimits,
  darkMode,
  onToggleDarkMode,
  onOpenPricing,
  onOpenAdmin,
  onOpenTests,
  onOpenImport,
  onGoHome,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={onGoHome}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
              Planilha Inteligente <span className="text-blue-600 dark:text-blue-400">IA</span>
            </span>
            <div className="text-[10px] text-slate-400 font-medium leading-none">
              Analytics & Dashboards
            </div>
          </div>
        </div>

        {/* Center: Quick Plan Quota Counters */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Plan badge */}
          <button
            onClick={onOpenPricing}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
              userProfile.plan === 'premium'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800'
                : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 hover:bg-blue-100'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            {userProfile.plan === 'premium' ? 'Plano Premium' : 'Plano Gratuito (Upgrade)'}
          </button>

          {/* Imports Quota */}
          <div className="px-2.5 py-1 rounded-lg text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
            Importações:{' '}
            <strong className="text-slate-900 dark:text-white">
              {userUsage.importsCount}/{planLimits.maxImportsPerMonth}
            </strong>
          </div>

          {/* AI Queries Quota */}
          <div className="px-2.5 py-1 rounded-lg text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-violet-500" />
            IA:{' '}
            <strong className="text-slate-900 dark:text-white">
              {userUsage.aiQueriesCount}/{planLimits.maxAiQueriesPerMonth}
            </strong>
          </div>
        </div>

        {/* Right: Actions & User Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenImport}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
          >
            <UploadCloud className="w-3.5 h-3.5" /> Nova Planilha
          </button>

          <button
            onClick={onOpenTests}
            title="Executar Suíte de Testes Automatizados"
            className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="hidden md:inline">Testes (12)</span>
          </button>

          {userProfile.role === 'admin' && (
            <button
              onClick={onOpenAdmin}
              title="Acessar Painel Administrativo"
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <Shield className="w-4 h-4 text-rose-500" />
              <span className="hidden md:inline">Admin</span>
            </button>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={darkMode ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User Profile Pill */}
          <div
            onClick={onOpenPricing}
            className="flex items-center gap-2 pl-2 pr-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold">
              {userProfile.name.charAt(0)}
            </div>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 hidden sm:inline max-w-[120px] truncate">
              {userProfile.name}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
