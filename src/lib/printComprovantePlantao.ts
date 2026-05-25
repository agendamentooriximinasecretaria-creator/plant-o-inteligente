import { LOGO_SMS_PATH } from "./logoSMS";
import { DOCUMENT_CSS_BASE } from "./documentStyle";
import { buildHeaderHtml, buildSignatureHtml, buildFooterHtml } from "./documentTemplates";

export interface ComprovantePlantaoData {
  shiftId: string;
  data: string;        // ISO yyyy-mm-dd
  horaInicio: string;  // HH:mm
  horaFim: string;     // HH:mm
  cargaHoraria: number | string;
  tipoPlantao: string;
  status: string;
  observacoes?: string | null;
  profissionalNome: string;
  profissaoLabel: string;
  conselho?: string | null;
  registro?: string | null;
  unidadeNome: string;
  setorNome: string;
  instituicaoNome?: string;
  cnpj?: string;
  sistema?: string;
  emitidoPor?: string;
}

const DIAS_PT = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export function diaSemanaPt(dataIso: string): string {
  try { return DIAS_PT[new Date(dataIso + "T12:00:00").getDay()]; } catch { return ""; }
}

export function buildComprovantePlantaoHtml(d: ComprovantePlantaoData): string {
  const numero = `CP-${new Date().getFullYear()}-${d.shiftId.slice(0, 8).toUpperCase()}`;
  const dataBR = (() => { try { return new Date(d.data + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return d.data; } })();
  
  const headerHtml = buildHeaderHtml({
    title: "Comprovante de Realização de Plantão",
    docNumber: numero,
    unit: d.unidadeNome,
    sector: d.setorNome,
    period: `${dataBR} (${diaSemanaPt(d.data)})`,
    emission: new Date().toLocaleString("pt-BR"),
    issuer: d.emitidoPor
  });

  const footerHtml = buildFooterHtml(d.sistema);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Comprovante de Plantão — ${numero}</title>
<style>
  ${DOCUMENT_CSS_BASE}
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 30px; margin: 20px 0; }
  .field { border-bottom: 1px solid #f1f5f9; padding: 8px 0; }
  .field .l { font-size: 8pt; text-transform: uppercase; color: #64748b; font-weight: 700; }
  .field .v { font-size: 11pt; color: #0f172a; font-weight: 600; margin-top: 2px; }
  .section-title { font-size: 11pt; text-transform: uppercase; color: #0e7490; font-weight: 800; margin: 25px 0 10px; border-bottom: 2px solid #0e7490; padding-bottom: 5px; }
  
  .obs-box { margin-top: 20px; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 10pt; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 60px; }
  .sig { text-align: center; }
  .sig .line { border-top: 1.5px solid #333; padding-top: 5px; font-size: 10pt; font-weight: 700; }
  .sig small { display: block; color: #666; font-size: 9pt; margin-top: 3px; }
</style>
</head>
<body>
  ${headerHtml}

  <div class="section-title">Identificação do Profissional</div>
  <div class="grid">
    <div class="field"><div class="l">Nome</div><div class="v">${d.profissionalNome || "—"}</div></div>
    <div class="field"><div class="l">Profissão</div><div class="v">${d.profissaoLabel || "—"}</div></div>
    <div class="field" style="grid-column: 1/-1"><div class="l">Registro / Conselho</div><div class="v">${d.conselho || d.registro || "—"}</div></div>
  </div>

  <div class="section-title">Dados do Plantão Executado</div>
  <div class="grid">
    <div class="field"><div class="l">Data</div><div class="v">${dataBR}</div></div>
    <div class="field"><div class="l">Dia da Semana</div><div class="v">${diaSemanaPt(d.data)}</div></div>
    <div class="field"><div class="l">Horário</div><div class="v">${d.horaInicio} às ${d.horaFim}</div></div>
    <div class="field"><div class="l">Carga Horária</div><div class="v">${d.cargaHoraria}h</div></div>
    <div class="field"><div class="l">Tipo de Plantão</div><div class="v">${d.tipoPlantao || "—"}</div></div>
    <div class="field"><div class="l">Status</div><div class="v">${d.status.toUpperCase()}</div></div>
  </div>

  ${d.observacoes ? `<div class="obs-box"><strong>Observações:</strong> ${d.observacoes}</div>` : ""}

  <div class="signatures">
    <div class="sig"><div class="line">${d.profissionalNome || "PROFISSIONAL"}</div><small>Assinatura do Profissional</small></div>
    <div class="sig"><div class="line">_______________________</div><small>Assinatura do Responsável</small></div>
  </div>

  ${footerHtml}
  
  <script>window.onload=()=>{setTimeout(()=>window.print(),350);};</script>
</body></html>`;
}

export function imprimirComprovantePlantao(d: ComprovantePlantaoData): boolean {
  const html = buildComprovantePlantaoHtml(d);
  const w = window.open("", "_blank", "width=900,height=850");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
