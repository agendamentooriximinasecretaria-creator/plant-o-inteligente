/* 
 * ESTILO PADRÃO INSTITUCIONAL PARA DOCUMENTOS (ABNT-LIKE)
 * Compatível com o sistema Oriximiná.
 */
export const DOCUMENT_CSS_BASE = `
  * { box-sizing: border-box; }
  /* Margens ABNT: superior 3cm, esquerda 3cm, inferior 2cm, direita 2cm */
  @page { size: A4; margin: 30mm 20mm 20mm 30mm; }
  body { font-family: 'Arial', sans-serif; color: #1a1a1a; margin: 0; padding: 0; font-size: 12pt; line-height: 1.5; text-align: justify; }
  p { text-align: justify; margin: 0 0 8px; }

  /* Evita cortes entre páginas */
  h1, h2, h3, h4 { page-break-after: avoid; break-after: avoid; }
  tr, img, .assinatura-block, .assinatura-item, .charts-area > *, .totais-resumo, .filtros-area {
    page-break-inside: avoid; break-inside: avoid;
  }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  
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

  
  table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 10pt; }
  th { background: #f8fafc; color: #333; font-weight: 700; text-align: left; padding: 10px; border: 1px solid #ccc; }
  td { padding: 8px; border: 1px solid #ddd; vertical-align: top; }
  
  .assinatura-block { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 60px; }
  .assinatura-item { text-align: center; }
  .assinatura-line { border-top: 1.5px solid #333; margin-top: 40px; padding-top: 5px; font-size: 10pt; font-weight: 700; }
  .assinatura-info { font-size: 9pt; color: #555; margin-top: 3px; }

  .footer-institucional { margin-top: 60px; font-size: 8pt; color: #777; text-align: center; border-top: 1px dashed #ccc; padding-top: 15px; }
  
  @media print {
    .no-print { display: none !important; }
  }
`;
