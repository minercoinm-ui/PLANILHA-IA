import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  FileSpreadsheet,
  ArrowRight,
  PlusCircle,
  Copy,
  Info,
} from 'lucide-react';
import {
  ProcessedDataset,
  compareDatasets,
  appendWithDeduplication,
  normalizeRows,
  calculateBusinessMetrics,
  DatasetDiffReport,
} from '../lib/dataProcessor';

interface UpdateDataModalProps {
  isOpen: boolean;
  currentDataset: ProcessedDataset;
  onClose: () => void;
  onUpdateComplete: (updatedDataset: ProcessedDataset, mode: 'replace' | 'append') => void;
}

export const UpdateDataModal: React.FC<UpdateDataModalProps> = ({
  isOpen,
  currentDataset,
  onClose,
  onUpdateComplete,
}) => {
  if (!isOpen) return null;

  const [newFile, setNewFile] = useState<File | null>(null);
  const [newRawRows, setNewRawRows] = useState<any[]>([]);
  const [diffReport, setDiffReport] = useState<DatasetDiffReport | null>(null);
  const [updateMode, setUpdateMode] = useState<'replace' | 'append'>('replace');
  const [dedupColumn, setDedupColumn] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setNewFile(file);
    setIsProcessing(true);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[];
      setNewRawRows(rows);

      // Normalize new rows
      const normalizedNew = normalizeRows(rows, 0);

      // Compare datasets
      const report = compareDatasets(
        currentDataset.columns,
        currentDataset.rows,
        normalizedNew.columns,
        normalizedNew.rows
      );
      setDiffReport(report);

      // Pick default dedup column if append mode
      const candidateKey =
        normalizedNew.columns.find(
          c =>
            c.name.toLowerCase().includes('id') ||
            c.name.toLowerCase().includes('codigo') ||
            c.name.toLowerCase().includes('pedido')
        )?.key || normalizedNew.columns[0]?.key || '';
      setDedupColumn(candidateKey);
    } catch (e: any) {
      setError(`Erro ao ler nova planilha: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyUpdate = () => {
    if (!newRawRows || newRawRows.length === 0) return;

    const normalizedNew = normalizeRows(newRawRows, 0);

    let finalRows: Record<string, any>[] = [];
    if (updateMode === 'replace') {
      finalRows = normalizedNew.rows;
    } else {
      // Append mode with deduplication
      const { combinedRows } = appendWithDeduplication(
        currentDataset.rows,
        normalizedNew.rows,
        dedupColumn ? [dedupColumn] : []
      );
      finalRows = combinedRows;
    }

    const summaryMetrics = calculateBusinessMetrics(currentDataset.columns, finalRows);

    const updatedDataset: ProcessedDataset = {
      ...currentDataset,
      rows: finalRows,
      summaryMetrics,
      importedAt: new Date().toISOString(),
    };

    onUpdateComplete(updatedDataset, updateMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-xl">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Atualizar Dados do Dashboard</h2>
              <p className="text-xs text-slate-500">
                Importe uma versão atualizada da planilha mantendo seus gráficos e filtros
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!newFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/50 dark:bg-slate-800/40 hover:bg-indigo-50/20 transition-all flex flex-col items-center justify-center gap-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
                }}
              />
              <FileSpreadsheet className="w-10 h-10 text-indigo-600" />
              <p className="font-semibold text-sm text-slate-800 dark:text-white">
                Selecione o arquivo da nova planilha
              </p>
              <p className="text-xs text-slate-500">
                Faremos a comparação estrutural automática com a versão anterior ({currentDataset.rows.length} registros).
              </p>
            </div>
          ) : (
            diffReport && (
              <div className="space-y-4 text-xs">
                {/* Structural Comparison Report */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px]">
                      Comparação com a Versão Atual:
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        diffReport.isCompatible
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {diffReport.isCompatible ? 'Estrutura 100% Compatível' : 'Atenção na Estrutura'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-700">
                      <div className="text-slate-400 text-[10px]">Linhas Anteriores</div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {diffReport.previousRowCount}
                      </div>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-700">
                      <div className="text-slate-400 text-[10px]">Novas Linhas Lidas</div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {diffReport.newRowCount}
                      </div>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-700">
                      <div className="text-slate-400 text-[10px]">Diferença</div>
                      <div
                        className={`text-sm font-bold ${
                          diffReport.rowCountDifference >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {diffReport.rowCountDifference >= 0 ? `+${diffReport.rowCountDifference}` : diffReport.rowCountDifference}
                      </div>
                    </div>
                  </div>

                  {diffReport.missingColumns.length > 0 && (
                    <div className="text-amber-700 dark:text-amber-300 p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg">
                      Colunas ausentes no novo arquivo: <strong>{diffReport.missingColumns.join(', ')}</strong>
                    </div>
                  )}

                  {diffReport.addedColumns.length > 0 && (
                    <div className="text-blue-700 dark:text-blue-300 p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
                      Novas colunas detectadas: <strong>{diffReport.addedColumns.join(', ')}</strong>
                    </div>
                  )}
                </div>

                {/* Strategy Selection */}
                <div>
                  <h4 className="font-bold uppercase text-[11px] text-slate-500 mb-2">
                    Estratégia de Atualização:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      onClick={() => setUpdateMode('replace')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        updateMode === 'replace'
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold mb-1">
                        <span>Substituir base inteira</span>
                        {updateMode === 'replace' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Substitui completamente os registros anteriores pela nova planilha. Ideal para fechamentos mensais consolidados.
                      </p>
                    </div>

                    <div
                      onClick={() => setUpdateMode('append')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        updateMode === 'append'
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold mb-1">
                        <span>Acrescentar novos registros</span>
                        {updateMode === 'append' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Adiciona novas linhas à base existente, removendo duplicidades com base em uma coluna chave.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Deduplication Key if Append mode */}
                {updateMode === 'append' && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                      Coluna Chave para Evitar Duplicados:
                    </label>
                    <select
                      value={dedupColumn}
                      onChange={(e) => setDedupColumn(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    >
                      <option value="">Toda a linha idêntica (Assinatura total)</option>
                      {currentDataset.columns.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.name} ({c.type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        {newFile && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              onClick={() => {
                setNewFile(null);
                setDiffReport(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Escolher outro arquivo
            </button>
            <button
              onClick={handleApplyUpdate}
              className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md flex items-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" /> Confirmar e Atualizar Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
