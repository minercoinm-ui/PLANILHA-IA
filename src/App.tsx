import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  RefreshCw,
  Sparkles,
  Download,
  Plus,
  Layers,
  Calendar,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  LayoutDashboard,
  CheckCircle2,
  FileCheck2,
  ShieldCheck,
  Zap,
  Film,
} from 'lucide-react';
import {
  ProcessedDataset,
  MetricCardValue,
  calculateBusinessMetrics,
  formatDateBR,
  aggregateData,
} from './lib/dataProcessor';
import {
  ChartConfig,
  FilterState,
} from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MetricCard } from './components/MetricCard';
import { ChartCard } from './components/ChartCard';
import { ChartEditorModal } from './components/ChartEditorModal';
import { GlobalFilters } from './components/GlobalFilters';
import { ImportModal } from './components/ImportModal';
import { UpdateDataModal } from './components/UpdateDataModal';
import { AiAnalystDrawer } from './components/AiAnalystDrawer';
import { AdminPanel } from './components/AdminPanel';
import { TestSuiteModal } from './components/TestSuiteModal';
import { ExportModal } from './components/ExportModal';
import { VideoEditorModal } from './components/VideoEditorModal';
import { VideoHistoryModal } from './components/VideoHistoryModal';
import { LandingPage } from './components/LandingPage';

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // View state: 'dashboard' or 'landing'
  const [currentView, setCurrentView] = useState<'dashboard' | 'landing'>('dashboard');

  // Sidebar collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Check URL path/hash for direct admin access
  useEffect(() => {
    if (window.location.pathname === '/admin' || window.location.hash === '#admin') {
      setIsAdminOpen(true);
    }
  }, []);

  // Active Dataset - starts null (strictly real data only, zero fictitious data)
  const [dataset, setDataset] = useState<ProcessedDataset | null>(null);

  // Active Dashboard Charts
  const [charts, setCharts] = useState<ChartConfig[]>([]);

  // Global Filter State
  const [filters, setFilters] = useState<FilterState>({
    dateRange: 'all',
    categoricalFilters: {},
    searchTerm: '',
  });

  // Modals state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isTestsOpen, setIsTestsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isVideoEditorOpen, setIsVideoEditorOpen] = useState(false);
  const [isVideoHistoryOpen, setIsVideoHistoryOpen] = useState(false);
  const [editingChart, setEditingChart] = useState<ChartConfig | null>(null);
  const [isChartEditorOpen, setIsChartEditorOpen] = useState(false);

  // Drag-and-drop state on main view
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter dataset rows dynamically
  const filteredRows = useMemo(() => {
    if (!dataset) return [];
    return dataset.rows.filter((row) => {
      // 1. Search term check
      if (filters.searchTerm) {
        const query = filters.searchTerm.toLowerCase();
        const matchesSearch = Object.values(row).some(
          (val) => val !== null && String(val).toLowerCase().includes(query)
        );
        if (!matchesSearch) return false;
      }

      // 2. Date range filter
      if (filters.dateRange !== 'all') {
        const dateCol = dataset.columns.find((c) => c.type === 'date');
        if (dateCol && row[dateCol.key]) {
          const rowDate = new Date(row[dateCol.key]);
          if (!isNaN(rowDate.getTime())) {
            const now = new Date();
            if (filters.dateRange === '30d') {
              const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
              if (rowDate < thirtyDaysAgo) return false;
            } else if (filters.dateRange === '90d') {
              const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);
              if (rowDate < ninetyDaysAgo) return false;
            } else if (filters.dateRange === 'current_month') {
              if (rowDate.getMonth() !== now.getMonth() || rowDate.getFullYear() !== now.getFullYear()) return false;
            }
          }
        }
      }

      // 3. Categorical multi-select filters
      for (const [colKey, selectedVals] of Object.entries(filters.categoricalFilters)) {
        if (selectedVals.length > 0) {
          const rowVal = String(row[colKey] || '');
          if (!selectedVals.includes(rowVal)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [dataset, filters]);

  // Recalculate KPIs based on filtered rows
  const activeMetrics: MetricCardValue[] = useMemo(() => {
    if (!dataset) return [];
    return calculateBusinessMetrics(dataset.columns, filteredRows);
  }, [dataset, filteredRows]);

  // Chart data for export
  const chartExportData = useMemo(() => {
    if (!dataset) return [];
    return charts.map((cfg) => ({
      config: cfg,
      data: aggregateData(filteredRows, cfg.xAxis, cfg.yAxis, cfg.aggregation, cfg.sortBy, 8),
    }));
  }, [dataset, charts, filteredRows]);

  // Handle new dataset import
  const handleImportComplete = (newDataset: ProcessedDataset) => {
    setDataset(newDataset);
    setPendingFile(null);
    setFilters({ dateRange: 'all', categoricalFilters: {}, searchTerm: '' });

    // Generate smart initial charts based on detected columns
    const numericCol = newDataset.columns.find((c) => c.type === 'currency' || c.type === 'numeric') || newDataset.columns[0];
    const catCols = newDataset.columns.filter((c) => c.type === 'categorical');
    const dateCol = newDataset.columns.find((c) => c.type === 'date');

    const newCharts: ChartConfig[] = [];
    if (catCols[0] && numericCol) {
      newCharts.push({
        id: `chart_imp_1`,
        title: `${numericCol.name} por ${catCols[0].name}`,
        type: 'bar',
        xAxis: catCols[0].key,
        yAxis: numericCol.key,
        aggregation: 'sum',
        colorPalette: 'blue',
      });
    }

    if (dateCol && numericCol) {
      newCharts.push({
        id: `chart_imp_2`,
        title: `Evolução de ${numericCol.name}`,
        type: 'line',
        xAxis: dateCol.key,
        yAxis: numericCol.key,
        aggregation: 'sum',
        colorPalette: 'violet',
      });
    }

    if (catCols[1] && numericCol) {
      newCharts.push({
        id: `chart_imp_3`,
        title: `Distribuição por ${catCols[1].name}`,
        type: 'donut',
        xAxis: catCols[1].key,
        yAxis: numericCol.key,
        aggregation: 'sum',
        colorPalette: 'emerald',
      });
    }

    if (newCharts.length > 0) {
      setCharts(newCharts);
    }

    setCurrentView('dashboard');
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Handle dataset update (from UpdateDataModal)
  const handleUpdateComplete = (updatedDataset: ProcessedDataset, mode: 'replace' | 'append') => {
    setDataset(updatedDataset);
    showToast(
      mode === 'replace'
        ? `Base de dados substituída com sucesso! Total atual: ${updatedDataset.rows.length} registros.`
        : `Novos registros acrescentados sem duplicidades! Total atual: ${updatedDataset.rows.length} registros.`
    );
  };

  // Chart Actions
  const handleSaveChart = (newConfig: ChartConfig) => {
    setCharts((prev) => {
      const idx = prev.findIndex((c) => c.id === newConfig.id);
      if (idx > -1) {
        const copy = [...prev];
        copy[idx] = newConfig;
        return copy;
      }
      return [...prev, newConfig];
    });
  };

  const handleDeleteChart = (chartId: string) => {
    setCharts((prev) => prev.filter((c) => c.id !== chartId));
  };

  const handleChartTypeChange = (chartId: string, newType: any) => {
    setCharts((prev) =>
      prev.map((c) => (c.id === chartId ? { ...c, type: newType } : c))
    );
  };

  // Direct file handling for the empty-state dropzone
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = e.dataTransfer.files[0];
      setPendingFile(dropped);
      setIsImportOpen(true);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      setPendingFile(selected);
      setIsImportOpen(true);
      e.target.value = '';
    }
  };

  // If user is viewing landing page
  if (currentView === 'landing') {
    return (
      <LandingPage
        onOpenImport={() => {
          setPendingFile(null);
          setIsImportOpen(true);
        }}
        onOpenPricing={() => setIsExportOpen(true)}
        onGoToDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Top Header */}
      <Header
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenTests={() => setIsTestsOpen(true)}
        onOpenImport={() => {
          setPendingFile(null);
          setIsImportOpen(true);
        }}
        onGoHome={() => setCurrentView('landing')}
      />

      {/* Main Layout Container */}
      <div className="flex flex-1">
        {/* Collapsible Left Sidebar */}
        <Sidebar
          currentTab="dashboard"
          onTabChange={(tab) => {
            if (tab === 'home') setCurrentView('landing');
          }}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onOpenImport={() => {
            setPendingFile(null);
            setIsImportOpen(true);
          }}
          onOpenUpdate={() => {
            if (!dataset) {
              setPendingFile(null);
              setIsImportOpen(true);
            } else {
              setIsUpdateOpen(true);
            }
          }}
          onOpenAi={() => {
            if (!dataset) {
              setPendingFile(null);
              setIsImportOpen(true);
            } else {
              setIsAiOpen(true);
            }
          }}
          onOpenExport={() => {
            if (!dataset) {
              setPendingFile(null);
              setIsImportOpen(true);
            } else {
              setIsExportOpen(true);
            }
          }}
          onOpenVideo={() => {
            if (!dataset) {
              setPendingFile(null);
              setIsImportOpen(true);
            } else {
              setIsVideoEditorOpen(true);
            }
          }}
          onOpenVideoHistory={() => setIsVideoHistoryOpen(true)}
          onOpenAdmin={() => setIsAdminOpen(true)}
          onOpenTests={() => setIsTestsOpen(true)}
          onGoHome={() => setCurrentView('landing')}
        />

        {/* Dashboard Main Content Area */}
        <main
          className={`flex-1 transition-all duration-200 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full ${
            sidebarCollapsed ? 'ml-16' : 'ml-60'
          }`}
        >
          {/* If No Dataset Loaded: Prominent Real Spreadsheet Upload Center */}
          {!dataset ? (
            <div className="max-w-4xl mx-auto my-4 space-y-6">
              {/* Main Upload Box */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`bg-white dark:bg-slate-900 border-2 ${
                  isDragging
                    ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40'
                    : 'border-slate-200 dark:border-slate-800'
                } rounded-3xl p-8 sm:p-12 shadow-sm text-center transition-all`}
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/20">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold mb-4">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Ambiente 100% Real • Sem Dados Fictícios
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  Envie sua planilha para gerar o dashboard
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xl mx-auto mt-2 mb-8 leading-relaxed">
                  Carregue seu arquivo <strong>Excel (.xlsx, .xls)</strong> ou <strong>CSV</strong>. Os cálculos de faturamento, despesas, margens e os gráficos são gerados de forma determinística e imediata a partir dos seus registros.
                </p>

                {/* Drop click area */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-blue-400 dark:border-blue-600 hover:border-blue-600 dark:hover:border-blue-400 rounded-2xl p-8 cursor-pointer bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 transition-all flex flex-col items-center justify-center gap-3"
                >
                  <UploadCloud className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white text-base">
                      Clique aqui para selecionar seu arquivo
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Ou arraste e solte o arquivo diretamente nesta área
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2.5 py-1 text-[11px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg shadow-xs border border-slate-200 dark:border-slate-700">
                      .XLSX
                    </span>
                    <span className="px-2.5 py-1 text-[11px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg shadow-xs border border-slate-200 dark:border-slate-700">
                      .XLS
                    </span>
                    <span className="px-2.5 py-1 text-[11px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg shadow-xs border border-slate-200 dark:border-slate-700">
                      .CSV
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="mt-3 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all hover:scale-[1.02]"
                  >
                    Selecionar Minha Planilha Real
                  </button>
                </div>

                {/* Features Pillars */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 text-left text-xs">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <strong className="block text-slate-800 dark:text-slate-200 mb-1">Padrão Brasileiro (BRL)</strong>
                    <p className="text-slate-500 text-[11px]">Reconhece automaticamente R$ 1.250,50, vírgula decimal, parênteses e percentuais.</p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <strong className="block text-slate-800 dark:text-slate-200 mb-1">Cálculo Auditado</strong>
                    <p className="text-slate-500 text-[11px]">Sem alucinações. As métricas e totais são calculados com precisão matemática estrita.</p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <strong className="block text-slate-800 dark:text-slate-200 mb-1">Processamento Local</strong>
                    <p className="text-slate-500 text-[11px]">Seus dados são processados diretamente no navegador com máxima segurança e privacidade.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Top Dataset Banner */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 rounded-xl shrink-0">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                          {dataset.name}
                        </h1>
                        <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Dados Reais Normalizados
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {dataset.rows.length} linhas processadas • {dataset.columns.length} colunas mapeadas • Última importação:{' '}
                        {formatDateBR(dataset.importedAt)}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setIsVideoEditorOpen(true)}
                      className="px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 rounded-xl shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition-all hover:scale-[1.02]"
                      title="Criar vídeo animado corporativo de 15 segundos em Full HD 1080p"
                    >
                      <Film className="w-3.5 h-3.5" /> Criar vídeo de apresentação
                    </button>

                    <button
                      onClick={() => setIsUpdateOpen(true)}
                      className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Atualizar Dados
                    </button>

                    <button
                      onClick={() => {
                        setEditingChart(null);
                        setIsChartEditorOpen(true);
                      }}
                      className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Gráfico
                    </button>

                    <button
                      onClick={() => setIsExportOpen(true)}
                      className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Exportar
                    </button>

                    <button
                      onClick={() => setIsAiOpen(true)}
                      className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 rounded-xl shadow-md flex items-center gap-1.5 transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Analista IA
                    </button>
                  </div>
                </div>
              </div>

              {/* Business KPIs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
                {activeMetrics.map((metric) => (
                  <MetricCard key={metric.id} metric={metric} />
                ))}
              </div>

              {/* Interactive Global Filters Bar */}
              <GlobalFilters
                filters={filters}
                columns={dataset.columns}
                rows={dataset.rows}
                onChange={setFilters}
                onReset={() =>
                  setFilters({ dateRange: 'all', categoricalFilters: {}, searchTerm: '' })
                }
              />

              {/* Charts Grid */}
              {charts.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-12 text-center">
                  <LayoutDashboard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base">
                    Nenhum gráfico no dashboard
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Clique no botão abaixo para adicionar visualizações com base nas colunas da sua planilha.
                  </p>
                  <button
                    onClick={() => {
                      setEditingChart(null);
                      setIsChartEditorOpen(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs"
                  >
                    Criar Primeiro Gráfico
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {charts.map((config) => (
                    <ChartCard
                      key={config.id}
                      config={config}
                      rows={filteredRows}
                      onEdit={(cfg) => {
                        setEditingChart(cfg);
                        setIsChartEditorOpen(true);
                      }}
                      onDelete={handleDeleteChart}
                      onTypeChange={handleChartTypeChange}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals & Drawers */}
      <ImportModal
        isOpen={isImportOpen}
        initialFile={pendingFile}
        onClose={() => {
          setIsImportOpen(false);
          setPendingFile(null);
        }}
        onImportComplete={handleImportComplete}
      />

      {dataset && (
        <UpdateDataModal
          isOpen={isUpdateOpen}
          currentDataset={dataset}
          onClose={() => setIsUpdateOpen(false)}
          onUpdateComplete={handleUpdateComplete}
        />
      )}

      <ChartEditorModal
        isOpen={isChartEditorOpen}
        initialConfig={editingChart}
        columns={dataset ? dataset.columns : []}
        onSave={handleSaveChart}
        onClose={() => setIsChartEditorOpen(false)}
      />

      {dataset && (
        <AiAnalystDrawer
          isOpen={isAiOpen}
          onClose={() => setIsAiOpen(false)}
          dataset={dataset}
          metrics={activeMetrics}
        />
      )}

      {isAdminOpen && <AdminPanel onClose={() => setIsAdminOpen(false)} />}

      <TestSuiteModal
        isOpen={isTestsOpen}
        onClose={() => setIsTestsOpen(false)}
      />

      {dataset && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          dataset={dataset}
          metrics={activeMetrics}
          charts={chartExportData}
          activeFilterSummary={filters.dateRange !== 'all' ? `Período ${filters.dateRange}` : 'Completo'}
          onOpenVideoEditor={() => setIsVideoEditorOpen(true)}
        />
      )}

      {dataset && isVideoEditorOpen && (
        <VideoEditorModal
          isOpen={isVideoEditorOpen}
          onClose={() => setIsVideoEditorOpen(false)}
          datasetName={dataset.name}
          charts={chartExportData}
          metrics={activeMetrics}
          onOpenHistory={() => {
            setIsVideoEditorOpen(false);
            setIsVideoHistoryOpen(true);
          }}
        />
      )}

      {isVideoHistoryOpen && (
        <VideoHistoryModal
          isOpen={isVideoHistoryOpen}
          onClose={() => setIsVideoHistoryOpen(false)}
          onOpenEditor={() => {
            setIsVideoHistoryOpen(false);
            if (dataset) {
              setIsVideoEditorOpen(true);
            } else {
              setIsImportOpen(true);
            }
          }}
        />
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
