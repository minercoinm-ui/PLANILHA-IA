import React, { useState, useEffect } from 'react';
import {
  Download,
  Trash2,
  X,
  Clock,
  Film,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { VideoExportRecord } from '../types/video';
import { UserProfile } from '../types';

interface VideoHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onOpenEditor: () => void;
}

export const VideoHistoryModal: React.FC<VideoHistoryModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onOpenEditor,
}) => {
  const [history, setHistory] = useState<VideoExportRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/video/history', {
        headers: { 'x-user-id': userProfile.id },
      });
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setHistory(data.history || []);
        } catch (_) {}
      }
    } catch (err) {
      console.warn('Failed to fetch video history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [userProfile.id]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/video/history/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userProfile.id },
      });
      if (res.ok) {
        setHistory((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.warn('Failed to delete video record:', err);
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-slate-100 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Meus Vídeos Exportados</h2>
              <p className="text-xs text-slate-400">
                Histórico de apresentações corporativas geradas em Full HD
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenEditor();
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Criar Novo Vídeo
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Table / List */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              <span>Carregando histórico de vídeos...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <Film className="w-12 h-12 text-slate-700 mx-auto" />
              <div>
                <h3 className="font-bold text-slate-300 text-sm">Nenhum vídeo gerado ainda</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Utilize o editor de vídeo para criar animações dos seus gráficos e indicadores corporativos em Full HD 1080p.
                </p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenEditor();
                }}
                className="mt-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Criar Primeiro Vídeo
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((record) => {
                const dateFormatted = new Date(record.createdAt).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const sizeMb = record.fileSizeBytes
                  ? `${(record.fileSizeBytes / 1024 / 1024).toFixed(2)} MB`
                  : 'N/A';

                return (
                  <div
                    key={record.id}
                    className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
                        <Film className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{record.title}</h4>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-950 text-blue-400 border border-blue-800/60 uppercase">
                            {record.format}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                          <span>{dateFormatted}</span>
                          <span>•</span>
                          <span>{record.resolution}</span>
                          <span>•</span>
                          <span>{record.durationSeconds}s</span>
                          <span>•</span>
                          <span>{sizeMb}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <a
                        href={record.downloadUrl}
                        download={`${(record.title || 'apresentacao_executiva')
                          .normalize('NFD')
                          .replace(/[\u0300-\u036f]/g, '')
                          .replace(/[^a-zA-Z0-9_-]/g, '_')
                          .replace(/_+/g, '_')
                          .replace(/^_|_$/g, '') || 'apresentacao_executiva'}_1080p.${record.format}`}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" /> Baixar
                      </a>

                      <button
                        onClick={() => handleDelete(record.id)}
                        disabled={deletingId === record.id}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors disabled:opacity-50"
                        title="Excluir vídeo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Retention Notice */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/60 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Política de retenção: os arquivos permanecem disponíveis para download por 30 dias.</span>
          <button onClick={fetchHistory} className="text-blue-400 hover:underline flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Atualizar
          </button>
        </div>
      </div>
    </div>
  );
};
