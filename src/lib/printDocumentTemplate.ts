import jsPDF from 'jspdf';
import type { ABNTConfig } from '@/components/document-templates/types';
import { resolveVariables, getSampleVariables, ResolveContext } from '@/lib/documentVariables';

/**
 * Render a document template (HTML + ABNT config) to a PDF using jsPDF.
 * Uses jsPDF's html() method for fidelity with TipTap output.
 *
 * Variables are resolved automatically:
 *  - Pass `context` para resolver variáveis com dados REAIS (Supabase).
 *  - Passe `useSamples=true` para usar amostras (preview sem contexto).
 *  - Use `variables` para sobrescrever pontualmente alguma chave.
 */
export async function gerarPdfDocumentTemplate(opts: {
  nome: string;
  conteudoHtml: string;
  abnt: ABNTConfig;
  variables?: Record<string, string>;
  context?: ResolveContext;
  useSamples?: boolean;
  acao?: 'open' | 'save' | 'print';
}) {
  const { nome, conteudoHtml, abnt, variables, context, useSamples, acao = 'open' } = opts;

  // 1. Build resolved variables map
  let resolved: Record<string, string> = {};
  if (context) resolved = await resolveVariables(context);
  else if (useSamples) resolved = getSampleVariables();
  if (variables) resolved = { ...resolved, ...variables };

  // 2. Substitui {{key}} -> valor (vazio quando não houver — regra do produto)
  const replaced = conteudoHtml.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_, k) => {
    return resolved[k] !== undefined ? String(resolved[k]) : '';
  });

  const orientation = abnt.orientation === 'landscape' ? 'landscape' : 'portrait';
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const fontMap: Record<string, string> = {
    Times: 'times', Arial: 'helvetica', Helvetica: 'helvetica', Courier: 'courier',
  };
  const jsFont = fontMap[abnt.font] || 'times';

  // Build wrapper HTML with proper styles
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-99999px';
  wrapper.style.top = '0';
  wrapper.style.width = `${pageW - abnt.margins.left - abnt.margins.right}mm`;
  wrapper.style.fontFamily = abnt.font === 'Times' ? 'Times New Roman, serif'
    : abnt.font === 'Courier' ? 'Courier New, monospace' : 'Arial, sans-serif';
  wrapper.style.fontSize = `${abnt.fontSize}pt`;
  wrapper.style.lineHeight = String(abnt.lineHeight);
  wrapper.style.textAlign = abnt.align;
  wrapper.style.color = '#000';
  wrapper.style.background = '#fff';
  wrapper.innerHTML = `
    <style>
      p { text-indent: ${abnt.indent}cm; margin: 0 0 6pt 0; }
      h1, h2, h3 { text-indent: 0; margin: 12pt 0 8pt 0; font-weight: bold; }
      h1 { font-size: ${abnt.fontSize + 4}pt; }
      h2 { font-size: ${abnt.fontSize + 2}pt; }
      h3 { font-size: ${abnt.fontSize + 1}pt; }
      table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
      th, td { border: 1px solid #444; padding: 4pt; font-size: ${abnt.fontSize - 1}pt; }
      th { background: #eee; }
      ul, ol { margin: 6pt 0 6pt 24pt; }
      img { max-width: 100%; }
    </style>
    ${replaced}
  `;
  document.body.appendChild(wrapper);

  try {
    await doc.html(wrapper, {
      x: abnt.margins.left,
      y: abnt.margins.top,
      width: pageW - abnt.margins.left - abnt.margins.right,
      windowWidth: (pageW - abnt.margins.left - abnt.margins.right) * 3.78, // mm -> px approx
      autoPaging: 'text',
      margin: [abnt.margins.top, abnt.margins.right, abnt.margins.bottom, abnt.margins.left],
    });
  } finally {
    document.body.removeChild(wrapper);
  }

  // Header / Footer / Page numbers on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont(jsFont, 'normal');

    if (abnt.header.enabled && abnt.header.text) {
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text(abnt.header.text, pageW / 2, abnt.margins.top / 2, { align: 'center' });
      doc.setDrawColor(180);
      doc.line(abnt.margins.left, abnt.margins.top - 2, pageW - abnt.margins.right, abnt.margins.top - 2);
    }
    if (abnt.footer.enabled) {
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.setDrawColor(180);
      doc.line(abnt.margins.left, pageH - abnt.margins.bottom + 2, pageW - abnt.margins.right, pageH - abnt.margins.bottom + 2);
      if (abnt.footer.text) {
        doc.text(abnt.footer.text, abnt.margins.left, pageH - abnt.margins.bottom / 2);
      }
      if (abnt.footer.showPageNumber) {
        doc.text(`Página ${i} de ${pageCount}`, pageW - abnt.margins.right, pageH - abnt.margins.bottom / 2, { align: 'right' });
      }
    }
  }

  const filename = `${nome.replace(/[^\w\-]+/g, '_')}.pdf`;
  if (acao === 'save') {
    doc.save(filename);
  } else if (acao === 'print') {
    doc.autoPrint();
    const blob = doc.output('bloburl');
    window.open(blob as any, '_blank');
  } else {
    const blob = doc.output('bloburl');
    window.open(blob as any, '_blank');
  }

  // Registra documento versionado (silencioso)
  try {
    const { registrarDocumentoGerado } = await import('./registrarDocumento');
    await registrarDocumentoGerado({
      tipo: 'documento_personalizado',
      titulo: nome,
      conteudoHtml: replaced,
      dadosGeracao: { abnt, contextoUsado: !!context, amostras: !!useSamples },
      modeloNome: nome,
    });
  } catch { /* silencioso */ }
}

