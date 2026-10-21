import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { MoreVertical, Edit2, Trash2, Download, BarChart2, TrendingUp, PieChart as PieIcon, Table as TableIcon } from 'lucide-react';
import { ChartConfig, ChartType } from '../types';
import { aggregateData, formatCurrencyBRL, formatNumberBR } from '../lib/dataProcessor';

interface ChartCardProps {
  config: ChartConfig;
  rows: Record<string, any>[];
  onEdit: (config: ChartConfig) => void;
  onDelete: (id: string) => void;
  onTypeChange: (id: string, newType: ChartType) => void;
  isCurrencyMetric?: boolean;
}

const COLOR_PALETTES = {
  blue: ['#0284c7', '#38bdf8', '#0369a1', '#7dd3fc', '#bae6fd'],
  violet: ['#7c3aed', '#a78bfa', '#6d28d9', '#c4b5fd', '#ddd6fe'],
  emerald: ['#059669', '#34d399', '#047857', '#6ee7b7', '#a7f3d0'],
  amber: ['#d97706', '#fbbf24', '#b45309', '#fcd34d', '#fef3c7'],
  rose: ['#e11d48', '#fb7185', '#be123c', '#fda4af', '#ffe4e6'],
  indigo: ['#4f46e5', '#818cf8', '#4338ca', '#a5b4fc', '#c7d2fe'],
};

export const ChartCard: React.FC<ChartCardProps> = ({
  config,
  rows,
  onEdit,
  onDelete,
  onTypeChange,
  isCurrencyMetric = false,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);

  // Close menu on click outside
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const chartData = useMemo(() => {
    return aggregateData(
      rows,
      config.xAxis,
      config.yAxis,
      config.aggregation,
      config.sortBy || 'metric_desc',
      10
    );
  }, [rows, config.xAxis, config.yAxis, config.aggregation, config.sortBy]);

  const colors = COLOR_PALETTES[config.colorPalette] || COLOR_PALETTES.blue;
  const primaryColor = colors[0];

  const formatValue = (val: number) => {
    if (isCurrencyMetric || config.yAxis.toLowerCase().includes('valor') || config.yAxis.toLowerCase().includes('faturamento') || config.yAxis.toLowerCase().includes('receita')) {
      return formatCurrencyBRL(val);
    }
    return formatNumberBR(val, 2);
  };

  const downloadPNG = () => {
    // Render simple SVG download
    if (!cardRef.current) return;
    const svg = cardRef.current.querySelector('svg');
    if (!svg) {
      console.warn('Não foi possível capturar o gráfico.');
      return;
    }
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const svgSize = svg.getBoundingClientRect();
    canvas.width = svgSize.width * 2;
    canvas.height = svgSize.height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${config.title.replace(/\s+/g, '_')}.png`;
      link.href = pngUrl;
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    setMenuOpen(false);
  };

  return (
    <div
      ref={cardRef}
      className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all"
    >
      {/* Chart Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-base">
            {config.title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {config.xAxis} vs {config.yAxis} ({config.aggregation.toUpperCase()})
          </p>
        </div>

        {/* Options Menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Opções do gráfico"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 py-1.5 text-xs">
              <div className="px-3 py-1 font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px]">
                Tipo de Visualização
              </div>
              <button
                onClick={() => { onTypeChange(config.id, 'bar'); setMenuOpen(false); }}
                className={`w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 ${config.type === 'bar' ? 'text-blue-600 font-medium' : 'text-slate-700 dark:text-slate-200'}`}
              >
                <BarChart2 className="w-3.5 h-3.5" /> Barras Verticais
              </button>
              <button
                onClick={() => { onTypeChange(config.id, 'line'); setMenuOpen(false); }}
                className={`w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 ${config.type === 'line' ? 'text-blue-600 font-medium' : 'text-slate-700 dark:text-slate-200'}`}
              >
                <TrendingUp className="w-3.5 h-3.5" /> Linha Temporal
              </button>
              <button
                onClick={() => { onTypeChange(config.id, 'pie'); setMenuOpen(false); }}
                className={`w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 ${config.type === 'pie' ? 'text-blue-600 font-medium' : 'text-slate-700 dark:text-slate-200'}`}
              >
                <PieIcon className="w-3.5 h-3.5" /> Pizza / Donut
              </button>
              <button
                onClick={() => { onTypeChange(config.id, 'table'); setMenuOpen(false); }}
                className={`w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 ${config.type === 'table' ? 'text-blue-600 font-medium' : 'text-slate-700 dark:text-slate-200'}`}
              >
                <TableIcon className="w-3.5 h-3.5" /> Tabela Resumo
              </button>

              <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>

              <button
                onClick={() => { onEdit(config); setMenuOpen(false); }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <Edit2 className="w-3.5 h-3.5" /> Editar Configurações
              </button>
              <button
                onClick={downloadPNG}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <Download className="w-3.5 h-3.5" /> Baixar Gráfico PNG
              </button>
              <button
                onClick={() => { onDelete(config.id); setMenuOpen(false); }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remover Gráfico
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chart Body */}
      <div className="h-64 w-full flex items-center justify-center">
        {chartData.length === 0 ? (
          <div className="text-center text-sm text-slate-400">
            Nenhum dado encontrado com os filtros selecionados.
          </div>
        ) : config.type === 'bar' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
              <XAxis dataKey="dimension" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => (val > 999 ? `${(val / 1000).toFixed(0)}k` : val)} stroke="#94a3b8" />
              <Tooltip
                formatter={(value: any) => [formatValue(Number(value)), config.yAxis]}
                labelStyle={{ fontWeight: 'bold' }}
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="metric" fill={primaryColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : config.type === 'horizontal_bar' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.6} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(val) => (val > 999 ? `${(val / 1000).toFixed(0)}k` : val)} stroke="#94a3b8" />
              <YAxis dataKey="dimension" type="category" tick={{ fontSize: 11 }} width={90} stroke="#94a3b8" />
              <Tooltip
                formatter={(value: any) => [formatValue(Number(value)), config.yAxis]}
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="metric" fill={primaryColor} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : config.type === 'line' ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
              <XAxis dataKey="dimension" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => (val > 999 ? `${(val / 1000).toFixed(0)}k` : val)} stroke="#94a3b8" />
              <Tooltip
                formatter={(value: any) => [formatValue(Number(value)), config.yAxis]}
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Line type="monotone" dataKey="metric" stroke={primaryColor} strokeWidth={2.5} dot={{ r: 4, fill: primaryColor }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : config.type === 'area' ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
              <XAxis dataKey="dimension" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => (val > 999 ? `${(val / 1000).toFixed(0)}k` : val)} stroke="#94a3b8" />
              <Tooltip
                formatter={(value: any) => [formatValue(Number(value)), config.yAxis]}
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Area type="monotone" dataKey="metric" stroke={primaryColor} fill={primaryColor} fillOpacity={0.2} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : config.type === 'pie' || config.type === 'donut' ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="metric"
                nameKey="dimension"
                cx="50%"
                cy="50%"
                innerRadius={config.type === 'donut' ? 45 : 0}
                outerRadius={75}
                paddingAngle={2}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any) => [formatValue(Number(value)), config.yAxis]}
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          /* Table View */
          <div className="w-full h-full overflow-y-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 px-3 font-semibold">{config.xAxis}</th>
                  <th className="py-2 px-3 font-semibold text-right">{config.yAxis}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {chartData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2 px-3 text-slate-800 dark:text-slate-200 font-medium">{item.dimension}</td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-900 dark:text-white">
                      {formatValue(item.metric)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
