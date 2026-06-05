/* 
 * ESTILO PADRÃO INSTITUCIONAL PARA DOCUMENTOS (ABNT-LIKE)
 * Compatível com o sistema Oriximiná.
 */
export const DOCUMENT_CSS_BASE = `
  * { box-sizing: border-box; }
  @page { size: A4; margin: 20mm; }
  body { font-family: 'Arial', sans-serif; color: #1a1a1a; margin: 0; padding: 0; font-size: 11pt; line-height: 1.5; }
  
  .header-institucional { 
    display: flex; align-items: center; justify-content: space-between; gap: 15px; 
    border-bottom: 2px solid #0e7490; padding-bottom: 8px; margin-bottom: 12px; 
  }
  .header-institucional img { width: 55px; height: 55px; object-fit: contain; flex-shrink: 0; }
  .header-institucional img.logo-round { border-radius: 50%; object-fit: cover; }
  .header-institucional .titles { flex: 1; text-align: center; }
  .header-institucional .titles h1 { font-size: 11pt; margin: 0; text-transform: uppercase; color: #0e7490; font-weight: 800; line-height: 1.2; }
  .header-institucional .titles h2 { font-size: 8pt; margin: 1px 0; color: #444; font-weight: 500; line-height: 1.2; }
  
  .doc-title { text-align: center; font-size: 12pt; font-weight: 800; text-transform: uppercase; margin: 12px 0 8px; }
  .doc-info { display: flex; justify-content: space-between; font-size: 9pt; color: #333; margin-bottom: 12px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
  
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
