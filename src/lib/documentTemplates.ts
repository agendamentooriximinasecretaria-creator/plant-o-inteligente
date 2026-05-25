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
  responsavel?: { nome: string; cargo: string; conselho?: string; unidade?: string; assinaturaBase64?: string };
  responsavelTecnico?: { nome: string; cargo: string; conselho?: string; unidade?: string; assinaturaBase64?: string };
}) {
  const { responsavel, responsavelTecnico } = params;
  
  const renderBox = (r: any, defaultLabel: string) => `
    <div class="assinatura-item">
      <div style="height: 60px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: -5px;">
        ${r?.assinaturaBase64 ? `<img src="${r.assinaturaBase64}" style="max-height: 100%; max-width: 250px;" />` : ""}
      </div>
      <div class="assinatura-line">
        <strong>${r?.nome || defaultLabel}</strong>
      </div>
      <div class="assinatura-info">
        ${r?.cargo || ""} ${r?.conselho ? `· ${r.conselho}` : ""} <br/>
        ${r?.unidade || ""}
      </div>
    </div>
  `;

  return `
    <div class="assinatura-block">
      ${renderBox(responsavel, "Responsável pela Escala")}
      ${renderBox(responsavelTecnico, "Responsável Técnico")}
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
