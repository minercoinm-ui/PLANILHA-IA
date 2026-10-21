import React from 'react';
import {
  FileSpreadsheet,
  Moon,
  Sun,
  Shield,
  UploadCloud,
  ShieldCheck,
  Lock,
} from 'lucide-react';

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenAdmin: () => void;
  onOpenTests: () => void;
  onOpenImport: () => void;
  onGoHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  darkMode,
  onToggleDarkMode,
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
              Analytics & Dashboards Executivos
            </div>
          </div>
        </div>

        {/* Center: System Status & Public Model Notice */}
        <div className="hidden md:flex items-center gap-2">
          <div className="px-3 py-1 rounded-full text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5 border border-slate-200/60 dark:border-slate-700/60">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Acesso Livre • 1º Download PDF Grátis
          </div>
        </div>

        {/* Right: Actions & Admin Authentication */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenImport}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
          >
            <UploadCloud className="w-3.5 h-3.5" /> Nova Planilha
          </button>

          <button
            onClick={onOpenTests}
            title="Executar Suíte de Testes Automatizados"
            className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="hidden md:inline">Testes (13)</span>
          </button>

          {/* Admin Access Button */}
          <button
            onClick={onOpenAdmin}
            title="Acesso Administrativo (j14menez@gmail.com)"
            className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <Lock className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline">Admin</span>
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={darkMode ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
