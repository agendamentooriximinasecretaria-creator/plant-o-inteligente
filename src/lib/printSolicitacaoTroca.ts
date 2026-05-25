import { LOGO_SMS_PATH } from "./logoSMS";
import { DOCUMENT_CSS_BASE } from "./documentStyle";
import { buildHeaderHtml, buildFooterHtml } from "./documentTemplates";

export interface SolicitacaoTrocaData {
  swapId: string;
  solicitanteNome: string;
  substitutoNome: string;
  unidade: string;
  setor: string;
  data: string; // YYYY-MM-DD
  horaInicio: string;
  horaFim: string;
  motivo: string;
  status: string;
  criadoEm: string;
  responsavel?: string | null;
  historico: { acao: string; usuario: string; detalhes?: string | null; created_at: string }[];
  emitidoPor?: string;
}

const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  try {
    return new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR");
  } catch { return iso; }
};
const fmtDateTime = (iso?: string) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso; }
};

export function buildSolicitacaoTrocaHtml(d: SolicitacaoTrocaData): string {
  const numero = `ST-${new Date().getFullYear()}-${d.swapId.slice(0, 8).toUpperCase()}`;
  const historicoHtml = d.historico.length
    ? d.historico.map(h => `
        <tr>
          <td>${fmtDateTime(h.created_at)}</td>
          <td><strong>${h.acao}</strong></td>
          <td>${h.usuario || "—"}</td>
          <td>${h.detalhes || "—"}</td>
        </tr>`).join("")
    : `<tr><td colspan="4" style="text-align:center;color:#888">Sem registros</td></tr>`;

  const headerHtml = buildHeaderHtml({
    title: "Solicitação de Troca de Plantão",
    docNumber: numero,
    unit: d.unidade,
    sector: d.setor,
    period: fmtDate(d.data),
    emission: new Date().toLocaleString("pt-BR"),
    issuer: d.emitidoPor
  });

  const footerHtml = buildFooterHtml();

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Solicitação de Troca ${numero}</title>
<style>
  ${DOCUMENT_CSS_BASE}
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 30px; margin: 20px 0; }
  .field { border-bottom: 1px solid #f1f5f9; padding: 8px 0; }
  .field .l { font-size: 8pt; text-transform: uppercase; color: #64748b; font-weight: 700; }
  .field .v { font-size: 11pt; color: #0f172a; font-weight: 600; margin-top: 2px; }
  .section-title { font-size: 11pt; text-transform: uppercase; color: #0e7490; font-weight: 800; margin: 25px 0 10px; border-bottom: 2px solid #0e7490; padding-bottom: 5px; }
  
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 60px; }
  .sig { text-align: center; }
  .sig .line { border-top: 1.5px solid #333; padding-top: 5px; font-size: 10pt; font-weight: 700; }
  .sig small { display: block; color: #666; font-size: 9pt; margin-top: 3px; }
</style>
</head>
<body>
  ${headerHtml}

  <div class="grid">
    <div class="field"><div class="l">Solicitante</div><div class="v">${d.solicitanteNome || "—"}</div></div>
    <div class="field"><div class="l">Substituto</div><div class="v">${d.substitutoNome || "Cobertura aberta"}</div></div>
    <div class="field"><div class="l">Data do Plantão</div><div class="v">${fmtDate(d.data)}</div></div>
    <div class="field"><div class="l">Horário</div><div class="v">${(d.horaInicio || "").slice(0,5)} – ${(d.horaFim || "").slice(0,5)}</div></div>
    <div class="field"><div class="l">Status Atual</div><div class="v">${d.status.toUpperCase()}</div></div>
    <div class="field"><div class="l">Data da Solicitação</div><div class="v">${fmtDateTime(d.criadoEm)}</div></div>
    <div class="field" style="grid-column: 1/-1"><div class="l">Motivo Informado</div><div class="v">${d.motivo || "—"}</div></div>
  </div>

  <div class="section-title">Histórico de Ações</div>
  <table>
    <thead><tr><th>Data/Hora</th><th>Ação</th><th>Usuário</th><th>Detalhes</th></tr></thead>
    <tbody>${historicoHtml}</tbody>
  </table>

  <div class="signatures">
    <div class="sig"><div class="line">${d.solicitanteNome || "SOLICITANTE"}</div><small>Assinatura do Profissional</small></div>
    <div class="sig"><div class="line">_______________________</div><small>Assinatura da Chefia Imediata</small></div>
  </div>

  ${footerHtml}
  
  <script>window.onload=()=>{setTimeout(()=>window.print(),300);};</script>
</body></html>`;
}

export function printSolicitacaoTroca(d: SolicitacaoTrocaData) {
  const html = buildSolicitacaoTrocaHtml(d);
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
