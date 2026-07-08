import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export function exportToPDF(title: string, columns: string[], rows: string[][], filename: string, chartImages: string[] = []) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  // Margens ABNT (esq 3cm, dir 2cm, sup 3cm, inf 2cm)
  const MARGIN_L = 30, MARGIN_R = 20, MARGIN_T = 30, MARGIN_B = 20;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN_L - MARGIN_R;
  const maxH = pageH - MARGIN_T - MARGIN_B;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, MARGIN_L, MARGIN_T);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, MARGIN_L, MARGIN_T + 6);

  let startY = MARGIN_T + 12;

  chartImages.forEach((img) => {
    try {
      const props = (doc as any).getImageProperties ? (doc as any).getImageProperties(img) : null;
      let w = contentW;
      let h = props ? (props.height * w) / props.width : 90;
      // Se altura maior que a página inteira, reduz proporcional
      if (h > maxH) {
        h = maxH;
        w = props ? (props.width * h) / props.height : contentW;
      }
      if (startY + h > pageH - MARGIN_B) {
        doc.addPage();
        startY = MARGIN_T;
      }
      const x = MARGIN_L + (contentW - w) / 2;
      doc.addImage(img, 'PNG', x, startY, w, h);
      startY += h + 6;
    } catch { /* ignore */ }
  });

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY,
    margin: { left: MARGIN_L, right: MARGIN_R, top: MARGIN_T, bottom: MARGIN_B },
    styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [14, 116, 144], halign: 'left' },
    showHead: 'everyPage',
    tableWidth: contentW,
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
