import React from 'react';
import { Filter, Calendar, X, RotateCcw, Search } from 'lucide-react';
import { FilterState } from '../types';
import { ColumnMeta } from '../lib/dataProcessor';

interface GlobalFiltersProps {
  filters: FilterState;
  columns: ColumnMeta[];
  rows: Record<string, any>[];
  onChange: (updatedFilters: FilterState) => void;
  onReset: () => void;
}

export const GlobalFilters: React.FC<GlobalFiltersProps> = ({
  filters,
  columns,
  rows,
  onChange,
  onReset,
}) => {
  // Find up to 3 most relevant categorical columns for quick filters
  const filterableColumns = columns
    .filter(c => c.type === 'categorical' && c.distinctCount > 1 && c.distinctCount <= 30)
    .slice(0, 3);

  // Compute distinct options for each filterable column
  const columnOptions = React.useMemo(() => {
    const opts: Record<string, string[]> = {};
    filterableColumns.forEach(c => {
      const set = new Set<string>();
      rows.forEach(r => {
        const v = r[c.key];
        if (v !== null && v !== undefined && String(v).trim() !== '') {
          set.add(String(v));
        }
      });
      opts[c.key] = Array.from(set).sort();
    });
    return opts;
  }, [rows, filterableColumns]);

  const activeFilterCount =
    (filters.dateRange !== 'all' ? 1 : 0) +
    (filters.searchTerm ? 1 : 0) +
    Object.values(filters.categoricalFilters).reduce((acc, curr) => acc + (curr.length > 0 ? 1 : 0), 0);

  const handleDateChange = (val: string) => {
    onChange({ ...filters, dateRange: val });
  };

  const handleCategoryToggle = (columnKey: string, value: string) => {
    const current = filters.categoricalFilters[columnKey] || [];
    let updated: string[];
    if (current.includes(value)) {
      updated = current.filter(v => v !== value);
    } else {
      updated = [...current, value];
    }
    onChange({
      ...filters,
      categoricalFilters: {
        ...filters.categoricalFilters,
        [columnKey]: updated,
      },
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3.5 shadow-xs mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Filter label & inputs */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mr-2">
            <Filter className="w-4 h-4 text-blue-600" /> Filtros Globais
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 rounded-full text-[10px]">
                {activeFilterCount}
              </span>
            )}
          </div>

          {/* Search box */}
          <div className="relative min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar nos dados..."
              value={filters.searchTerm || ''}
              onChange={(e) => onChange({ ...filters, searchTerm: e.target.value })}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Date range picker */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filters.dateRange}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-transparent text-xs text-slate-700 dark:text-slate-200 font-medium focus:outline-hidden cursor-pointer"
            >
              <option value="all">Todo o período</option>
              <option value="current_month">Mês Atual</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="year">Ano de 2025</option>
            </select>
          </div>

          {/* Categorical Dropdowns */}
          {filterableColumns.map(col => {
            const selected = filters.categoricalFilters[col.key] || [];
            const options = columnOptions[col.key] || [];
            if (options.length === 0) return null;

            return (
              <div key={col.key} className="relative group">
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                  <span className="font-medium text-slate-500 dark:text-slate-400">{col.name}:</span>
                  <span className="font-semibold truncate max-w-[110px]">
                    {selected.length === 0
                      ? 'Todos'
                      : selected.length === 1
                      ? selected[0]
                      : `${selected.length} selecionados`}
                  </span>
                </div>

                {/* Popover list */}
                <div className="hidden group-hover:block absolute left-0 top-full mt-1 w-52 max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 p-2 text-xs">
                  <div className="font-semibold text-slate-400 uppercase text-[10px] mb-1.5 px-1">
                    Filtrar por {col.name}
                  </div>
                  {options.map(opt => {
                    const isChecked = selected.includes(opt);
                    return (
                      <label
                        key={opt}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCategoryToggle(col.key, opt);
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/60 cursor-pointer text-slate-800 dark:text-slate-200"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded-sm text-blue-600 focus:ring-0"
                        />
                        <span className="truncate">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Reset button */}
        {activeFilterCount > 0 && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Limpar Filtros
          </button>
        )}
      </div>

      {/* Active chips row */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] text-slate-400 mr-1">Filtros ativos:</span>
          {filters.dateRange !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[11px] font-medium">
              Período: {filters.dateRange}
              <X className="w-3 h-3 cursor-pointer" onClick={() => handleDateChange('all')} />
            </span>
          )}
          {filters.searchTerm && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[11px] font-medium">
              Busca: "{filters.searchTerm}"
              <X className="w-3 h-3 cursor-pointer" onClick={() => onChange({ ...filters, searchTerm: '' })} />
            </span>
          )}
          {Object.entries(filters.categoricalFilters).map(([k, vals]) =>
            vals.map(v => (
              <span
                key={`${k}-${v}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium"
              >
                {v}
                <X className="w-3 h-3 cursor-pointer" onClick={() => handleCategoryToggle(k, v)} />
              </span>
            ))
          )}
        </div>
      )}
    </div>
  );
};
