import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 2000);
}

export interface PdfExportResult {
  success: boolean;
  filename: string;
  sizeBytes: number;
}

/**
 * Generates and directly downloads a genuine high-fidelity executive PDF report (.pdf)
 * Compatible with all desktop & mobile browsers, iframes, and local environments.
 */
export async function downloadExecutivePdfReport(
  dashboardTitle: string,
  metrics: MetricCardValue[],
  charts: { config: ChartConfig; data: { dimension: string; metric: number }[] }[],
  filterSummary?: string,
  watermark = false
): Promise<PdfExportResult> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const cleanTitle = (dashboardTitle || 'Planilha_Inteligente').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `Relatorio_Executivo_${cleanTitle}_${dateStr}.pdf`;

      doc.setProperties({
        title: `Relatório Executivo — ${dashboardTitle}`,
        subject: 'Relatório Executivo de Indicadores e Gráficos Gerenciais',
        author: 'Planilha Inteligente IA',
        creator: 'Planilha Inteligente IA — Relatórios Corporativos',
      });

      const nowBR = new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(new Date());

      const pageWidth = 210;
      const pageHeight = 297;
      const marginX = 14;
      const usableWidth = pageWidth - marginX * 2;

      // 1. Top Corporate Header Banner (Dark Navy)
      doc.setFillColor(15, 23, 42); // #0f172a
      doc.rect(0, 0, pageWidth, 22, 'F');

      // Accent color strip at bottom of header banner
      doc.setFillColor(2, 132, 199); // #0284c7 Sky Blue
      doc.rect(0, 22, pageWidth, 2, 'F');

      // Brand Title on Top Banner
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('PLANILHA INTELIGENTE IA', marginX, 10);

      // Subtitle on Top Banner
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(186, 230, 253); // #bae6fd
      doc.text('ANALYTICS & RELATÓRIOS EXECUTIVOS AUTOMATIZADOS', marginX, 16);

      // Timestamp on top right
      doc.setFontSize(8);
      doc.setTextColor(226, 232, 240);
      doc.text(nowBR, pageWidth - marginX, 14, { align: 'right' });

      // 2. Report Document Title & Scope
      let currentY = 32;
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text(dashboardTitle || 'Relatório Executivo Geral', marginX, currentY);

      currentY += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Consolidação analítica de indicadores-chave e métricas auditadas', marginX, currentY);

      // Filter notice if applied
      if (filterSummary && filterSummary !== 'Completo' && filterSummary !== 'all') {
        currentY += 6;
        doc.setFillColor(240, 249, 255);
        doc.setDrawColor(186, 230, 253);
        doc.roundedRect(marginX, currentY - 4, usableWidth, 7, 1.5, 1.5, 'FD');
        doc.setTextColor(2, 132, 199);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(`Filtros Ativos: ${filterSummary}`, marginX + 3, currentY + 0.8);
      }

      currentY += 10;

      // 3. Key Performance Indicators (KPIs) Cards Section
      const availableMetrics = metrics.filter(m => m.available).slice(0, 4);

      if (availableMetrics.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text('INDICADORES PRINCIPAIS (KPIs)', marginX, currentY);
        currentY += 4;

        const kpiCount = availableMetrics.length;
        const gap = 3;
        const cardWidth = (usableWidth - (kpiCount - 1) * gap) / kpiCount;
        const cardHeight = 22;

        availableMetrics.forEach((m, idx) => {
          const cardX = marginX + idx * (cardWidth + gap);

          // Card Background & Border
          doc.setFillColor(248, 250, 252); // slate-50
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, 'FD');

          // Left accent border line
          doc.setFillColor(2, 132, 199);
          doc.roundedRect(cardX, currentY, 1.5, cardHeight, 1, 1, 'F');

          // Metric Label
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          const cleanLabel = (m.label || 'INDICADOR').toUpperCase();
          doc.text(cleanLabel.length > 22 ? cleanLabel.slice(0, 20) + '...' : cleanLabel, cardX + 4, currentY + 5.5);

          // Metric Formatted Value
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(15, 23, 42);
          doc.text(String(m.formattedValue || '0'), cardX + 4, currentY + 12);

          // Percentage Variation (if present)
          if (m.changePercent !== undefined) {
            const isPos = m.changePercent >= 0;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            if (isPos) {
              doc.setTextColor(22, 163, 74); // green
              doc.text(`▲ +${m.changePercent}% vs período ant.`, cardX + 4, currentY + 18);
            } else {
              doc.setTextColor(220, 38, 38); // red
              doc.text(`▼ ${m.changePercent}% vs período ant.`, cardX + 4, currentY + 18);
            }
          }
        });

        currentY += cardHeight + 10;
      }

      // 4. Detailed Data & Analytical Tables Section
      if (charts.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text('DETALHAMENTO ANALÍTICO POR DIMENSÃO', marginX, currentY);
        currentY += 4;

        charts.forEach((c) => {
          // If Y position is too close to bottom margin, add new page
          if (currentY > pageHeight - 55) {
            doc.addPage();
            currentY = 26;
          }

          // Table Subtitle
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(15, 23, 42);
          doc.text(c.config.title || 'Detalhamento de Métricas', marginX, currentY);
          currentY += 2;

          const dimHeader = c.config.xAxis || 'Dimensão';
          const aggLabel = (c.config.aggregation || 'SOMA').toUpperCase();
          const metricHeader = `${c.config.yAxis || 'Métrica'} (${aggLabel})`;

          const tableRows = (c.data || []).map(row => [
            String(row.dimension ?? 'N/A'),
            typeof row.metric === 'number' ? formatNumberBR(row.metric, 2) : String(row.metric ?? '0'),
          ]);

          autoTable(doc, {
            startY: currentY,
            head: [[dimHeader, metricHeader]],
            body: tableRows.length > 0 ? tableRows : [['Nenhum dado agregado', '0,00']],
            theme: 'striped',
            headStyles: {
              fillColor: [2, 132, 199],
              textColor: [255, 255, 255],
              fontSize: 8.5,
              fontStyle: 'bold',
              cellPadding: 2.5,
            },
            alternateRowStyles: {
              fillColor: [248, 250, 252],
            },
            bodyStyles: {
              fontSize: 8,
              textColor: [30, 41, 59],
              cellPadding: 2,
            },
            columnStyles: {
              0: { cellWidth: usableWidth * 0.65 },
              1: { cellWidth: usableWidth * 0.35, halign: 'right', fontStyle: 'bold' },
            },
            margin: { left: marginX, right: marginX },
          });

          const lastTable = (doc as any).lastAutoTable;
          currentY = (lastTable ? lastTable.finalY : currentY + 30) + 8;
        });
      }

      // 5. Footers and Page Numbers across all generated pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // Thin separator rule
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(marginX, pageHeight - 16, pageWidth - marginX, pageHeight - 16);

        // Footer text
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(
          'Planilha Inteligente IA • Relatório executivo gerado a partir de dados auditados • Confidencial',
          marginX,
          pageHeight - 11
        );

        doc.text(
          `Página ${i} de ${totalPages}`,
          pageWidth - marginX,
          pageHeight - 11,
          { align: 'right' }
        );

        if (watermark) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7);
          doc.setTextColor(161, 161, 170);
          doc.text('Benefício 1º Download Gratuito Aplicado', marginX, pageHeight - 7);
        }
      }

      // 6. Generate Binary Blob and Trigger Real File Download
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);

      // Create native download anchor element
      const downloadAnchor = document.createElement('a');
      downloadAnchor.style.display = 'none';
      downloadAnchor.href = blobUrl;
      downloadAnchor.setAttribute('download', filename);
      document.body.appendChild(downloadAnchor);

      // Trigger download
      downloadAnchor.click();

      // Also call standard save as secondary safety
      try {
        doc.save(filename);
      } catch (_) {
        // Ignored if native click already handled
      }

      setTimeout(() => {
        if (document.body.contains(downloadAnchor)) {
          document.body.removeChild(downloadAnchor);
        }
        URL.revokeObjectURL(blobUrl);
      }, 3000);

      resolve({
        success: true,
        filename,
        sizeBytes: pdfBlob.size,
      });
    } catch (err: any) {
      console.error('[downloadExecutivePdfReport] Falha ao gerar PDF:', err);
      reject(err);
    }
  });
}

/**
 * Backward compatibility wrapper that generates and downloads the executive PDF report
 */
export function printExecutiveReport(
  dashboardTitle: string,
  metrics: MetricCardValue[],
  charts: { config: ChartConfig; data: { dimension: string; metric: number }[] }[],
  filterSummary: string,
  watermark = false
) {
  // Directly trigger real PDF file download
  downloadExecutivePdfReport(dashboardTitle, metrics, charts, filterSummary, watermark).catch((err) => {
    console.error('Falha ao exportar PDF executivo:', err);
  });
}
