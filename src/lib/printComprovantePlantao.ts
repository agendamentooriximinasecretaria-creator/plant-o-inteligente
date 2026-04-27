// Comprovante individual de plantão - impressão limpa e profissional.
// Não expõe CPF, dados bancários ou endereço residencial.
import { LOGO_SMS_PATH } from "./logoSMS";

const DIAS_PT = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export interface ComprovantePlantaoData {
  // Identificação do plantão
  shiftId: string;
  data: string;        // ISO yyyy-mm-dd
  horaInicio: string;  // HH:mm
  horaFim: string;     // HH:mm
  cargaHoraria: number | string;
  tipoPlantao: string;
  status: string;
  observacoes?: string | null;
  // Profissional
  profissionalNome: string;
  profissaoLabel: string;
  conselho?: string | null;   // ex: "CRM 12345/PA" — só se autorizado
  registro?: string | null;   // alternativo ao conselho
  // Local
  unidadeNome: string;
  setorNome: string;
  // Instituição
  instituicaoNome?: string;
  cnpj?: string;
  sistema?: string;
  // Auditoria
  emitidoPor?: string;
}

function esc(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function diaSemanaPt(dataIso: string): string {
  try { return DIAS_PT[new Date(dataIso + "T12:00:00").getDay()]; } catch { return ""; }
}

export function buildComprovantePlantaoHtml(d: ComprovantePlantaoData): string {
  const instituicao = d.instituicaoNome || "Hospital Municipal de Oriximiná";
  const sistema = d.sistema || "GestorPlantão SMS Oriximiná";
  const cnpj = d.cnpj || "05.131.081/0001-82";
  const dataBR = (() => { try { return new Date(d.data + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return d.data; } })();
  const dia = diaSemanaPt(d.data);
  const conselhoTexto = d.conselho || d.registro || "";
  const emissao = new Date().toLocaleString("pt-BR");
  const numero = `CP-${new Date().getFullYear()}-${d.shiftId.slice(0, 8).toUpperCase()}`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Comprovante de Plantão — ${esc(numero)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Inter', Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 28px 36px; background: #fff; }
  .toolbar { position: sticky; top: 0; background: #fff; padding: 8px 0 12px; margin-bottom: 12px; display:flex; gap:8px; border-bottom: 1px solid #e5e7eb; }
  .toolbar button { background:#0e7490; color:#fff; border:none; padding: 7px 14px; border-radius: 6px; cursor:pointer; font-size: 12px; font-weight: 600; }
  .toolbar button.secondary { background:#fff; color:#111; border:1px solid #cbd5e1; font-weight: 500; }

  .header { display:flex; align-items:center; gap:16px; border-bottom: 2px solid #0e7490; padding-bottom: 14px; margin-bottom: 18px; }
  .header img { width:72px; height:72px; border-radius:50%; object-fit:cover; border:1px solid #e5e7eb; background:#fff; }
  .header .titles h1 { font-size: 16px; margin: 0; color: #0e7490; letter-spacing: .2px; }
  .header .titles h2 { font-size: 13px; margin: 2px 0 0; color: #111; font-weight: 600; }
  .header .titles .meta { font-size: 11px; color: #555; margin-top: 4px; }

  .doc-title { text-align:center; font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: 1px; margin: 4px 0 18px; text-transform: uppercase; }
  .number { display:flex; justify-content:space-between; font-size: 11.5px; color:#444; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px; margin-bottom: 14px; }
  .number b { color:#0f172a; }

  .section-title { font-size: 11px; font-weight: 700; color: #0e7490; text-transform: uppercase; letter-spacing: .08em; margin: 18px 0 6px; }
  .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; font-size: 12.5px; }
  .grid .full { grid-column: 1 / -1; }
  .grid .item { padding: 4px 0; border-bottom: 1px solid #f1f5f9; }
  .grid .item .lbl { display:block; font-size: 10.5px; color:#64748b; text-transform: uppercase; letter-spacing: .04em; }
  .grid .item .val { display:block; font-size: 13px; color:#0f172a; font-weight: 600; }

  .obs { margin-top: 14px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; color:#334155; }

  .signatures { display:grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 70px; }
  .signatures .line { border-top: 1px solid #111; padding-top: 6px; text-align: center; font-size: 11.5px; color: #111; }
  .signatures .line small { display:block; color:#64748b; font-size: 10px; margin-top: 2px; }

  .footer { margin-top: 36px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #64748b; text-align: center; line-height: 1.5; }

  @page { size: A4 portrait; margin: 14mm; }
  @media print {
    body { padding: 0; margin: 0; }
    .no-print, .toolbar { display: none !important; }
    .header { page-break-after: avoid; }
    .signatures { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()">🖨️ Imprimir</button>
    <button class="secondary" onclick="window.close()">Fechar</button>
  </div>

  <div class="header">
    <img src="${LOGO_SMS_PATH}" alt="SMS Oriximiná" />
    <div class="titles">
      <h1>${esc(instituicao)}</h1>
      <h2>Secretaria Municipal de Saúde de Oriximiná</h2>
      <div class="meta">CNPJ ${esc(cnpj)} · Sistema ${esc(sistema)}</div>
    </div>
  </div>

  <div class="doc-title">Comprovante de Plantão</div>

  <div class="number">
    <span><b>Nº:</b> ${esc(numero)}</span>
    <span><b>Emissão:</b> ${esc(emissao)}</span>
  </div>

  <div class="section-title">Profissional</div>
  <div class="grid">
    <div class="item"><span class="lbl">Nome</span><span class="val">${esc(d.profissionalNome || "—")}</span></div>
    <div class="item"><span class="lbl">Profissão</span><span class="val">${esc(d.profissaoLabel || "—")}</span></div>
    ${conselhoTexto ? `<div class="item full"><span class="lbl">Registro / Conselho</span><span class="val">${esc(conselhoTexto)}</span></div>` : ""}
  </div>

  <div class="section-title">Dados do Plantão</div>
  <div class="grid">
    <div class="item"><span class="lbl">Unidade</span><span class="val">${esc(d.unidadeNome || "—")}</span></div>
    <div class="item"><span class="lbl">Setor</span><span class="val">${esc(d.setorNome || "—")}</span></div>
    <div class="item"><span class="lbl">Data</span><span class="val">${esc(dataBR)}</span></div>
    <div class="item"><span class="lbl">Dia da semana</span><span class="val">${esc(dia)}</span></div>
    <div class="item"><span class="lbl">Horário</span><span class="val">${esc(d.horaInicio)} às ${esc(d.horaFim)} (${esc(d.cargaHoraria)}h)</span></div>
    <div class="item"><span class="lbl">Tipo de plantão</span><span class="val">${esc(d.tipoPlantao || "—")}</span></div>
    <div class="item full"><span class="lbl">Status</span><span class="val">${esc(d.status || "—")}</span></div>
  </div>

  ${d.observacoes ? `<div class="obs"><b>Observações:</b> ${esc(d.observacoes)}</div>` : ""}

  <div class="signatures">
    <div class="line">${esc(d.profissionalNome || "Profissional")}<small>Assinatura do Profissional</small></div>
    <div class="line">_______________________________<small>Assinatura do Gestor</small></div>
  </div>

  <div class="footer">
    Documento emitido por ${esc(d.emitidoPor || "—")} em ${esc(emissao)}.<br/>
    ${esc(sistema)} · ID: ${esc(d.shiftId)}<br/>
    Este comprovante reflete o registro do plantão no sistema na data de emissão.
  </div>

  <script>window.onload = () => setTimeout(() => window.print(), 350)</script>
</body>
</html>`;
}

export function imprimirComprovantePlantao(d: ComprovantePlantaoData): boolean {
  const w = window.open("", "_blank", "width=900,height=780");
  if (!w) return false;
  w.document.write(buildComprovantePlantaoHtml(d));
  w.document.close();
  return true;
}
