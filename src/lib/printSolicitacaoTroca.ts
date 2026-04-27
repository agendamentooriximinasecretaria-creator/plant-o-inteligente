import { LOGO_SMS_PATH } from "./logoSMS";

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

  return `
<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="utf-8" />
<title>Solicitação de Troca ${numero}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; margin: 0; font-size: 12px; }
  .header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #0e7490; padding-bottom: 12px; margin-bottom: 18px; }
  .logo { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid #0e7490; background: #fff; flex-shrink: 0; }
  .head-text h1 { margin: 0; font-size: 16px; color: #0e7490; }
  .head-text p { margin: 2px 0; font-size: 11px; color: #555; }
  .doc-title { text-align: center; font-size: 18px; font-weight: 700; margin: 14px 0 4px; letter-spacing: 0.5px; }
  .doc-num { text-align: center; font-size: 11px; color: #666; margin-bottom: 18px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 12px 0; }
  .field { border-bottom: 1px solid #e5e7eb; padding: 6px 0; }
  .field .l { font-size: 9px; text-transform: uppercase; letter-spacing: 0.4px; color: #6b7280; }
  .field .v { font-size: 13px; color: #111; font-weight: 500; }
  .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: #0e7490; font-weight: 700; margin: 18px 0 6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; color: #374151; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 48px; }
  .sig { text-align: center; }
  .sig .line { border-top: 1px solid #333; padding-top: 4px; font-size: 11px; }
  .sig small { display: block; color: #666; font-size: 9px; margin-top: 2px; }
  .footer { margin-top: 28px; font-size: 9px; color: #888; text-align: center; border-top: 1px dashed #ddd; padding-top: 8px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head>
<body>
  <div class="header">
    <img src="${LOGO_SMS_PATH}" class="logo" alt="SMS" />
    <div class="head-text">
      <h1>SECRETARIA MUNICIPAL DE SAÚDE — ORIXIMINÁ</h1>
      <p>CNPJ: 05.131.081/0001-82</p>
      <p>GestorPlantão · Sistema de Gestão de Escalas</p>
    </div>
  </div>

  <div class="doc-title">Solicitação de Troca de Plantão</div>
  <div class="doc-num">Documento Nº ${numero}</div>

  <div class="grid">
    <div class="field"><div class="l">Solicitante</div><div class="v">${d.solicitanteNome || "—"}</div></div>
    <div class="field"><div class="l">Substituto</div><div class="v">${d.substitutoNome || "Cobertura aberta"}</div></div>
    <div class="field"><div class="l">Unidade</div><div class="v">${d.unidade || "—"}</div></div>
    <div class="field"><div class="l">Setor</div><div class="v">${d.setor || "—"}</div></div>
    <div class="field"><div class="l">Data do Plantão</div><div class="v">${fmtDate(d.data)}</div></div>
    <div class="field"><div class="l">Horário</div><div class="v">${(d.horaInicio || "").slice(0,5)} – ${(d.horaFim || "").slice(0,5)}</div></div>
    <div class="field"><div class="l">Status</div><div class="v">${d.status}</div></div>
    <div class="field"><div class="l">Solicitada em</div><div class="v">${fmtDateTime(d.criadoEm)}</div></div>
    <div class="field" style="grid-column: 1/-1"><div class="l">Motivo</div><div class="v">${d.motivo || "—"}</div></div>
    ${d.responsavel ? `<div class="field" style="grid-column: 1/-1"><div class="l">Responsável pela aprovação/recusa</div><div class="v">${d.responsavel}</div></div>` : ""}
  </div>

  <div class="section-title">Histórico</div>
  <table>
    <thead><tr><th>Data/Hora</th><th>Ação</th><th>Usuário</th><th>Detalhes</th></tr></thead>
    <tbody>${historicoHtml}</tbody>
  </table>

  <div class="signatures">
    <div class="sig"><div class="line">${d.solicitanteNome || ""}</div><small>Assinatura do Solicitante</small></div>
    <div class="sig"><div class="line">_______________________</div><small>Assinatura do Gestor</small></div>
  </div>

  <div class="footer">
    Emitido em ${fmtDateTime(new Date().toISOString())}${d.emitidoPor ? ` por ${d.emitidoPor}` : ""} · GestorPlantão SMS Oriximiná
  </div>

  <script>window.onload=()=>{setTimeout(()=>window.print(),200);};</script>
</body></html>`;
}

export function printSolicitacaoTroca(d: SolicitacaoTrocaData) {
  const html = buildSolicitacaoTrocaHtml(d);
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
