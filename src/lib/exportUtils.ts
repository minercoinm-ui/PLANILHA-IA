import { MetricCardValue, formatNumberBR } from './dataProcessor';
import { ChartConfig } from '../types';

/**
 * Export data array to Brazilian CSV with semicolon (;) and UTF-8 BOM
 */
export function exportToCsvBR(rows: Record<string, any>[], filename: string) {
  if (!rows || rows.length === 0) {
    console.warn('Nenhum dado disponível para exportar.');
    return;
  }

  const headers = Object.keys(rows[0]);
  const csvRows: string[] = [];

  // Header line
  csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(';'));

  // Data lines
  for (const row of rows) {
    const values = headers.map(header => {
      const val = row[header];
      if (val === null || val === undefined) return '""';
      if (typeof val === 'number') {
        return `"${formatNumberBR(val, 2)}"`;
      }
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(';'));
  }

  // Prepend UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility
  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generate a printable executive PDF report in Brazilian business format
 */
export function printExecutiveReport(
  dashboardTitle: string,
  metrics: MetricCardValue[],
  charts: { config: ChartConfig; data: { dimension: string; metric: number }[] }[],
  filterSummary: string,
  watermark = false
) {

  const nowBR = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date());

  const metricsHtml = metrics
    .filter(m => m.available)
    .map(
      m => `
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; flex: 1; min-width: 140px;">
        <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">${m.label}</div>
        <div style="font-size: 20px; font-weight: bold; color: #0f172a; margin-top: 4px;">${m.formattedValue}</div>
        ${m.changePercent !== undefined ? `<div style="font-size: 11px; color: ${m.changePercent >= 0 ? '#16a34a' : '#dc2626'}; margin-top: 4px;">${m.changePercent >= 0 ? '▲ +' : '▼ '}${m.changePercent}% vs período anterior</div>` : ''}
      </div>`
    )
    .join('');

  const chartsHtml = charts
    .map(
      c => `
      <div style="margin-top: 24px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; page-break-inside: avoid;">
        <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #1e293b;">${c.config.title}</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left;">
              <th style="padding: 8px; border-bottom: 1px solid #cbd5e1;">${c.config.xAxis}</th>
              <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: right;">${c.config.yAxis} (${c.config.aggregation.toUpperCase()})</th>
            </tr>
          </thead>
          <tbody>
            ${c.data
              .map(
                d => `
              <tr>
                <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9;">${d.dimension}</td>
                <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 600;">${formatNumberBR(d.metric, 2)}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
    )
    .join('');

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Relatório Executivo — ${dashboardTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 40px; }
    h1 { margin: 0 0 4px 0; font-size: 24px; color: #0f172a; }
    .header { border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .subtitle { color: #64748b; font-size: 13px; }
    .metrics-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
    .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
    .watermark { position: fixed; bottom: 20px; right: 30px; font-size: 11px; color: #cbd5e1; }
    @media print {
      body { margin: 20mm; }
      @page { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${dashboardTitle}</h1>
      <div class="subtitle">Relatório Executivo Automatizado • Planilha Inteligente IA</div>
      ${filterSummary ? `<div style="font-size: 12px; color: #0284c7; margin-top: 4px;">Filtros Aplicados: ${filterSummary}</div>` : ''}
    </div>
    <div style="text-align: right; font-size: 12px; color: #64748b;">
      Emitido em:<br><strong>${nowBR}</strong>
    </div>
  </div>

  <h2 style="font-size: 16px; margin: 0 0 12px 0; color: #334155;">Indicadores Principais (KPIs)</h2>
  <div class="metrics-grid">
    ${metricsHtml}
  </div>

  <h2 style="font-size: 16px; margin: 24px 0 12px 0; color: #334155;">Detalhamento das Métricas</h2>
  ${chartsHtml}

  <div class="footer">
    <div>Planilha Inteligente IA — Relatório confidencial gerado a partir de dados auditados.</div>
    <div>Página 1 de 1</div>
  </div>

  ${watermark ? '<div class="watermark">Gerado no Plano Gratuito de Planilha Inteligente IA</div>' : ''}
</body>
</html>
`;

  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      }, 500);
    }
  } catch (e) {
    console.error('Falha ao acionar impressão do relatório:', e);
  }
}
