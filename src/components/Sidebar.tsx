import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  RefreshCw,
  Sparkles,
  Download,
  Shield,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Home,
  Lock,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenImport: () => void;
  onOpenUpdate: () => void;
  onOpenAi: () => void;
  onOpenExport: () => void;
  onOpenVideo: () => void;
  onOpenVideoHistory: () => void;
  onOpenAdmin: () => void;
  onOpenTests: () => void;
  onGoHome: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
  onOpenImport,
  onOpenUpdate,
  onOpenAi,
  onOpenExport,
  onOpenVideo,
  onOpenVideoHistory,
  onOpenAdmin,
  onOpenTests,
  onGoHome,
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard Atual', icon: LayoutDashboard, action: () => onTabChange('dashboard') },
    { id: 'video', label: 'Vídeo Apresentação', icon: Sparkles, action: onOpenVideo, badge: '1080p' },
    { id: 'my_videos', label: 'Meus Vídeos', icon: FolderKanban, action: onOpenVideoHistory },
    { id: 'import', label: 'Importar Planilha', icon: UploadCloud, action: onOpenImport },
    { id: 'update', label: 'Atualizar Dados', icon: RefreshCw, action: onOpenUpdate },
    { id: 'ai', label: 'Analista IA', icon: Sparkles, action: onOpenAi, badge: 'IA' },
    { id: 'export', label: 'Exportar Relatórios', icon: Download, action: onOpenExport },
    { id: 'admin', label: 'Painel Admin', icon: Lock, action: onOpenAdmin },
    { id: 'tests', label: 'Testes Automatizados', icon: ShieldCheck, action: onOpenTests },
    { id: 'home', label: 'Página Inicial (Landing)', icon: Home, action: onGoHome },
  ];

  return (
    <aside
      className={`fixed top-16 left-0 bottom-0 z-30 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 transition-all duration-200 flex flex-col justify-between ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Navigation Links */}
      <div className="p-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={item.action}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              } ${collapsed ? 'justify-center' : 'justify-between'}`}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </div>

              {!collapsed && item.badge && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Collapse Toggle at Bottom */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={collapsed ? 'Expandir Menu' : 'Recolher Menu'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span className="ml-2 text-xs font-medium">Recolher Menu</span>}
        </button>
      </div>
    </aside>
  );
};
