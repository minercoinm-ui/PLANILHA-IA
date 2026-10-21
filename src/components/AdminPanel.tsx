import React, { useEffect, useState } from 'react';
import {
  Users,
  DollarSign,
  FileSpreadsheet,
  Cpu,
  Shield,
  Activity,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { formatCurrencyBRL } from '../lib/dataProcessor';

interface AdminPanelProps {
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/metrics');
      const data = await res.json();
      setMetrics(data.metrics);
      setUsers(data.users || []);
      setLogs(data.recentLogs || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleChangePlan = async (targetUserId: string, newPlan: 'free' | 'premium') => {
    setUpdatingUser(targetUserId);
    try {
      const res = await fetch('/api/admin/update-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, newPlan }),
      });
      if (res.ok) {
        await fetchAdminData();
      }
    } catch (e: any) {
      setStatusMessage('Erro ao atualizar plano: ' + e.message);
    } finally {
      setUpdatingUser(null);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Painel Administrativo & Governança
                <span className="text-[10px] font-bold px-2 py-0.2 bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 rounded-full">
                  Acesso Restrito
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Auditoria de assinaturas, usuários, limites e chamadas de Inteligência Artificial
              </p>
            </div>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg">
            Fechar
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Key Metrics Cards */}
          {metrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="uppercase text-[10px] font-bold">Total Usuários</span>
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {metrics.totalUsers}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {metrics.premiumUsers} Premium • {metrics.freeUsers} Free
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="uppercase text-[10px] font-bold">MRR Estimado</span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {formatCurrencyBRL(metrics.mrrBRL)}
                </div>
                <div className="text-[11px] text-emerald-600 font-medium mt-1">
                  Receita Recorrente Mensal
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="uppercase text-[10px] font-bold">Consultas IA</span>
                  <Cpu className="w-4 h-4 text-violet-600" />
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {metrics.totalAiQueries}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 truncate" title={metrics.aiEngine}>
                  {metrics.aiEngine}
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="uppercase text-[10px] font-bold">Importações</span>
                  <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {metrics.totalImports}
                </div>
                <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                  <Activity className="w-3 h-3" /> {metrics.systemHealth}
                </div>
              </div>
            </div>
          )}

          {/* Users Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px]">
                Gestão de Usuários & Planos
              </h3>
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar por nome ou e-mail..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Usuário</th>
                    <th className="py-2.5 px-3 font-semibold">Papel</th>
                    <th className="py-2.5 px-3 font-semibold">Plano Atual</th>
                    <th className="py-2.5 px-3 font-semibold">Ação de Governança</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white">{u.name}</div>
                        <div className="text-[11px] text-slate-400">{u.email}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.role === 'admin'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.plan === 'premium'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                        >
                          {u.plan.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => handleChangePlan(u.id, u.plan === 'premium' ? 'free' : 'premium')}
                          disabled={updatingUser === u.id}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md font-medium text-[11px] transition-colors"
                        >
                          {updatingUser === u.id
                            ? 'Atualizando...'
                            : u.plan === 'premium'
                            ? 'Mudar para Free'
                            : 'Promover a Premium'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px]">
              Trilha de Auditoria Recente (Audit Logs)
            </h3>
            <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
              {logs.map((log) => (
                <div key={log.id} className="p-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-bold text-blue-600">[{log.action}]</span>
                    <span className="text-slate-500">Recurso: {log.resourceType}</span>
                    <span className="text-slate-400 truncate">Meta: {JSON.stringify(log.metadata)}</span>
                  </div>
                  <span className="text-slate-400 shrink-0 ml-2">
                    {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
