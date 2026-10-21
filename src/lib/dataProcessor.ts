/**
 * Data Processor Engine for Planilha Inteligente IA
 * Handles Excel, CSV (semicolon & comma), Brazilian currency (R$), percentages,
 * DD/MM/YYYY dates, type inference, aggregations, KPIs, and quality warnings.
 */

export type ColumnType = 'currency' | 'numeric' | 'percentage' | 'date' | 'categorical' | 'boolean';

export interface ColumnMeta {
  key: string;
  name: string;
  type: ColumnType;
  sampleValues: (string | number | boolean | null)[];
  nullCount: number;
  distinctCount: number;
  inconsistentCount: number;
}

export interface DataQualityReport {
  totalRows: number;
  totalColumns: number;
  emptyRowsRemoved: number;
  duplicateRows: number;
  warnings: string[];
  columnsWithIssues: string[];
}

export interface MetricCardValue {
  id: string;
  label: string;
  title?: string;
  value: number | string;
  formattedValue: string;
  changePercent?: number; // e.g. +12.5% vs previous period
  changeType?: 'positive' | 'negative' | 'neutral';
  tooltip?: string;
  available: boolean;
  missingExplanation?: string;
}

export interface ProcessedDataset {
  id: string;
  name: string;
  sheetName?: string;
  columns: ColumnMeta[];
  rows: Record<string, any>[];
  quality: DataQualityReport;
  summaryMetrics: MetricCardValue[];
  importedAt: string;
}

/**
 * Clean & detect CSV delimiter: checks ;, ,, \t, |
 */
export function detectCsvDelimiter(firstLines: string): string {
  const delimiters = [';', ',', '\t', '|'];
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0, '|': 0 };

  const sample = firstLines.slice(0, 2000);
  for (const char of sample) {
    if (counts[char] !== undefined) {
      counts[char]++;
    }
  }

  // Pick the delimiter with highest count
  let maxCount = -1;
  let chosen = ',';
  for (const d of delimiters) {
    if (counts[d] > maxCount) {
      maxCount = counts[d];
      chosen = d;
    }
  }
  return chosen;
}

/**
 * Parse Brazilian and international numbers, currencies, percentages
 */
export function parseNumberBR(raw: any): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return isNaN(raw) ? null : raw;

  let str = String(raw).trim();
  if (str === '' || str === '-' || str === 'N/A' || str === 'NaN') return null;

  // Handle accounting parentheses: "(1.250,50)" => "-1.250,50"
  let isNegative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  } else if (str.startsWith('-')) {
    isNegative = true;
    str = str.slice(1).trim();
  }

  // Remove currency symbols & NBSP
  str = str.replace(/[R$\s\u00A0%]/g, '');

  // Detect Brazilian format: e.g. "1.250,50" or "1250,50"
  // If string contains comma, it is usually decimal separator in Brazil
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');

  if (lastComma > -1 && (lastDot === -1 || lastComma > lastDot)) {
    // BR format: dots are thousands, comma is decimal
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > -1 && (lastComma === -1 || lastDot > lastComma)) {
    // US format: commas are thousands, dot is decimal
    str = str.replace(/,/g, '');
  }

  const num = parseFloat(str);
  if (isNaN(num)) return null;
  return isNegative ? -num : num;
}

/**
 * Format number as Brazilian Currency (BRL)
 */
export function formatCurrencyBRL(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

export const formatCurrencyBR = formatCurrencyBRL;

/**
 * Format standard number in Brazilian standard (1.234,56)
 */
export function formatNumberBR(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals > 0 ? decimals : 0,
    maximumFractionDigits: decimals,
  }).format(val);
}

/**
 * Parse date string (DD/MM/YYYY, YYYY-MM-DD, or Excel serial timestamp)
 */
export function parseDateBR(raw: any): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;

  // Excel serial number (e.g. 45000 is ~2023)
  if (typeof raw === 'number' && raw > 30000 && raw < 70000) {
    const epoch = new Date(1899, 11, 30);
    const date = new Date(epoch.getTime() + raw * 86400000);
    return isNaN(date.getTime()) ? null : date;
  }

  const str = String(raw).trim();
  // Match DD/MM/YYYY or DD-MM-YYYY
  const brMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (brMatch) {
    const day = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10) - 1;
    const year = parseInt(brMatch[3], 10);
    const hour = brMatch[4] ? parseInt(brMatch[4], 10) : 0;
    const min = brMatch[5] ? parseInt(brMatch[5], 10) : 0;
    const sec = brMatch[6] ? parseInt(brMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    return isNaN(d.getTime()) ? null : d;
  }

  // ISO / Standard format
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format Date as DD/MM/YYYY
 */
export function formatDateBR(raw: any): string {
  const d = parseDateBR(raw);
  if (!d) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Check if string looks like currency (R$, $, etc.)
 */
function isCurrencyString(val: string): boolean {
  return /^(R\$|\$|€|£)\s*[\d\.,]+|[\d\.,]+\s*(reais|BRL)/i.test(val.trim());
}

/**
 * Check if string is percentage
 */
function isPercentageString(val: string): boolean {
  return /^-?[\d\.,]+\s*%$/.test(val.trim());
}

/**
 * Infer column type from an array of sample values
 */
export function inferColumnType(values: any[], headerName = ''): ColumnType {
  const lowerHeader = headerName.toLowerCase();
  
  if (
    lowerHeader.includes('data') ||
    lowerHeader.includes('date') ||
    lowerHeader.includes('periodo') ||
    lowerHeader.includes('dia') ||
    lowerHeader.includes('vencimento')
  ) {
    return 'date';
  }

  if (
    lowerHeader.includes('preco') ||
    lowerHeader.includes('preço') ||
    lowerHeader.includes('valor') ||
    lowerHeader.includes('receita') ||
    lowerHeader.includes('faturamento') ||
    lowerHeader.includes('despesa') ||
    lowerHeader.includes('custo') ||
    lowerHeader.includes('lucro') ||
    lowerHeader.includes('total') ||
    lowerHeader.includes('salario') ||
    lowerHeader.includes('comissao')
  ) {
    return 'currency';
  }

  if (lowerHeader.includes('taxa') || lowerHeader.includes('margem') || lowerHeader.includes('%') || lowerHeader.includes('percent')) {
    return 'percentage';
  }

  let currencyHits = 0;
  let percentHits = 0;
  let dateHits = 0;
  let numberHits = 0;
  let booleanHits = 0;
  let totalNonEmpty = 0;

  for (const v of values) {
    if (v === null || v === undefined || v === '') continue;
    totalNonEmpty++;
    const str = String(v).trim();

    if (str.toLowerCase() === 'true' || str.toLowerCase() === 'false' || str.toLowerCase() === 'sim' || str.toLowerCase() === 'não') {
      booleanHits++;
      continue;
    }

    if (isCurrencyString(str)) {
      currencyHits++;
      continue;
    }

    if (isPercentageString(str)) {
      percentHits++;
      continue;
    }

    if (parseDateBR(v) !== null && (str.includes('/') || str.includes('-')) && str.length >= 8) {
      dateHits++;
      continue;
    }

    if (parseNumberBR(v) !== null && !isNaN(parseNumberBR(v)!)) {
      numberHits++;
      continue;
    }
  }

  if (totalNonEmpty === 0) return 'categorical';

  if (booleanHits / totalNonEmpty > 0.7) return 'boolean';
  if (currencyHits / totalNonEmpty > 0.4) return 'currency';
  if (percentHits / totalNonEmpty > 0.4) return 'percentage';
  if (dateHits / totalNonEmpty > 0.6) return 'date';
  if (numberHits / totalNonEmpty > 0.6) {
    // If it's a number and header has financial clues, make currency, else numeric
    return 'numeric';
  }

  return 'categorical';
}

/**
 * Clean and process raw rows from XLSX or CSV
 */
export function normalizeRows(rawRows: any[], headerRowIndex = 0): {
  columns: ColumnMeta[];
  rows: Record<string, any>[];
  quality: DataQualityReport;
} {
  if (!rawRows || rawRows.length === 0) {
    return {
      columns: [],
      rows: [],
      quality: {
        totalRows: 0,
        totalColumns: 0,
        emptyRowsRemoved: 0,
        duplicateRows: 0,
        warnings: ['O arquivo fornecido está vazio ou não possui linhas válidas.'],
        columnsWithIssues: [],
      },
    };
  }

  // Determine headers
  let headers: string[] = [];
  const headerRow = rawRows[headerRowIndex] || [];
  
  if (Array.isArray(headerRow)) {
    headers = headerRow.map((cell, idx) => {
      const title = String(cell || '').trim();
      return title !== '' ? title : `Coluna_${idx + 1}`;
    });
  } else if (typeof headerRow === 'object') {
    headers = Object.keys(headerRow);
  }

  // De-duplicate headers if two columns have the same name
  const seenHeaders: Record<string, number> = {};
  headers = headers.map(h => {
    if (!seenHeaders[h]) {
      seenHeaders[h] = 1;
      return h;
    } else {
      seenHeaders[h]++;
      return `${h}_${seenHeaders[h]}`;
    }
  });

  const dataRowsRaw = rawRows.slice(headerRowIndex + 1);
  const cleanRows: Record<string, any>[] = [];
  let emptyRowsRemoved = 0;
  const rowSignatures = new Set<string>();
  let duplicateRows = 0;

  for (const row of dataRowsRaw) {
    // Check if whole row is empty
    let isEmpty = true;
    const rowObj: Record<string, any> = {};

    headers.forEach((h, colIdx) => {
      const val = Array.isArray(row) ? row[colIdx] : row[h];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        isEmpty = false;
      }
      rowObj[h] = val;
    });

    if (isEmpty) {
      emptyRowsRemoved++;
      continue;
    }

    // Check duplicate
    const signature = JSON.stringify(rowObj);
    if (rowSignatures.has(signature)) {
      duplicateRows++;
    } else {
      rowSignatures.add(signature);
    }

    cleanRows.push(rowObj);
  }

  // Analyze columns
  const columns: ColumnMeta[] = headers.map(h => {
    const allVals = cleanRows.map(r => r[h]);
    const nonNullVals = allVals.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    const sample = nonNullVals.slice(0, 5);
    const type = inferColumnType(sample, h);

    // Count nulls and type inconsistencies
    let inconsistentCount = 0;
    const distinctSet = new Set();

    for (const v of allVals) {
      if (v === null || v === undefined || String(v).trim() === '') {
        continue;
      }
      distinctSet.add(v);

      if (type === 'numeric' || type === 'currency' || type === 'percentage') {
        if (parseNumberBR(v) === null) inconsistentCount++;
      } else if (type === 'date') {
        if (parseDateBR(v) === null) inconsistentCount++;
      }
    }

    return {
      key: h,
      name: h,
      type,
      sampleValues: sample,
      nullCount: allVals.length - nonNullVals.length,
      distinctCount: distinctSet.size,
      inconsistentCount,
    };
  });

  // Convert values in cleanRows to normalized types
  cleanRows.forEach(row => {
    columns.forEach(col => {
      const raw = row[col.key];
      if (raw === null || raw === undefined || String(raw).trim() === '') {
        row[col.key] = null;
        return;
      }

      if (col.type === 'currency' || col.type === 'numeric' || col.type === 'percentage') {
        row[col.key] = parseNumberBR(raw);
      } else if (col.type === 'date') {
        const d = parseDateBR(raw);
        row[col.key] = d ? d.toISOString() : null;
      } else if (col.type === 'boolean') {
        const s = String(raw).toLowerCase().trim();
        row[col.key] = s === 'true' || s === 'sim' || s === '1' || s === 'v';
      } else {
        row[col.key] = String(raw).trim();
      }
    });
  });

  // Data Quality Warnings
  const warnings: string[] = [];
  const columnsWithIssues: string[] = [];

  if (emptyRowsRemoved > 0) {
    warnings.push(`${emptyRowsRemoved} linha(s) completamente vazia(s) foram desconsideradas.`);
  }
  if (duplicateRows > 0) {
    warnings.push(`${duplicateRows} linha(s) duplicada(s) detectadas no conjunto de dados.`);
  }

  columns.forEach(col => {
    if (col.nullCount > 0) {
      const pct = Math.round((col.nullCount / (cleanRows.length || 1)) * 100);
      if (pct > 20) {
        warnings.push(`Coluna "${col.name}" possui ${pct}% de valores ausentes (${col.nullCount} linhas).`);
        columnsWithIssues.push(col.key);
      }
    }
    if (col.inconsistentCount > 0) {
      warnings.push(`Coluna "${col.name}" possui ${col.inconsistentCount} valores com formato inconsistente.`);
      if (!columnsWithIssues.includes(col.key)) columnsWithIssues.push(col.key);
    }
  });

  return {
    columns,
    rows: cleanRows,
    quality: {
      totalRows: cleanRows.length,
      totalColumns: columns.length,
      emptyRowsRemoved,
      duplicateRows,
      warnings,
      columnsWithIssues,
    },
  };
}

/**
 * Calculate Business KPIs & Metrics deterministically
 */
export function calculateBusinessMetrics(columns: ColumnMeta[], rows: Record<string, any>[]): MetricCardValue[] {
  if (rows.length === 0) {
    return [];
  }

  // Find candidate columns
  const revenueCol = columns.find(c => {
    const l = c.name.toLowerCase();
    return (
      (c.type === 'currency' || c.type === 'numeric') &&
      (l.includes('faturamento') ||
        l.includes('receita') ||
        l.includes('total') ||
        l.includes('valor_total') ||
        l.includes('venda') ||
        l.includes('preco_total'))
    );
  }) || columns.find(c => c.type === 'currency');

  const expenseCol = columns.find(c => {
    const l = c.name.toLowerCase();
    return (
      (c.type === 'currency' || c.type === 'numeric') &&
      (l.includes('despesa') || l.includes('custo') || l.includes('gasto') || l.includes('saida'))
    );
  });

  const profitCol = columns.find(c => {
    const l = c.name.toLowerCase();
    return (c.type === 'currency' || c.type === 'numeric') && (l.includes('lucro') || l.includes('resultado'));
  });

  const quantityCol = columns.find(c => {
    const l = c.name.toLowerCase();
    return (
      c.type === 'numeric' &&
      (l.includes('qtd') || l.includes('quantidade') || l.includes('volume') || l.includes('itens'))
    );
  });

  const dateCol = columns.find(c => c.type === 'date');

  const metrics: MetricCardValue[] = [];

  // 1. Faturamento Total
  if (revenueCol) {
    let totalRevenue = 0;
    let countRevenue = 0;
    for (const r of rows) {
      const v = r[revenueCol.key];
      if (typeof v === 'number' && !isNaN(v)) {
        totalRevenue += v;
        countRevenue++;
      }
    }

    // Period over period if date column is present
    let momChange: number | undefined;
    if (dateCol && rows.length >= 2) {
      momChange = calculateMoMVariation(rows, dateCol.key, revenueCol.key);
    }

    metrics.push({
      id: 'metric_revenue',
      label: 'Faturamento Total',
      value: totalRevenue,
      formattedValue: formatCurrencyBRL(totalRevenue),
      changePercent: momChange,
      changeType: momChange !== undefined ? (momChange >= 0 ? 'positive' : 'negative') : undefined,
      tooltip: `Baseado na coluna "${revenueCol.name}" somando ${countRevenue} registros válidos.`,
      available: true,
    });
  } else {
    metrics.push({
      id: 'metric_revenue',
      label: 'Faturamento Total',
      value: 0,
      formattedValue: 'Não identificado',
      available: false,
      missingExplanation: 'Nenhuma coluna de receita/valor foi detectada. Mapeie uma coluna no seletor.',
    });
  }

  // 2. Despesas / Custos
  if (expenseCol) {
    let totalExpense = 0;
    for (const r of rows) {
      const v = r[expenseCol.key];
      if (typeof v === 'number' && !isNaN(v)) totalExpense += v;
    }
    metrics.push({
      id: 'metric_expense',
      label: 'Total de Despesas',
      value: totalExpense,
      formattedValue: formatCurrencyBRL(totalExpense),
      tooltip: `Baseado na coluna "${expenseCol.name}".`,
      available: true,
    });
  }

  // 3. Lucro Líquido
  if (profitCol) {
    let totalProfit = 0;
    for (const r of rows) {
      const v = r[profitCol.key];
      if (typeof v === 'number' && !isNaN(v)) totalProfit += v;
    }
    metrics.push({
      id: 'metric_profit',
      label: 'Lucro Líquido',
      value: totalProfit,
      formattedValue: formatCurrencyBRL(totalProfit),
      changeType: totalProfit >= 0 ? 'positive' : 'negative',
      tooltip: `Baseado na coluna explícita de lucro "${profitCol.name}".`,
      available: true,
    });
  } else if (revenueCol && expenseCol) {
    const rev = metrics.find(m => m.id === 'metric_revenue')?.value as number || 0;
    const exp = metrics.find(m => m.id === 'metric_expense')?.value as number || 0;
    const profit = rev - exp;
    metrics.push({
      id: 'metric_profit',
      label: 'Lucro Líquido (Estimado)',
      value: profit,
      formattedValue: formatCurrencyBRL(profit),
      changeType: profit >= 0 ? 'positive' : 'negative',
      tooltip: `Calculado subtraindo Despesas (${expenseCol.name}) do Faturamento (${revenueCol.name}).`,
      available: true,
    });
  }

  // 4. Margem de Lucro (%)
  const revMetric = metrics.find(m => m.id === 'metric_revenue');
  const profMetric = metrics.find(m => m.id === 'metric_profit');
  if (revMetric && profMetric && revMetric.available && profMetric.available && (revMetric.value as number) > 0) {
    const margin = ((profMetric.value as number) / (revMetric.value as number)) * 100;
    metrics.push({
      id: 'metric_margin',
      label: 'Margem de Lucro',
      value: margin,
      formattedValue: `${formatNumberBR(margin, 1)}%`,
      changeType: margin >= 15 ? 'positive' : margin > 0 ? 'neutral' : 'negative',
      tooltip: `Calculado: (Lucro / Faturamento) * 100.`,
      available: true,
    });
  }

  // 5. Volume / Quantidade de Vendas
  let totalVolume = rows.length;
  if (quantityCol) {
    let sumQty = 0;
    for (const r of rows) {
      const v = r[quantityCol.key];
      if (typeof v === 'number' && !isNaN(v)) sumQty += v;
    }
    totalVolume = sumQty;
    metrics.push({
      id: 'metric_volume',
      label: 'Volume de Itens',
      value: totalVolume,
      formattedValue: formatNumberBR(totalVolume, 0),
      tooltip: `Soma da coluna de quantidade "${quantityCol.name}".`,
      available: true,
    });
  } else {
    metrics.push({
      id: 'metric_volume',
      label: 'Total de Registros',
      value: totalVolume,
      formattedValue: formatNumberBR(totalVolume, 0),
      tooltip: 'Contagem total de registros / transações na planilha.',
      available: true,
    });
  }

  // 6. Ticket Médio
  if (revenueCol && revMetric && revMetric.available && totalVolume > 0) {
    const rev = revMetric.value as number;
    const avgTicket = rev / (quantityCol ? rows.length : totalVolume);
    metrics.push({
      id: 'metric_avg_ticket',
      label: 'Ticket Médio',
      value: avgTicket,
      formattedValue: formatCurrencyBRL(avgTicket),
      tooltip: 'Faturamento dividido pelo total de pedidos/transações.',
      available: true,
    });
  }

  return metrics;
}

/**
 * Calculate Month-over-Month variation
 */
function calculateMoMVariation(rows: Record<string, any>[], dateKey: string, valKey: string): number | undefined {
  try {
    const monthlySum: Record<string, number> = {};

    for (const r of rows) {
      const rawDate = r[dateKey];
      const val = r[valKey];
      if (!rawDate || typeof val !== 'number' || isNaN(val)) continue;
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) continue;

      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlySum[ym] = (monthlySum[ym] || 0) + val;
    }

    const months = Object.keys(monthlySum).sort();
    if (months.length < 2) return undefined;

    const currentMonthVal = monthlySum[months[months.length - 1]];
    const prevMonthVal = monthlySum[months[months.length - 2]];

    if (prevMonthVal === 0) return undefined;
    const variation = ((currentMonthVal - prevMonthVal) / prevMonthVal) * 100;
    return parseFloat(variation.toFixed(1));
  } catch (e) {
    return undefined;
  }
}

/**
 * Group and Aggregate data for charts
 */
export function aggregateData(
  rows: Record<string, any>[],
  dimensionKey: string,
  metricKey: string,
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' = 'sum',
  sortBy: 'metric_desc' | 'metric_asc' | 'dimension' = 'metric_desc',
  limit = 12
): { dimension: string; metric: number; formattedMetric: string }[] {
  const groups: Record<string, { sum: number; count: number; min: number; max: number }> = {};

  for (const r of rows) {
    let dimVal = r[dimensionKey];
    if (dimVal === null || dimVal === undefined || dimVal === '') {
      dimVal = '(Vazio)';
    } else if (typeof dimVal === 'string' && dimVal.length > 25) {
      dimVal = dimVal.slice(0, 22) + '...';
    }

    const numVal = typeof r[metricKey] === 'number' && !isNaN(r[metricKey]) ? r[metricKey] : null;

    if (!groups[dimVal]) {
      groups[dimVal] = { sum: 0, count: 0, min: Infinity, max: -Infinity };
    }

    groups[dimVal].count++;
    if (numVal !== null) {
      groups[dimVal].sum += numVal;
      if (numVal < groups[dimVal].min) groups[dimVal].min = numVal;
      if (numVal > groups[dimVal].max) groups[dimVal].max = numVal;
    }
  }

  const results = Object.entries(groups).map(([dimension, stats]) => {
    let metric = 0;
    switch (aggregation) {
      case 'count':
        metric = stats.count;
        break;
      case 'avg':
        metric = stats.count > 0 ? stats.sum / stats.count : 0;
        break;
      case 'min':
        metric = stats.min === Infinity ? 0 : stats.min;
        break;
      case 'max':
        metric = stats.max === -Infinity ? 0 : stats.max;
        break;
      case 'sum':
      default:
        metric = stats.sum;
        break;
    }

    return {
      dimension,
      metric: parseFloat(metric.toFixed(2)),
      formattedMetric: formatNumberBR(metric, 2),
    };
  });

  // Sort
  if (sortBy === 'metric_desc') {
    results.sort((a, b) => b.metric - a.metric);
  } else if (sortBy === 'metric_asc') {
    results.sort((a, b) => a.metric - b.metric);
  } else {
    results.sort((a, b) => a.dimension.localeCompare(b.dimension));
  }

  return results.slice(0, limit);
}

/**
 * Compare two datasets for the "Atualizar dados" flow
 */
export interface DatasetDiffReport {
  previousRowCount: number;
  newRowCount: number;
  rowCountDifference: number;
  identicalColumns: string[];
  addedColumns: string[];
  missingColumns: string[];
  typeMismatches: { column: string; prevType: ColumnType; newType: ColumnType }[];
  isCompatible: boolean;
}

export function compareDatasets(
  prevColumns: ColumnMeta[],
  prevRows: Record<string, any>[],
  newColumns: ColumnMeta[],
  newRows: Record<string, any>[]
): DatasetDiffReport {
  const prevKeys = new Set(prevColumns.map(c => c.name.toLowerCase()));
  const newKeys = new Set(newColumns.map(c => c.name.toLowerCase()));

  const identicalColumns: string[] = [];
  const addedColumns: string[] = [];
  const missingColumns: string[] = [];
  const typeMismatches: { column: string; prevType: ColumnType; newType: ColumnType }[] = [];

  for (const prevCol of prevColumns) {
    const l = prevCol.name.toLowerCase();
    const matchedNew = newColumns.find(nc => nc.name.toLowerCase() === l);
    if (matchedNew) {
      identicalColumns.push(prevCol.name);
      if (prevCol.type !== matchedNew.type) {
        typeMismatches.push({
          column: prevCol.name,
          prevType: prevCol.type,
          newType: matchedNew.type,
        });
      }
    } else {
      missingColumns.push(prevCol.name);
    }
  }

  for (const newCol of newColumns) {
    if (!prevKeys.has(newCol.name.toLowerCase())) {
      addedColumns.push(newCol.name);
    }
  }

  const isCompatible = missingColumns.length === 0 && typeMismatches.length === 0;

  return {
    previousRowCount: prevRows.length,
    newRowCount: newRows.length,
    rowCountDifference: newRows.length - prevRows.length,
    identicalColumns,
    addedColumns,
    missingColumns,
    typeMismatches,
    isCompatible,
  };
}

/**
 * Append new rows with deduplication based on key columns
 */
export function appendWithDeduplication(
  existingRows: Record<string, any>[],
  newRows: Record<string, any>[],
  dedupKeys: string[]
): { combinedRows: Record<string, any>[]; addedCount: number; duplicatesSkipped: number } {
  const seenSignatures = new Set<string>();

  existingRows.forEach(r => {
    const sig = dedupKeys.length > 0 ? dedupKeys.map(k => String(r[k])).join('||') : JSON.stringify(r);
    seenSignatures.add(sig);
  });

  const combined = [...existingRows];
  let addedCount = 0;
  let duplicatesSkipped = 0;

  newRows.forEach(r => {
    const sig = dedupKeys.length > 0 ? dedupKeys.map(k => String(r[k])).join('||') : JSON.stringify(r);
    if (seenSignatures.has(sig)) {
      duplicatesSkipped++;
    } else {
      seenSignatures.add(sig);
      combined.push(r);
      addedCount++;
    }
  });

  return { combinedRows: combined, addedCount, duplicatesSkipped };
}
