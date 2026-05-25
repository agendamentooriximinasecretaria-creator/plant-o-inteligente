import { LOGO_SMS_PATH } from "./logoSMS";
import { DOCUMENT_CSS_BASE } from "./documentStyle";
import { buildHeaderHtml, buildFooterHtml } from "./documentTemplates";

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

  const headerHtml = buildHeaderHtml({
    title: "Ficha Resumida do Profissional",
    docNumber: numero,
    emission: new Date().toLocaleString("pt-BR"),
    issuer: d.emitidoPor
  });

  const footerHtml = buildFooterHtml();

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Ficha Resumida ${numero}</title>
<style>
  ${DOCUMENT_CSS_BASE}
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 30px; margin: 20px 0; }
  .field { border-bottom: 1px solid #f1f5f9; padding: 8px 0; }
  .field .l { font-size: 8pt; text-transform: uppercase; color: #64748b; font-weight: 700; }
  .field .v { font-size: 11pt; color: #0f172a; font-weight: 600; margin-top: 2px; }
  .section-title { font-size: 11pt; text-transform: uppercase; color: #0e7490; font-weight: 800; margin: 25px 0 10px; border-bottom: 2px solid #0e7490; padding-bottom: 5px; }
  
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  ${headerHtml}

  <div class="grid">
    <div class="field"><div class="l">Nome Completo</div><div class="v">${d.nome || "—"}</div></div>
    <div class="field"><div class="l">Profissão</div><div class="v">${d.profissao || "—"}</div></div>
    <div class="field"><div class="l">Especialidade</div><div class="v">${d.especialidade || "—"}</div></div>
    <div class="field"><div class="l">Conselho / Registro</div><div class="v">${[d.conselho, d.registro].filter(Boolean).join(" ") || "—"}</div></div>
    <div class="field"><div class="l">Unidade Principal</div><div class="v">${d.unidadePrincipal || "—"}</div></div>
    <div class="field"><div class="l">Setor Principal</div><div class="v">${d.setorPrincipal || "—"}</div></div>
    <div class="field"><div class="l">Status no Sistema</div><div class="v">${d.status === 'ativo' ? 'ATIVO' : 'INATIVO'}</div></div>
    <div class="field"><div class="l">Horas no Mês Atual</div><div class="v">${d.horasMes.toFixed(1)}h / ${d.limiteMes}h</div></div>
  </div>

  <div class="section-title">Histórico de Últimos Plantões</div>
  <table>
    <thead><tr><th>Data</th><th>Horário</th><th>Setor / Unidade</th></tr></thead>
    <tbody>${plantoesHtml}</tbody>
  </table>

  ${footerHtml}
  
  <script>window.onload=()=>{setTimeout(()=>window.print(),300);};</script>
</body></html>`;
}


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
