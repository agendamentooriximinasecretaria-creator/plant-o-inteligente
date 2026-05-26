import { LOGO_SMS_PATH } from "./logoSMS";
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
      <img src="${LOGO_SMS_PATH}" alt="SMS Oriximiná" />
      <div class="titles">
        <h1>SECRETARIA MUNICIPAL DE SAÚDE — ORIXIMINÁ</h1>
        <h2>Hospital Municipal de Oriximiná · CNPJ 05.131.081/0001-82</h2>
        <h2>GestorPlantão · Sistema de Gestão de Escalas</h2>
      </div>
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
  responsavel?: { nome: string; cargo: string; conselho?: string; unidade?: string; assinaturaBase64?: string; carimboBase64?: string; tipo?: string };
  responsavelTecnico?: { nome: string; cargo: string; conselho?: string; unidade?: string; assinaturaBase64?: string; carimboBase64?: string; tipo?: string };
}) {
  const { responsavel, responsavelTecnico } = params;
  
  const renderBox = (r: any) => {
    if (!r || (!r.nome && !r.cargo)) return `<div class="assinatura-item"></div>`;
    
    // Se for eletrônica ou digital gerada sem imagem, podemos mostrar um selo de autenticidade
    const showDigitalSeal = (r.tipo === 'eletronica_interna' || r.tipo === 'digital_gerado') && !r.assinaturaBase64;
    
    return `
      <div class="assinatura-item">
        <div style="height: 100px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px; gap: 10px; position: relative;">
          ${r?.assinaturaBase64 ? `<img src="${r.assinaturaBase64}" style="max-height: 85px; max-width: 220px; object-fit: contain; z-index: 1;" alt="Assinatura" />` : ""}
          ${r?.carimboBase64 ? `<img src="${r.carimboBase64}" style="max-height: 95px; max-width: 160px; object-fit: contain; margin-left: -45px; z-index: 2;" alt="Carimbo" />` : ""}
          
          ${showDigitalSeal ? `
            <div style="position: absolute; bottom: 10px; font-family: 'Courier New', Courier, monospace; font-size: 10px; color: #1e3a8a; border: 1.5px solid #1e3a8a; padding: 4px 8px; border-radius: 4px; background: rgba(239, 246, 255, 0.5); text-transform: uppercase; font-weight: bold; transform: rotate(-5deg); z-index: 0;">
              Assinado Digitalmente<br/>
              <span style="font-size: 8px; font-weight: normal;">Sistema GestorPlantão</span>
            </div>
          ` : ""}
        </div>
        <div class="assinatura-line" style="border-top: 1px solid #000; padding-top: 5px;">
          <strong>${r?.nome || ""}</strong>
        </div>
        <div class="assinatura-info">
          ${r?.cargo || ""} ${r?.conselho && r.conselho !== "Não informado" ? `· ${r.conselho}` : ""} <br/>
          ${r?.unidade || ""}
        </div>
      </div>
    `;
  };

  return `
    <div class="assinatura-block" style="display: flex; justify-content: space-around; margin-top: 30px; page-break-inside: avoid;">
      ${renderBox(responsavel)}
      ${renderBox(responsavelTecnico)}
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
