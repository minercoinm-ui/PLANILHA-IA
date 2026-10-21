import React, { useEffect, useState } from 'react';
import {
  Shield,
  Lock,
  DollarSign,
  FileSpreadsheet,
  Film,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Save,
  KeyRound,
  Terminal,
  Activity,
  X,
  Loader2,
  Calendar,
  Layers,
} from 'lucide-react';
import { formatCurrencyBRL } from '../lib/dataProcessor';

interface AdminPanelProps {
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loginEmail, setLoginEmail] = useState('j14menez@gmail.com');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Dashboard Stats
  const [loadingStats, setLoadingStats] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [pdfPriceInput, setPdfPriceInput] = useState<string>('4.90');
  const [videoPriceInput, setVideoPriceInput] = useState<string>('14.90');
  const [savingPrice, setSavingPrice] = useState(false);
  const [priceMessage, setPriceMessage] = useState<string | null>(null);

  // Password Change State
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passwordChangeMsg, setPasswordChangeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [changingPass, setChangingPass] = useState(false);

  // Check admin session on mount
  const checkSession = async () => {
    try {
      const res = await fetch('/api/admin/session');
      const data = await res.json();
      setIsAuthenticated(Boolean(data.authenticated));
      if (data.authenticated) {
        fetchDashboardStats();
      }
    } catch (_) {
      setIsAuthenticated(false);
    }
  };

  const fetchDashboardStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/admin/dashboard-stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        if (data.pricing) {
          setPdfPriceInput(data.pricing.pdfPrice.toString());
          setVideoPriceInput(data.pricing.videoPrice.toString());
        }
      } else if (res.status === 401) {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha na autenticação.');
      }
      setIsAuthenticated(true);
      fetchDashboardStats();
    } catch (err: any) {
      setLoginError(err.message || 'Erro ao realizar login.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (_) {}
    setIsAuthenticated(false);
    setStats(null);
  };

  const handleSavePrices = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrice(true);
    setPriceMessage(null);
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfPrice: parseFloat(pdfPriceInput),
          videoPrice: parseFloat(videoPriceInput),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar preços.');
      setPriceMessage('Preços atualizados com sucesso!');
      setTimeout(() => setPriceMessage(null), 3500);
      fetchDashboardStats();
    } catch (err: any) {
      setPriceMessage(`Erro: ${err.message}`);
    } finally {
      setSavingPrice(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPass(true);
    setPasswordChangeMsg(null);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao alterar senha.');
      setPasswordChangeMsg({ type: 'success', text: 'Senha administrativa atualizada com sucesso!' });
      setCurrentPass('');
      setNewPass('');
      setTimeout(() => {
        setShowPasswordChange(false);
        setPasswordChangeMsg(null);
      }, 2000);
    } catch (err: any) {
      setPasswordChangeMsg({ type: 'error', text: err.message });
    } finally {
      setChangingPass(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Deseja realmente limpar todos os registros de erros do servidor?')) return;
    try {
      await fetch('/api/admin/clear-logs', { method: 'POST' });
      fetchDashboardStats();
    } catch (_) {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Governança & Controle Administrativo
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 rounded-full border border-rose-200 dark:border-rose-800">
                  Acesso Restrito
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Administrador autorizado: <strong className="text-slate-700 dark:text-slate-300">j14menez@gmail.com</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Sair
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Unauthenticated Login Screen */}
          {isAuthenticated === false && (
            <div className="max-w-md mx-auto py-10 space-y-6">
              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mx-auto flex items-center justify-center">
                  <Lock className="w-6 h-6 text-rose-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Autenticação do Administrador
                </h3>
                <p className="text-xs text-slate-500">
                  Informe a senha administrativa configurada para acessar o painel de faturamento e governança.
                </p>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    E-mail Autorizado
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    readOnly
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-slate-500 text-xs cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Senha Administrativa
                  </label>
                  <input
                    type="password"
                    placeholder="Digite sua senha de administrador"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2"
                >
                  {loginLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  Acessar Painel Administrativo
                </button>
              </form>
            </div>
          )}

          {/* Authenticated Admin Dashboard */}
          {isAuthenticated === true && (
            <>
              {loadingStats && !stats && (
                <div className="py-12 flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-6 h-6 text-rose-600 animate-spin" />
                  <p className="text-slate-500">Carregando métricas e dados de auditoria...</p>
                </div>
              )}

              {stats && (
                <div className="space-y-6">
                  {/* Financial & Operational Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Real Revenue Card */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between text-slate-400 mb-1.5">
                        <span className="uppercase text-[10px] font-bold">Faturamento Real (Pix)</span>
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white">
                        {formatCurrencyBRL(stats.financials.realRevenueBrl)}
                      </div>
                      <div className="text-[11px] text-emerald-600 font-semibold mt-1">
                        {stats.financials.totalRealTransactions} pagamentos confirmados
                      </div>
                    </div>

                    {/* PDF Tasks Card */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between text-slate-400 mb-1.5">
                        <span className="uppercase text-[10px] font-bold">Relatórios PDF</span>
                        <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white">
                        {stats.tasks.pdfTasksCount}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {stats.tasks.freePdfClaimsCount} visitantes no 1º PDF grátis
                      </div>
                    </div>

                    {/* Video Rendering Tasks Card */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between text-slate-400 mb-1.5">
                        <span className="uppercase text-[10px] font-bold">Vídeos Full HD (1080p)</span>
                        <Film className="w-4 h-4 text-violet-600" />
                      </div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white">
                        {stats.tasks.videoTasksCount}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        100% pagamentos avulsos
                      </div>
                    </div>

                    {/* System Health */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between text-slate-400 mb-1.5">
                        <span className="uppercase text-[10px] font-bold">Status do Servidor</span>
                        <Activity className="w-4 h-4 text-rose-600" />
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                        100% Operacional
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 truncate" title={stats.system.ffmpegPath}>
                        FFmpeg: {stats.system.ffmpegPath ? 'Disponível' : 'Ausente'}
                      </div>
                    </div>
                  </div>

                  {/* Price Configuration & Admin Settings */}
                  <div className="p-5 bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <h3 className="font-bold text-slate-900 dark:text-white uppercase text-[11px]">
                          Tabela de Preços dos Serviços (Pay-Per-Task)
                        </h3>
                      </div>
                      <button
                        onClick={() => setShowPasswordChange(!showPasswordChange)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5" /> Alterar Senha Admin
                      </button>
                    </div>

                    <form onSubmit={handleSavePrices} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Preço do PDF Adicional (R$)
                        </label>
                        <input
                          type="number"
                          step="0.10"
                          min="0"
                          value={pdfPriceInput}
                          onChange={(e) => setPdfPriceInput(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold"
                        />
                        <span className="text-[10px] text-slate-400">1º PDF do visitante é gratuito</span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Preço Renderização Vídeo Full HD (R$)
                        </label>
                        <input
                          type="number"
                          step="0.50"
                          min="0"
                          value={videoPriceInput}
                          onChange={(e) => setVideoPriceInput(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold"
                        />
                        <span className="text-[10px] text-slate-400">Todos os vídeos são pagos</span>
                      </div>

                      <div>
                        <button
                          type="submit"
                          disabled={savingPrice}
                          className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                        >
                          {savingPrice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Salvar Alterações
                        </button>
                      </div>
                    </form>

                    {priceMessage && (
                      <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-xl text-[11px] flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{priceMessage}</span>
                      </div>
                    )}

                    {/* Change Password Panel if toggled */}
                    {showPasswordChange && (
                      <form onSubmit={handleChangePassword} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 mt-3 animate-in fade-in">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                          <KeyRound className="w-4 h-4 text-rose-600" /> Alterar Senha Administrativa
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="password"
                            placeholder="Senha Atual"
                            value={currentPass}
                            onChange={(e) => setCurrentPass(e.target.value)}
                            required
                            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                          />
                          <input
                            type="password"
                            placeholder="Nova Senha (mínimo 6 caracteres)"
                            value={newPass}
                            onChange={(e) => setNewPass(e.target.value)}
                            required
                            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowPasswordChange(false)}
                            className="px-3 py-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={changingPass}
                            className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg"
                          >
                            {changingPass ? 'Salvando...' : 'Confirmar Nova Senha'}
                          </button>
                        </div>
                        {passwordChangeMsg && (
                          <div className={`p-2 rounded-lg text-[11px] ${passwordChangeMsg.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {passwordChangeMsg.text}
                          </div>
                        )}
                      </form>
                    )}
                  </div>

                  {/* Tasks & Files Table */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px] flex items-center justify-between">
                      <span>Tarefas Recentes de Arquivos & Vídeos</span>
                      <button
                        onClick={fetchDashboardStats}
                        className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-[10px]"
                      >
                        <RefreshCw className="w-3 h-3" /> Atualizar
                      </button>
                    </h3>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="py-2.5 px-3 font-semibold">ID / Tarefa</th>
                            <th className="py-2.5 px-3 font-semibold">Tipo</th>
                            <th className="py-2.5 px-3 font-semibold">Status</th>
                            <th className="py-2.5 px-3 font-semibold">Valor</th>
                            <th className="py-2.5 px-3 font-semibold">Data / Hora</th>
                            <th className="py-2.5 px-3 font-semibold">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {stats.recentTasks?.map((task: any) => (
                            <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]" title={task.title}>
                                  {task.title || 'Sem título'}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">{task.id}</div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="uppercase text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                  {task.serviceType}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    task.status === 'ready' || task.status === 'completed' || task.status === 'free_granted'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : task.status === 'paid'
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  }`}
                                >
                                  {task.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                                {task.amountBrl === 0 ? 'Gratuito (1º)' : formatCurrencyBRL(task.amountBrl)}
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                                {new Date(task.createdAt).toLocaleString('pt-BR')}
                              </td>
                              <td className="py-2.5 px-3">
                                {task.downloadUrl ? (
                                  <a
                                    href={task.downloadUrl}
                                    download
                                    className="px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold hover:bg-blue-100"
                                  >
                                    Baixar
                                  </a>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {(!stats.recentTasks || stats.recentTasks.length === 0) && (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-slate-400">
                                Nenhuma tarefa registrada ainda no servidor.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Error Logs Audit */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px] flex items-center gap-1.5">
                        <Terminal className="w-4 h-4 text-rose-600" />
                        Registros de Auditoria & Erros Técnicos ({stats.errorLogs?.length || 0})
                      </h3>
                      <button
                        onClick={handleClearLogs}
                        className="text-slate-400 hover:text-rose-600 text-[10px] font-semibold"
                      >
                        Limpar Logs
                      </button>
                    </div>

                    <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[10px] bg-slate-950 text-slate-300 p-2">
                      {stats.errorLogs?.map((log: any) => (
                        <div key={log.id} className="py-1.5 flex items-start justify-between gap-2">
                          <div>
                            <span className="text-rose-400 font-bold">[{log.service}]</span>{' '}
                            <span>{log.message}</span>
                            {log.details && <span className="text-slate-500 block">{log.details}</span>}
                          </div>
                          <span className="text-slate-500 shrink-0">
                            {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                          </span>
                        </div>
                      ))}
                      {(!stats.errorLogs || stats.errorLogs.length === 0) && (
                        <div className="py-4 text-center text-slate-500">
                          Nenhum erro registrado. Sistema operando de forma 100% íntegra.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
