/* 
 * ESTILO PADRÃO INSTITUCIONAL PARA DOCUMENTOS (ABNT-LIKE)
 * Compatível com o sistema Oriximiná.
 */
export const DOCUMENT_CSS_BASE = `
  * { box-sizing: border-box; }
  /* Margens ABNT: superior 3cm, esquerda 3cm, inferior 2cm, direita 2cm */
  @page { size: A4; margin: 30mm 20mm 20mm 30mm; }
  @page relatorio-wide { size: A4 landscape; margin: 16mm 14mm 14mm 16mm; }
  body { font-family: 'Arial', sans-serif; color: #1a1a1a; margin: 0; padding: 0; font-size: 12pt; line-height: 1.5; text-align: justify; }
  body.relatorio-wide { font-size: 10pt; }
  p { text-align: justify; margin: 0 0 8px; }

  /* Evita cortes entre páginas */
  h1, h2, h3, h4 { page-break-after: avoid; break-after: avoid; }
  img, .assinatura-block, .assinatura-item, .totais-resumo, .filtros-area {
    page-break-inside: avoid; break-inside: avoid;
  }
  tr { page-break-inside: auto; break-inside: auto; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  [data-pdf-section] { break-inside: auto; page-break-inside: auto; }
  
  .header-institucional { 
    display: flex; align-items: center; justify-content: space-between; gap: 10px; 
    border-bottom: 2px solid #0e7490; padding-bottom: 5px; margin-bottom: 8px; 
  }
  .header-institucional img { width: 45px; height: 45px; object-fit: contain; flex-shrink: 0; }
  .header-institucional img.logo-round { border-radius: 50%; object-fit: cover; }
  .header-institucional .titles { flex: 1; text-align: center; }
  .header-institucional .titles h1 { font-size: 10pt; margin: 0; text-transform: uppercase; color: #0e7490; font-weight: 800; line-height: 1.1; }
  .header-institucional .titles h2 { font-size: 7.5pt; margin: 0; color: #444; font-weight: 500; line-height: 1.1; }
  
  .doc-title { text-align: center; font-size: 11pt; font-weight: 800; text-transform: uppercase; margin: 8px 0 4px; }
  .doc-info { display: flex; justify-content: space-between; font-size: 8.5pt; color: #333; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }

  
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 9pt; table-layout: fixed; word-wrap: break-word; overflow-wrap: anywhere; }
  th { background: #f8fafc; color: #333; font-weight: 700; text-align: left; padding: 5px; border: 1px solid #ccc; word-wrap: break-word; overflow-wrap: anywhere; hyphens: none; }
  td { padding: 4px 5px; border: 1px solid #ddd; vertical-align: top; word-wrap: break-word; overflow-wrap: anywhere; white-space: normal; hyphens: none; }
  .relatorio-wide table { font-size: 6.8pt; margin-top: 10px; table-layout: fixed; }
  .relatorio-wide th { padding: 3px 2px; line-height: 1.15; }
  .relatorio-wide td { padding: 3px 2px; line-height: 1.18; }
  .col-compact { text-align: center; overflow-wrap: normal; word-break: normal; }
  .col-text { overflow-wrap: break-word; word-break: normal; }
  .col-long { overflow-wrap: anywhere; word-break: normal; }
  
  .assinatura-block { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 60px; }
  .assinatura-item { text-align: center; }
  .assinatura-line { border-top: 1.5px solid #333; margin-top: 40px; padding-top: 5px; font-size: 10pt; font-weight: 700; }
  .assinatura-info { font-size: 9pt; color: #555; margin-top: 3px; }

  .footer-institucional { margin-top: 60px; font-size: 8pt; color: #777; text-align: center; border-top: 1px dashed #ccc; padding-top: 15px; }
  
  @media print {
    .no-print { display: none !important; }
    body.relatorio-wide { page: relatorio-wide; }
    html, body { width: auto; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    img { max-width: 100% !important; height: auto !important; }
    table { font-size: 8.5pt; }
    .relatorio-wide table { font-size: 6.6pt; }
  }
`;
