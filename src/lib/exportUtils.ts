import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const isWideReport = (columns: string[]) => columns.length > 8 || columns.some(c => /^\d{1,2}$/.test(c));

const normalizeColumn = (column: string) => column
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const getColumnStyles = (columns: string[], contentW: number, wide: boolean) => {
  const styles: Record<number, any> = {};
  const normalized = columns.map(normalizeColumn);

  const applyFractions = (fractions: number[]) => {
    const total = fractions.reduce((sum, value) => sum + value, 0) || 1;
    fractions.forEach((fraction, index) => {
      styles[index] = { cellWidth: contentW * (fraction / total) };
    });
  };

  if (normalized.join('|') === 'protocolo|tipo|solicitante / destinatario|unidade / setor|plantao|motivo|status|criacao / resolucao|tempo|observacao') {
    applyFractions([7, 5, 17, 13, 13, 15, 7, 13, 5, 15]);
    return styles;
  }

  if (columns.some(c => /^\d{1,2}$/.test(c))) {
    const dayIndexes = columns.map((c, i) => (/^\d{1,2}$/.test(c) ? i : -1)).filter(i => i >= 0);
    const fixed = new Set<number>();
    columns.forEach((column, index) => {
      const n = normalizeColumn(column);
      if (n === 'profissional') { styles[index] = { cellWidth: contentW * 0.16 }; fixed.add(index); }
      if (n === 'setor') { styles[index] = { cellWidth: contentW * 0.14 }; fixed.add(index); }
      if (n === 'total') { styles[index] = { cellWidth: contentW * 0.07 }; fixed.add(index); }
    });
    const used = Object.values(styles).reduce((sum: number, style: any) => sum + Number(style.cellWidth || 0), 0);
    const dayWidth = Math.max(3.6, (contentW - used) / Math.max(dayIndexes.length, 1));
    dayIndexes.forEach(index => { styles[index] = { cellWidth: dayWidth, halign: 'center' }; });
    return styles;
  }

  if (wide) {
    const equal = contentW / columns.length;
    columns.forEach((column, index) => {
      const n = normalizeColumn(column);
      const isNameLike = /profissional|solicitante|destinatario|unidade|setor|motivo|observacao|email/.test(n);
      styles[index] = { cellWidth: isNameLike ? Math.min(equal * 1.4, contentW * 0.18) : equal };
    });
  }

  return styles;
};

export function exportToPDF(title: string, columns: string[], rows: string[][], filename: string, chartImages: string[] = []) {
  const wide = isWideReport(columns);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: wide ? 'landscape' : 'portrait' });
  // Margens institucionais: preserva ABNT nos relatórios simples e amplia área útil nos relatórios tabulares largos.
  const MARGIN_L = wide ? 18 : 30;
  const MARGIN_R = wide ? 15 : 20;
  const MARGIN_T = wide ? 16 : 30;
  const MARGIN_B = wide ? 14 : 20;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN_L - MARGIN_R;
  const maxH = pageH - MARGIN_T - MARGIN_B;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(title, contentW);
  doc.text(titleLines, MARGIN_L, MARGIN_T);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const titleH = titleLines.length * 6;
  doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, MARGIN_L, MARGIN_T + titleH);

  let startY = MARGIN_T + titleH + 6;

  chartImages.forEach((img) => {
    try {
      const props = (doc as any).getImageProperties ? (doc as any).getImageProperties(img) : null;
      let w = contentW;
      let h = props ? (props.height * w) / props.width : 90;
      const remaining = pageH - MARGIN_B - startY;
      const allowedH = Math.min(maxH, Math.max(remaining, maxH * 0.72));
      if (h > allowedH) {
        h = allowedH;
        w = props ? (props.width * h) / props.height : contentW;
      }
      if (startY + h > pageH - MARGIN_B) {
        doc.addPage();
        startY = MARGIN_T;
      }
      const x = MARGIN_L + (contentW - w) / 2;
      doc.addImage(img, 'PNG', x, startY, w, h);
      startY += h + 5;
    } catch { /* ignore */ }
  });

  const columnStyles = getColumnStyles(columns, contentW, wide);
  const tableFontSize = wide ? (columns.length > 14 ? 5.2 : 6.2) : 8;

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY,
    margin: { left: MARGIN_L, right: MARGIN_R, top: MARGIN_T, bottom: MARGIN_B },
    styles: {
      fontSize: tableFontSize,
      cellPadding: wide ? 1.15 : 2,
      overflow: 'linebreak',
      valign: 'top',
      cellWidth: wide ? 'auto' : 'wrap',
      minCellHeight: 6,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [14, 116, 144],
      halign: 'left',
      overflow: 'linebreak',
      fontStyle: 'bold',
      fontSize: wide ? tableFontSize : 8,
    },
    bodyStyles: { overflow: 'linebreak' },
    columnStyles,
    showHead: 'everyPage',
    tableWidth: contentW,
    horizontalPageBreak: false,
    rowPageBreak: 'auto',
  });

  doc.save(`${filename}.pdf`);
}

export function exportToExcel(title: string, columns: string[], rows: string[][], filename: string) {
  const data = rows.map(row => {
    const obj: Record<string, string> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToCSV(columns: string[], rows: string[][], filename: string) {
  const header = columns.join(',');
  const body = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const csv = header + '\n' + body;
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}
