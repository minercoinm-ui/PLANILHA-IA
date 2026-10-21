import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { ChartConfig, ChartType, AggregationType, ColorPalette } from '../types';
import { ColumnMeta } from '../lib/dataProcessor';

interface ChartEditorModalProps {
  isOpen: boolean;
  initialConfig?: ChartConfig | null;
  columns: ColumnMeta[];
  onSave: (config: ChartConfig) => void;
  onClose: () => void;
}

export const ChartEditorModal: React.FC<ChartEditorModalProps> = ({
  isOpen,
  initialConfig,
  columns,
  onSave,
  onClose,
}) => {
  if (!isOpen) return null;

  const numericColumns = columns.filter(c => c.type === 'numeric' || c.type === 'currency' || c.type === 'percentage');
  const defaultDimension = columns.find(c => c.type === 'categorical' || c.type === 'date')?.key || columns[0]?.key || '';
  const defaultMetric = numericColumns[0]?.key || columns[0]?.key || '';

  const [title, setTitle] = useState(initialConfig?.title || 'Novo Gráfico');
  const [type, setType] = useState<ChartType>(initialConfig?.type || 'bar');
  const [xAxis, setXAxis] = useState(initialConfig?.xAxis || defaultDimension);
  const [yAxis, setYAxis] = useState(initialConfig?.yAxis || defaultMetric);
  const [aggregation, setAggregation] = useState<AggregationType>(initialConfig?.aggregation || 'sum');
  const [colorPalette, setColorPalette] = useState<ColorPalette>(initialConfig?.colorPalette || 'blue');
  const [sortBy, setSortBy] = useState<'metric_desc' | 'metric_asc' | 'dimension'>(initialConfig?.sortBy || 'metric_desc');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: initialConfig?.id || `chart_${Date.now()}`,
      title,
      type,
      xAxis,
      yAxis,
      aggregation,
      colorPalette,
      sortBy,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {initialConfig ? 'Editar Gráfico' : 'Adicionar Novo Gráfico'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Título do Gráfico</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Tipo de Visualização</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ChartType)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="bar">Barras Verticais</option>
                <option value="horizontal_bar">Barras Horizontais</option>
                <option value="line">Linha de Tendência</option>
                <option value="area">Área Contínua</option>
                <option value="pie">Pizza</option>
                <option value="donut">Rosca (Donut)</option>
                <option value="table">Tabela Agrupada</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Agregação</label>
              <select
                value={aggregation}
                onChange={(e) => setAggregation(e.target.value as AggregationType)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="sum">Soma Total</option>
                <option value="avg">Média Aritmética</option>
                <option value="count">Contagem de Registros</option>
                <option value="min">Valor Mínimo</option>
                <option value="max">Valor Máximo</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Dimensão (Eixo X / Agrupador)</label>
              <select
                value={xAxis}
                onChange={(e) => setXAxis(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                {columns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Métrica (Eixo Y / Valor)</label>
              <select
                value={yAxis}
                onChange={(e) => setYAxis(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                {numericColumns.length > 0 ? (
                  numericColumns.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name}
                    </option>
                  ))
                ) : (
                  columns.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Paleta de Cores</label>
              <select
                value={colorPalette}
                onChange={(e) => setColorPalette(e.target.value as ColorPalette)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="blue">Azul Corporativo</option>
                <option value="violet">Violeta / Roxo</option>
                <option value="emerald">Esmeralda / Verde</option>
                <option value="amber">Âmbar / Dourado</option>
                <option value="rose">Rosa / Carmim</option>
                <option value="indigo">Índigo Profundo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Ordenação</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="metric_desc">Maior para Menor (Decrescente)</option>
                <option value="metric_asc">Menor para Maior (Crescente)</option>
                <option value="dimension">Alfabética / Categórica</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-4 h-4" /> Salvar Gráfico
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
