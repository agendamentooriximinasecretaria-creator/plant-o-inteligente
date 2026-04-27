import { LOGO_SMS_PATH } from "./logoSMS";

export interface FichaProfissionalData {
  profissionalId: string;
  nome: string;
  profissao: string;
  especialidade?: string | null;
  conselho?: string | null;
  registro?: string | null;
  unidadePrincipal?: string | null;
  setorPrincipal?: string | null;
  status: string;
  horasMes: number;
  limiteMes: number;
  documentoConselho?: string | null;
  documentoNumero?: string | null;
  documentoValidade?: string | null;
  ultimosPlantoes: { data: string; horaInicio?: string; horaFim?: string; setor?: string | null }[];
  emitidoPor?: string;
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR");
  } catch { return iso; }
};
const fmtDateTime = (iso?: string) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso; }
};

export function buildFichaProfissionalHtml(d: FichaProfissionalData): string {
  const numero = `FP-${new Date().getFullYear()}-${d.profissionalId.slice(0, 8).toUpperCase()}`;
  const plantoesHtml = d.ultimosPlantoes.length
    ? d.ultimosPlantoes.map(p => `
        <tr>
          <td>${fmtDate(p.data)}</td>
          <td>${(p.horaInicio || '').slice(0,5)} – ${(p.horaFim || '').slice(0,5)}</td>
          <td>${p.setor || '—'}</td>
        </tr>`).join('')
    : `<tr><td colspan="3" style="text-align:center;color:#888">Sem plantões registrados no período</td></tr>`;

  const docValid = d.documentoValidade ? new Date(d.documentoValidade + 'T12:00:00') : null;
  const today = new Date(); today.setHours(0,0,0,0);
  let docStatusBadge = '';
  if (docValid) {
    const diffDays = Math.round((docValid.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) docStatusBadge = `<span style="color:#b91c1c;font-weight:600"> — VENCIDO</span>`;
    else if (diffDays <= 30) docStatusBadge = `<span style="color:#b45309;font-weight:600"> — vence em ${diffDays}d</span>`;
  }

  return `
<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="utf-8" />
<title>Ficha Resumida ${numero}</title>
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
  .footer { margin-top: 28px; font-size: 9px; color: #888; text-align: center; border-top: 1px dashed #ddd; padding-top: 8px; }
  .privacy { font-size: 9px; color: #6b7280; text-align: center; margin-top: 8px; font-style: italic; }
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

  <div class="doc-title">Ficha Resumida do Profissional</div>
  <div class="doc-num">Documento Nº ${numero}</div>

  <div class="grid">
    <div class="field"><div class="l">Nome</div><div class="v">${d.nome || "—"}</div></div>
    <div class="field"><div class="l">Profissão</div><div class="v">${d.profissao || "—"}</div></div>
    <div class="field"><div class="l">Especialidade</div><div class="v">${d.especialidade || "—"}</div></div>
    <div class="field"><div class="l">Conselho / Registro</div><div class="v">${[d.conselho, d.registro].filter(Boolean).join(" ") || "—"}</div></div>
    <div class="field"><div class="l">Unidade Principal</div><div class="v">${d.unidadePrincipal || "—"}</div></div>
    <div class="field"><div class="l">Setor Principal</div><div class="v">${d.setorPrincipal || "—"}</div></div>
    <div class="field"><div class="l">Status</div><div class="v">${d.status === 'ativo' ? 'Ativo' : 'Inativo'}</div></div>
    <div class="field"><div class="l">Horas no Mês</div><div class="v">${d.horasMes.toFixed(1)}h / ${d.limiteMes}h</div></div>
    ${(d.documentoConselho || d.documentoNumero || d.documentoValidade) ? `
      <div class="field" style="grid-column:1/-1">
        <div class="l">Documento Profissional</div>
        <div class="v">${[d.documentoConselho, d.documentoNumero].filter(Boolean).join(' — ') || '—'}${d.documentoValidade ? ` · validade ${fmtDate(d.documentoValidade)}${docStatusBadge}` : ''}</div>
      </div>` : ''}
  </div>

  <div class="section-title">Últimos Plantões</div>
  <table>
    <thead><tr><th>Data</th><th>Horário</th><th>Setor</th></tr></thead>
    <tbody>${plantoesHtml}</tbody>
  </table>

  <div class="footer">
    Emitido em ${fmtDateTime(new Date().toISOString())}${d.emitidoPor ? ` por ${d.emitidoPor}` : ""} · GestorPlantão SMS Oriximiná
  </div>
  <div class="privacy">Documento sem dados sensíveis. Não contém CPF, dados bancários ou endereço residencial.</div>

  <script>window.onload=()=>{setTimeout(()=>window.print(),200);};</script>
</body></html>`;
}

export function printFichaProfissional(d: FichaProfissionalData) {
  const html = buildFichaProfissionalHtml(d);
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
