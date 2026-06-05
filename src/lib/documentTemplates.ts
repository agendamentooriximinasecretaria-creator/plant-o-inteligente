import { LOGO_SMS_PATH, LOGO_ORIXIMINA_PATH } from "./logoSMS";
import { DOCUMENT_CSS_BASE } from "./documentStyle";

export function buildHeaderHtml(params: {
  title: string;
  unit?: string;
  sector?: string;
  period?: string;
  emission?: string;
  issuer?: string;
  docNumber?: string;
}) {
  const { title, unit, sector, period, emission, issuer, docNumber } = params;
  const emissionDate = emission || new Date().toLocaleString("pt-BR");
  
  return `
    <div class="header-institucional">
      <img src="${LOGO_SMS_PATH}" class="logo-round" alt="SMS" />
      <div class="titles">
        <h1>SECRETARIA MUNICIPAL DE SAÚDE — ORIXIMINÁ</h1>
        <h2>Hospital Municipal de Oriximiná · CNPJ 05.131.081/0001-82</h2>
        <h2>GestorPlantão · Sistema de Gestão de Escalas</h2>
      </div>
      <img src="${LOGO_ORIXIMINA_PATH}" alt="Prefeitura" />
    </div>

    
    <div class="doc-title">${title}</div>

    
    <div class="doc-info">
      <div>
        ${unit ? `<b>Unidade:</b> ${unit} <br/>` : ""}
        ${sector ? `<b>Setor:</b> ${sector} <br/>` : ""}
        ${period ? `<b>Período:</b> ${period}` : ""}
      </div>
      <div style="text-align: right">
        ${docNumber ? `<b>Documento Nº:</b> ${docNumber} <br/>` : ""}
        <b>Emissão:</b> ${emissionDate} <br/>
        ${issuer ? `<b>Emitido por:</b> ${issuer}` : ""}
      </div>
    </div>
  `;
}

export function buildSignatureHtml(params: {
  responsavel?: { 
    nome: string; 
    cargo: string; 
    conselho?: string; 
    unidade?: string; 
    assinaturaBase64?: string; 
    carimboBase64?: string; 
    tipo?: string;
    hasVisualSignature?: boolean;
    hasStamp?: boolean;
    hasDigitalSeal?: boolean;
  };
  responsavelTecnico?: { 
    nome: string; 
    cargo: string; 
    conselho?: string; 
    unidade?: string; 
    assinaturaBase64?: string; 
    carimboBase64?: string; 
    tipo?: string;
    hasVisualSignature?: boolean;
    hasStamp?: boolean;
    hasDigitalSeal?: boolean;
  };
}) {
  const { responsavel, responsavelTecnico } = params;
  
  const renderBox = (r: any) => {
    if (!r || (!r.nome && !r.cargo)) return `<div class="assinatura-item" style="flex: 1;"></div>`;
    
    // Prioridade de renderização:
    // 1. Assinatura Visual (Imagem real)
    // 2. Carimbo (Imagem do carimbo físico)
    // 3. Selo Digital (Se configurado ou se for assinatura interna)
    
    const showSignature = !!r.assinaturaBase64 && r.assinaturaBase64.length > 100;
    const showStamp = !!r.carimboBase64 && r.carimboBase64.length > 100;
    const showDigitalSeal = (r.hasDigitalSeal || r.tipo === 'eletronica_interna' || r.tipo === 'digital_gerado' || r.renderMode === 'digital') && !showSignature;
    
    return `
      <div class="assinatura-item" style="flex: 1; min-width: 250px; text-align: center; display: flex; flex-direction: column; align-items: center;">
        <div style="height: 110px; display: flex; align-items: center; justify-content: center; margin-bottom: 5px; position: relative; width: 100%;">
          
          ${showSignature ? `
            <img src="${r.assinaturaBase64}" style="max-height: 100px; max-width: 280px; object-fit: contain; z-index: 2;" alt="Assinatura Visual" />
          ` : ""}
          
          ${showStamp ? `
            <img src="${r.carimboBase64}" style="max-height: 100px; max-width: 180px; object-fit: contain; ${showSignature ? 'margin-left: -50px; opacity: 0.9;' : ''} z-index: 1;" alt="Carimbo" />
          ` : ""}
          
          ${showDigitalSeal ? `
            <div style="font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #1e3a8a; border: 2px solid #1e3a8a; padding: 6px 12px; border-radius: 4px; background: rgba(239, 246, 255, 0.7); text-transform: uppercase; font-weight: bold; transform: rotate(-3deg); box-shadow: 2px 2px 0px rgba(0,0,0,0.1); z-index: 0;">
              ASSINADO DIGITALMENTE<br/>
              <span style="font-size: 9px; font-weight: normal; opacity: 0.8;">Sistema GestorPlantão SMS</span>
            </div>
          ` : ""}
          
          ${(!showSignature && !showStamp && !showDigitalSeal) ? `
            <div style="width: 80%; border-bottom: 1px dashed #ccc; height: 60px;"></div>
          ` : ""}
        </div>
        
        <div class="assinatura-line" style="width: 85%; border-top: 1.5px solid #000; margin-bottom: 4px;"></div>
        
        <div style="line-height: 1.3;">
          <strong style="font-size: 11pt; color: #000; text-transform: uppercase;">${r.nome || ""}</strong><br/>
          <span style="font-size: 9pt; color: #333;">${r.cargo || ""}</span><br/>
          ${r.conselho && r.conselho !== "Não informado" ? `<span style="font-size: 8.5pt; color: #555;">${r.conselho}</span><br/>` : ""}
          ${r.unidade ? `<span style="font-size: 8pt; color: #666; font-style: italic;">${r.unidade}</span>` : ""}
        </div>
      </div>
    `;
  };

  return `
    <div class="assinatura-block" style="display: flex; justify-content: space-around; gap: 40px; margin-top: 40px; page-break-inside: avoid; width: 100%;">
      ${renderBox(responsavel)}
      ${responsavelTecnico ? renderBox(responsavelTecnico) : ""}
    </div>
  `;
}

export function buildFooterHtml(sistema = "GestorPlantão SMS Oriximiná") {
  const emissao = new Date().toLocaleString("pt-BR");
  return `
    <div class="footer-institucional">
      Documento oficial administrativo gerado pelo sistema ${sistema} em ${emissao}. <br/>
      Este documento reflete fielmente os registros oficiais da Secretaria Municipal de Saúde de Oriximiná.
    </div>
  `;
}
