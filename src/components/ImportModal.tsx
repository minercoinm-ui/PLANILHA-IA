import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
  Layers,
  Sparkles,
  HelpCircle,
  ArrowRight,
  Database,
} from 'lucide-react';
import {
  detectCsvDelimiter,
  normalizeRows,
  calculateBusinessMetrics,
  ProcessedDataset,
  ColumnType,
} from '../lib/dataProcessor';
import { PlanLimits } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (dataset: ProcessedDataset) => void;
  planLimits: PlanLimits;
  initialFile?: File | null;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  planLimits,
  initialFile,
}) => {
  if (!isOpen) return null;

  const [step, setStep] = useState<'upload' | 'sheets' | 'configure' | 'preview'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);
  const [columnOverrides, setColumnOverrides] = useState<Record<string, { name: string; type: ColumnType }>>({});
  const [datasetName, setDatasetName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (initialFile) {
      handleFile(initialFile);
    }
  }, [initialFile]);

  const handleFile = async (selectedFile: File) => {
    setErrorMessage(null);

    // 1. Validate file extension
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const lowerName = selectedFile.name.toLowerCase();
    const isValidExt = validExtensions.some(ext => lowerName.endsWith(ext));
    if (!isValidExt) {
      setErrorMessage('Formato inválido. Aceitamos arquivos .xlsx, .xls ou .csv.');
      return;
    }

    // 2. Validate file size based on plan limits
    const maxBytes = planLimits.maxFileSizeMb * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      setErrorMessage(
        `Arquivo de ${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB excede o limite do seu plano (${planLimits.maxFileSizeMb} MB). Faça upgrade para o Premium para arquivos de até 25 MB.`
      );
      return;
    }

    setFile(selectedFile);
    setDatasetName(selectedFile.name.replace(/\.[^/.]+$/, ''));
    setIsLoading(true);

    try {
      const buffer = await selectedFile.arrayBuffer();

      if (lowerName.endsWith('.csv')) {
        // Read CSV as text with Brazilian delimiter check
        const textDecoder = new TextDecoder('utf-8');
        let text = textDecoder.decode(buffer);

        // Fallback for Windows-1252 / ISO-8859-1 if replacement characters are found
        if (text.includes('')) {
          try {
            const latinDecoder = new TextDecoder('windows-1252');
            text = latinDecoder.decode(buffer);
          } catch (_) {}
        }

        const delimiter = detectCsvDelimiter(text);
        const wb = XLSX.read(text, { type: 'string', raw: true });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[];

        setWorkbook(wb);
        setSheetNames([sheetName]);
        setSelectedSheet(sheetName);
        setRawRows(rows);
        setStep('configure');
      } else {
        // Excel (.xlsx, .xls)
        const wb = XLSX.read(buffer, { type: 'array' });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        setSelectedSheet(wb.SheetNames[0]);

        if (wb.SheetNames.length > 1) {
          setStep('sheets');
        } else {
          loadSheetData(wb, wb.SheetNames[0]);
          setStep('configure');
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(`Erro ao processar o arquivo: ${err.message || 'Arquivo corrompido ou ilegível.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSheetData = (wb: XLSX.WorkBook, sheetName: string) => {
    const sheet = wb.Sheets[sheetName];
    // sheet_to_json returns rows as array of arrays
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[];
    setRawRows(rows);
  };

  const handleSheetConfirm = () => {
    if (workbook && selectedSheet) {
      loadSheetData(workbook, selectedSheet);
      setStep('configure');
    }
  };

  // Preview processed data
  const normalized = React.useMemo(() => {
    if (rawRows.length === 0) return null;
    const norm = normalizeRows(rawRows, headerRowIndex);

    // Apply column overrides if any
    const updatedColumns = norm.columns.map(col => {
      const override = columnOverrides[col.key];
      if (override) {
        return {
          ...col,
          name: override.name || col.name,
          type: override.type || col.type,
        };
      }
      return col;
    });

    return {
      ...norm,
      columns: updatedColumns,
    };
  }, [rawRows, headerRowIndex, columnOverrides]);

  const handleFinalizeImport = () => {
    if (!normalized || normalized.rows.length === 0) {
      setErrorMessage('Nenhuma linha válida encontrada para importar.');
      return;
    }

    const summaryMetrics = calculateBusinessMetrics(normalized.columns, normalized.rows);

    const dataset: ProcessedDataset = {
      id: `dataset_${Date.now()}`,
      name: datasetName || 'Planilha Importada',
      sheetName: selectedSheet,
      columns: normalized.columns,
      rows: normalized.rows,
      quality: normalized.quality,
      summaryMetrics,
      importedAt: new Date().toISOString(),
    };

    onImportComplete(dataset);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Importar Planilha de Dados</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Excel (.xlsx, .xls) ou CSV • Limite: até {planLimits.maxFileSizeMb} MB por arquivo
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

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-6">
              {/* Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFile(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/50 dark:bg-slate-800/40 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 transition-all flex flex-col items-center justify-center gap-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFile(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">
                    Arraste sua planilha aqui ou clique para selecionar
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Compatível com planilhas financeiras, vendas, comissões e DRE
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                  <span className="px-2 py-0.5 bg-slate-200/60 dark:bg-slate-700 rounded-md">.XLSX</span>
                  <span className="px-2 py-0.5 bg-slate-200/60 dark:bg-slate-700 rounded-md">.XLS</span>
                  <span className="px-2 py-0.5 bg-slate-200/60 dark:bg-slate-700 rounded-md">.CSV</span>
                </div>
              </div>

              {/* Real Data Import Guidelines */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 text-left">
                <div className="text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Processamento 100% com Dados Reais
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400">
                  <div>
                    <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">• Valores em Reais (BRL):</strong>
                    Reconhece automaticamente R$ 1.250,50, valores contábeis entre parênteses e percentuais.
                  </div>
                  <div>
                    <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">• Datas no Padrão Brasileiro:</strong>
                    Suporte nativo a DD/MM/AAAA e identificação de evolução temporal mensal/anual.
                  </div>
                  <div>
                    <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">• Arquivos CSV & Excel:</strong>
                    Detecta delimitadores (ponto-e-vírgula ;, vírgula ,, tabulação) e múltiplas abas (.xlsx).
                  </div>
                  <div>
                    <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">• Mapeamento Seguro:</strong>
                    Permite revisar o cabeçalho e ajustar o tipo de cada coluna antes de gerar os gráficos.
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'sheets' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                <Layers className="w-4 h-4 text-blue-600" />
                Selecione a aba da planilha para importar:
              </div>
              <p className="text-xs text-slate-500">
                Identificamos múltiplas abas no arquivo Excel. Escolha qual delas contém a base de dados principal.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                {sheetNames.map((name) => (
                  <div
                    key={name}
                    onClick={() => setSelectedSheet(name)}
                    className={`p-3.5 rounded-xl border cursor-pointer text-sm font-medium flex items-center justify-between ${
                      selectedSheet === name
                        ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{name}</span>
                    {selectedSheet === name && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                  </div>
                ))}
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Voltar
                </button>
                <button
                  onClick={handleSheetConfirm}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Continuar com a aba "{selectedSheet}"
                </button>
              </div>
            </div>
          )}

          {step === 'configure' && normalized && (
            <div className="space-y-5">
              {/* Dataset Name & Header Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Nome do Dataset</label>
                  <input
                    type="text"
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Linha do Cabeçalho (Header)
                  </label>
                  <select
                    value={headerRowIndex}
                    onChange={(e) => setHeaderRowIndex(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value={0}>Linha 1 (Padrão)</option>
                    <option value={1}>Linha 2 (Pular título superior)</option>
                    <option value={2}>Linha 3</option>
                  </select>
                </div>
              </div>

              {/* Data Quality Report Badges */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-slate-400">Registros lidos:</span>{' '}
                    <strong className="text-slate-800 dark:text-white">{normalized.rows.length}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Colunas:</span>{' '}
                    <strong className="text-slate-800 dark:text-white">{normalized.columns.length}</strong>
                  </div>
                  {normalized.quality.emptyRowsRemoved > 0 && (
                    <div className="text-amber-600">
                      Vazias removidas: <strong>{normalized.quality.emptyRowsRemoved}</strong>
                    </div>
                  )}
                  {normalized.quality.duplicateRows > 0 && (
                    <div className="text-amber-600">
                      Duplicadas: <strong>{normalized.quality.duplicateRows}</strong>
                    </div>
                  )}
                </div>
                <div className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Base Normalizada
                </div>
              </div>

              {/* Warnings */}
              {normalized.quality.warnings.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Avisos de qualidade dos dados:
                  </div>
                  {normalized.quality.warnings.map((w, idx) => (
                    <div key={idx} className="pl-4 text-[11px] list-disc">• {w}</div>
                  ))}
                </div>
              )}

              {/* Columns Inspection & Overrides */}
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">
                  Colunas Detectadas e Tipos (Você pode corrigir se necessário):
                </h4>
                <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {normalized.columns.map((col) => (
                    <div key={col.key} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <div className="flex-1 truncate">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{col.name}</span>
                        <span className="text-[10px] text-slate-400 ml-2">
                          (Exemplos: {col.sampleValues.slice(0, 2).join(', ')})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={col.type}
                          onChange={(e) => {
                            setColumnOverrides({
                              ...columnOverrides,
                              [col.key]: {
                                name: col.name,
                                type: e.target.value as ColumnType,
                              },
                            });
                          }}
                          className="px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md font-medium text-slate-700 dark:text-slate-200"
                        >
                          <option value="currency">Moeda (R$)</option>
                          <option value="numeric">Número</option>
                          <option value="percentage">Percentual (%)</option>
                          <option value="date">Data (DD/MM/AAAA)</option>
                          <option value="categorical">Texto / Categoria</option>
                          <option value="boolean">Booleano (Sim/Não)</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview Table of first 4 rows */}
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Prévia dos Dados:</h4>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                        {normalized.columns.slice(0, 6).map((c) => (
                          <th key={c.key} className="py-2 px-3 font-semibold whitespace-nowrap">
                            {c.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {normalized.rows.slice(0, 4).map((r, rowIdx) => (
                        <tr key={rowIdx}>
                          {normalized.columns.slice(0, 6).map((c) => (
                            <td key={c.key} className="py-2 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {r[c.key] !== null ? String(r[c.key]) : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {step === 'configure' && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              onClick={() => setStep('upload')}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Escolher outro arquivo
            </button>
            <button
              onClick={handleFinalizeImport}
              className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" /> Gerar Dashboard Inteligente
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
