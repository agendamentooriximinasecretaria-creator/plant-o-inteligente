/* 
 * ESTILO PADRÃO INSTITUCIONAL PARA DOCUMENTOS (ABNT-LIKE)
 * Compartilhado entre todas as impressões do sistema.
 */
export const DOCUMENT_CSS_BASE = `
  * { box-sizing: border-box; }
  @page { size: A4; margin: 20mm; }
  body { font-family: 'Arial', sans-serif; color: #1a1a1a; margin: 0; padding: 0; font-size: 12px; line-height: 1.5; }
  
  .header-institucional { 
    display: flex; align-items: center; gap: 20px; 
    border-bottom: 2px solid #0e7490; padding-bottom: 15px; margin-bottom: 20px; 
  }
  .header-institucional img { width: 70px; height: 70px; border-radius: 50%; object-fit: cover; }
  .header-institucional .titles h1 { font-size: 16px; margin: 0; text-transform: uppercase; color: #0e7490; }
  .header-institucional .titles h2 { font-size: 13px; margin: 4px 0; color: #444; }
  
  .doc-title { text-align: center; font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 20px 0; }
  .doc-info { display: flex; justify-content: space-between; font-size: 11px; color: #666; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
  
  table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 11px; }
  th { background: #f3f4f6; color: #333; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #ddd; }
  td { padding: 8px; border: 1px solid #eee; }
  
  .assinatura-block { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .assinatura-item { text-align: center; }
  .assinatura-line { border-top: 1px solid #333; margin-top: 40px; padding-top: 5px; font-size: 11px; }
  .assinatura-info { font-size: 10px; color: #666; margin-top: 2px; }

  .footer-institucional { margin-top: 40px; font-size: 9px; color: #888; text-align: center; border-top: 1px dashed #ccc; padding-top: 10px; }
  
  @media print {
    .no-print { display: none !important; }
  }
`;
