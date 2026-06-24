// ===============================================================
// Modelo de impressão: "Escala Mensal Oficial"
// ---------------------------------------------------------------
// Layout inspirado na escala em papel hospitalar:
//   - cabeçalho institucional unificado
//   - tabela: Profissional × dias do mês (1..30/31) + Total
//   - assinatura institucional padronizada
// ===============================================================

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getLogoSmsDataUrl, getLogoOriximinaDataUrl, logoSmsImgHtml } from "./logoSMS";
import type { StampData } from "./pdfStampUtils";
import { DOCUMENT_CSS_BASE } from "./documentStyle";
import { buildHeaderHtml, buildSignatureHtml, buildFooterHtml } from "./documentTemplates";

export interface MensalInstituicao {
  prefeitura?: string;       // ex: "Prefeitura Municipal de Oriximiná"
  secretaria?: string;       // ex: "Secretaria Municipal de Saúde"
  unidade?: string;          // ex: "Hospital Municipal de Oriximiná"
  cnpj?: string;
}

export interface MensalTipoLegenda {
  sigla: string;             // D, N, M, T, 24, SA, F, LP, FE, A...
  nome: string;              // "Diurno 12h", "Noturno 12h"...
  start?: string;            // "07:00"
  end?: string;              // "19:00"
  carga?: number;
}

export interface MensalShift {
  dia: number;               // 1..31
  sigla: string;             // sigla do plantão
  tipo?: string;             // nome do tipo
  hora_inicio?: string;
  hora_fim?: string;
  carga?: number;
  status?: string;
}

export interface MensalProfissional {
  id: string;
  nome: string;
  profissao?: string;
  unidade?: string;
  setor?: string;
  conselho?: string;         // ex: "CRM 12345" (opcional)
  porDia: Record<number, MensalShift[]>;
  totalHoras: number;
  totalPlantoes: number;
  totalADN?: number;
  elegivelADN?: boolean;
}

export interface MensalCabecalho {
  instituicao: MensalInstituicao;
  ano: number;
  mes: number;               // 1..12
  setor?: string;            // ex: "UCE / INTERNAÇÃO"
  profissaoLabel?: string;   // ex: "FISIOTERAPEUTAS"
  emitidoPor?: string;
  sistema?: string;
}

export interface MensalResponsavel {
  nome: string;
  cargo: string;
  conselho: string;
  unidade: string;
  assinaturaBase64?: string;
  carimboBase64?: string;
  tipo?: string;
  hasVisualSignature?: boolean;
  hasStamp?: boolean;
  hasDigitalSeal?: boolean;
  // Campos detalhados / flags vindos de "Exibição no Documento"
  profissao?: string;
  especialidade?: string;
  conselhoSigla?: string;
  registroNumero?: string;
  ufConselho?: string;
  cbo?: string;
  cns?: string;
  setor?: string;
  cidadeUf?: string;
  textoPersonalizado?: string;
  display?: {
    mostrar_profissao?: boolean;
    mostrar_especialidade?: boolean;
    mostrar_conselho?: boolean;
    mostrar_uf_conselho?: boolean;
    mostrar_cbo?: boolean;
    mostrar_cns?: boolean;
    mostrar_unidade?: boolean;
    mostrar_setor?: boolean;
    mostrar_cidade_uf?: boolean;
    mostrar_data_local?: boolean;
    mostrar_codigo_validacao?: boolean;
    mostrar_hash?: boolean;
    mostrar_qr_code?: boolean;
  };
}

export interface MensalOpts {
  incluirLogo: boolean;
  incluirAssinatura: boolean;
  incluirTotalHoras: boolean;
  incluirADN?: boolean;
  adnLabel?: string;
  adnDecimals?: number;
  incluirObservacoesRodape: boolean;
  totalLabel?: "TOTAL" | "ADN";
  responsavel?: MensalResponsavel;
  responsavelTecnico?: MensalResponsavel;
  codigoValidacao?: string;
  dataEmissao?: string;
}


const DIAS_PT_FULL = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const DIAS_SEM_ABREV = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

// Substitui placeholders {{data_emissao}} e {{codigo_validacao}} em qualquer texto
function substituirPlaceholders(texto: string, opts: MensalOpts): string {
  const data = opts.dataEmissao || new Date().toLocaleString("pt-BR");
  const codigo = opts.codigoValidacao || "";
  return (texto || "")
    .replace(/\{\{\s*data_emissao\s*\}\}/gi, data)
    .replace(/\{\{\s*codigo_validacao\s*\}\}/gi, codigo);
}

// Renderiza o bloco de informações do responsável respeitando flags de "Exibição no Documento"
function renderResponsavelInfo(
  doc: jsPDF,
  r: MensalResponsavel | undefined,
  xCenter: number,
  yStart: number,
  opts: MensalOpts
) {
  if (!r) return;
  const lines = buildResponsavelInfoLines(r, opts);

  let y = yStart;
  for (const ln of lines) {
    doc.setFont("helvetica", ln.bold ? "bold" : "normal");
    doc.setFontSize(ln.size ?? 7);
    doc.setTextColor(ln.muted ? 100 : 0);
    doc.text(substituirPlaceholders(ln.text, opts), xCenter, y, { align: "center" });
    y += getResponsavelLineHeight(ln.size);
  }
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
}

function buildResponsavelInfoLines(r: MensalResponsavel, opts: MensalOpts): { text: string; bold?: boolean; muted?: boolean; size?: number }[] {
  const d = r.display || {};
  // Quando display vier indefinido, exibir o máximo possível por padrão
  const show = (flag: boolean | undefined, fallback = true) => (flag === undefined ? fallback : !!flag);

  const lines: { text: string; bold?: boolean; muted?: boolean; size?: number }[] = [];

  if (r.nome) lines.push({ text: r.nome.toUpperCase(), bold: true, size: 8.5 });
  if (r.cargo) lines.push({ text: r.cargo, size: 7.5 });

  if (show(d.mostrar_profissao, false) && r.profissao) {
    lines.push({ text: r.profissao, size: 7 });
  }

  // Conselho + Registro + UF (ex: COREN 946921-ENF / PA)
  if (show(d.mostrar_conselho)) {
    const sigla = r.conselhoSigla || "";
    const reg = r.registroNumero || "";
    const uf = show(d.mostrar_uf_conselho) && r.ufConselho ? ` / ${r.ufConselho}` : "";
    const linha = `${sigla} ${reg}${uf}`.trim();
    if (linha) lines.push({ text: linha, size: 7.5 });
    else if (r.conselho && r.conselho !== "Não informado") {
      lines.push({ text: r.conselho, size: 7.5 });
    }
  } else if (r.conselho && r.conselho !== "Não informado") {
    lines.push({ text: r.conselho, size: 7.5 });
  }

  if (show(d.mostrar_especialidade, false) && r.especialidade) {
    lines.push({ text: r.especialidade, size: 7 });
  }
  if (show(d.mostrar_cbo, false) && r.cbo) {
    lines.push({ text: `CBO: ${r.cbo}`, size: 7 });
  }
  if (show(d.mostrar_cns, false) && r.cns) {
    lines.push({ text: `CNS: ${r.cns}`, size: 7 });
  }
  if (show(d.mostrar_unidade) && r.unidade) {
    lines.push({ text: r.unidade, size: 6.5, muted: true });
  }
  if (show(d.mostrar_setor, false) && r.setor) {
    lines.push({ text: r.setor, size: 6.5, muted: true });
  }
  if (show(d.mostrar_cidade_uf, false) && r.cidadeUf) {
    const data = show(d.mostrar_data_local, false)
      ? `, ${opts.dataEmissao || new Date().toLocaleDateString("pt-BR")}`
      : "";
    lines.push({ text: `${r.cidadeUf}${data}`, size: 6.5, muted: true });
  } else if (show(d.mostrar_data_local, false)) {
    lines.push({ text: opts.dataEmissao || new Date().toLocaleDateString("pt-BR"), size: 6.5, muted: true });
  }
  if (show(d.mostrar_codigo_validacao, false) && opts.codigoValidacao) {
    lines.push({ text: `Código: ${opts.codigoValidacao}`, size: 6.5, muted: true });
  }
  if (r.textoPersonalizado) {
    lines.push({ text: substituirPlaceholders(r.textoPersonalizado, opts), size: 6.5, muted: true });
  }

  return lines;
}

function getResponsavelLineHeight(size?: number): number {
  return size && size >= 8 ? 4 : 3.2;
}

function measureResponsavelInfoHeight(r: MensalResponsavel | undefined, opts: MensalOpts): number {
  if (!r) return 0;
  return buildResponsavelInfoLines(r, opts).reduce((total, ln) => total + getResponsavelLineHeight(ln.size), 0);
}

function hasSignatureMedia(r: MensalResponsavel | undefined): boolean {
  return !!(
    (r?.assinaturaBase64 && r.assinaturaBase64.length > 100) ||
    (r?.carimboBase64 && r.carimboBase64.length > 100) ||
    (!r?.assinaturaBase64 && (r?.hasDigitalSeal || r?.tipo === "digital_gerado" || r?.tipo === "eletronica_interna"))
  );
}



// Categorização por tipo de plantão -> cores suaves (RGB para jsPDF e hex para HTML)
function getCategoryColor(tipo: string, status: string): { bg: [number, number, number], hex: string, text: [number, number, number] } {
  const t = (tipo || "").toLowerCase();
  const s = (status || "").toLowerCase();

  if (s === "cancelado") return { bg: [254, 226, 226], hex: "#fef2f2", text: [185, 28, 28] }; // rose-50
  if (s === "pendente") return { bg: [254, 249, 195], hex: "#fffbeb", text: [180, 83, 9] }; // amber-50

  if (t.includes("férias") || t.includes("ferias")) return { bg: [204, 251, 241], hex: "#f0fdfa", text: [15, 118, 110] }; // teal-50
  if (t.includes("licença") || t.includes("licenca") || t.includes("lp")) return { bg: [207, 250, 254], hex: "#ecfeff", text: [14, 116, 144] }; // cyan-50
  if (t.includes("atestado")) return { bg: [255, 228, 230], hex: "#fff1f2", text: [190, 18, 60] }; // rose-50
  if (t.includes("folga") || t.includes("indispon")) return { bg: [248, 250, 252], hex: "#f8fafc", text: [148, 163, 184] }; // slate-400 equivalent
  if (t.includes("sobreaviso")) return { bg: [241, 245, 249], hex: "#f1f5f9", text: [71, 85, 105] }; // slate-600 equivalent
  if (t.includes("24")) return { bg: [209, 250, 229], hex: "#ecfdf5", text: [5, 150, 105] }; // emerald-600 equivalent
  if (t.includes("manh")) return { bg: [254, 243, 199], hex: "#fffbeb", text: [180, 83, 9] }; // amber-700 equivalent
  if (t.includes("tarde")) return { bg: [255, 237, 213], hex: "#fff7ed", text: [194, 65, 12] }; // orange-700 equivalent
  if (t.includes("not")) return { bg: [238, 242, 255], hex: "#eef2ff", text: [67, 56, 202] }; // indigo-700 equivalent
  if (t.includes("diurn")) return { bg: [239, 246, 255], hex: "#eff6ff", text: [29, 78, 216] }; // blue-700 equivalent

  return { bg: [255, 255, 255], hex: "#ffffff", text: [0, 0, 0] };
}

function escapeHtml(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function diasDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

function diaSemana(ano: number, mes: number, dia: number): number {
  return new Date(ano, mes - 1, dia).getDay();
}

function buildSubtituloTabela(cab: MensalCabecalho): string {
  const setor = cab.setor ? cab.setor.toUpperCase() : "";
  const prof = cab.profissaoLabel ? cab.profissaoLabel.toUpperCase() : "";
  const left = [prof, setor ? `(${setor})` : ""].filter(Boolean).join(" ");
  const periodo = `${DIAS_PT_FULL[cab.mes - 1]} ${cab.ano}`;
  return left ? `${left} - ${periodo}` : `ESCALA - ${periodo}`;
}

// ---------------------------------------------------------------
// HTML (Visualizar / Imprimir via window.print)
// ---------------------------------------------------------------
function buildHtml(cab: MensalCabecalho, profs: MensalProfissional[], tipos: MensalTipoLegenda[], opts: MensalOpts): string {
  const totalDias = diasDoMes(cab.ano, cab.mes);
  const totalLabel = opts.totalLabel || "TOTAL";
  const sistema = cab.sistema || "GestorPlantão SMS Oriximiná";
  const emissao = new Date().toLocaleString("pt-BR");

  const colDiaTh = Array.from({ length: totalDias }, (_, i) => {
    const d = i + 1;
    const dow = diaSemana(cab.ano, cab.mes, d);
    const fds = dow === 0 || dow === 6;
    const isLastInWeek = dow === 6;
    return `<th class="dia ${fds ? "fds" : ""} ${isLastInWeek ? "week-sep" : ""}"><div class="d">${d}</div><div class="dw">${DIAS_SEM_ABREV[dow]}</div></th>`;
  }).join("");

  const totalCols = totalDias + (opts.incluirTotalHoras ? 1 : 0) + (opts.incluirADN ? 1 : 0) + 1;

  // Agrupa profissionais por Unidade -> Setor -> Profissão
  const tree = new Map<string, Map<string, Map<string, MensalProfissional[]>>>();
  for (const p of profs) {
    const u = p.unidade || cab.instituicao.unidade || "Unidade não informada";
    const s = p.setor || "Setor não informado";
    const prof = p.profissao || "Outras Profissões";

    if (!tree.has(u)) tree.set(u, new Map());
    const unidadeMap = tree.get(u)!;

    if (!unidadeMap.has(s)) unidadeMap.set(s, new Map());
    const setorMap = unidadeMap.get(s)!;

    if (!setorMap.has(prof)) setorMap.set(prof, []);
    setorMap.get(prof)!.push(p);
  }

  let linhasTr = "";
  if (profs.length === 0) {
    linhasTr = `<tr><td colspan="${totalCols}" class="empty">Nenhum profissional/plantão para os filtros selecionados.</td></tr>`;
  } else {
    const sortedUnidades = Array.from(tree.keys()).sort();
    for (const u of sortedUnidades) {
      const unidadeMap = tree.get(u)!;
      // Header de Unidade
      linhasTr += `<tr class="group-header unidade"><td colspan="${totalCols}">UNIDADE: ${escapeHtml(u)}</td></tr>`;
      
      const sortedSetores = Array.from(unidadeMap.keys()).sort();
      for (const s of sortedSetores) {
        // Header de Setor
        linhasTr += `<tr class="group-header setor"><td colspan="${totalCols}">SETOR: ${escapeHtml(s)}</td></tr>`;
        
        const setorMap = unidadeMap.get(s)!;
        const sortedProfissoes = Array.from(setorMap.keys()).sort();
        for (const pName of sortedProfissoes) {
          // Header de Profissão
          linhasTr += `<tr class="group-header profissao"><td colspan="${totalCols}">${escapeHtml(pName)}</td></tr>`;
          
          const sortedList = setorMap.get(pName)!.sort((a, b) => a.nome.localeCompare(b.nome));
          for (const p of sortedList) {
            const cells = Array.from({ length: totalDias }, (_, i) => {
              const d = i + 1;
              const lista = p.porDia[d] || [];
              const dow = diaSemana(cab.ano, cab.mes, d);
              const fds = dow === 0 || dow === 6;
              const isLastInWeek = dow === 6;
              const cellCls = `dia ${fds ? "fds" : ""} ${isLastInWeek ? "week-sep" : ""}`;

              if (lista.length === 0) return `<td class="${cellCls}">—</td>`;
              
              const siglas = lista.map((s) => s.sigla).join("/");
              const tipoBase = lista[0].tipo || "";
              const statusBase = lista[0].status || "";
              const color = getCategoryColor(tipoBase, statusBase);
              
              const tooltip = lista.map((l) => `${l.tipo || l.sigla} ${(l.hora_inicio || "").slice(0, 5)}-${(l.hora_fim || "").slice(0, 5)}`).join(" | ");
              return `<td class="${cellCls}" style="background-color: ${color.hex}; color: rgb(${color.text.join(",")})" title="${escapeHtml(tooltip)}">${escapeHtml(siglas)}</td>`;
            }).join("");
            
            const total = opts.incluirTotalHoras ? `${p.totalHoras}h` : `${p.totalPlantoes}`;
            const conselho = p.conselho && p.conselho !== "Não inf." ? `<span class="cons">${escapeHtml(p.conselho)}</span>` : `<span class="cons" style="color:#999;font-style:italic">Não informado</span>`;
            
            linhasTr += `<tr class="row-prof" style="background-color: ${profs.indexOf(p) % 2 === 0 ? '#fff' : '#f9fafb'}">
              <td class="nome">${escapeHtml(p.nome)}${conselho}</td>
              ${cells}
              ${opts.incluirTotalHoras ? `<td class="total">${escapeHtml(total)}</td>` : ""}
              ${opts.incluirADN ? `<td class="total" style="background-color: #eef2ff; border-left: 1px solid #ccc;">${p.elegivelADN ? `${p.totalADN?.toFixed(opts.adnDecimals ?? 1)}h` : "—"}</td>` : ""}
            </tr>`;
          }
        }
      }
    }
  }

  const legendaTipos = tipos.map((t) => {
    const horario = t.start && t.end ? `${t.start} às ${t.end}` : (t.nome || "");
    const color = getCategoryColor(t.nome || "", "");
    return `<span class="lg-item"><b style="background-color: ${color.hex}; color: rgb(${color.text.join(",")}); padding: 1px 3px; border-radius: 2px; border: 0.5px solid #ccc">${escapeHtml(t.sigla)}</b> = ${escapeHtml(horario)}</span>`;
  }).join("");

  const subtitulo = buildSubtituloTabela(cab);

  const responsavel = opts.responsavel;
  const responsavelTecnico = opts.responsavelTecnico;
  
  const headerHtml = buildHeaderHtml({
    title: "ESCALA MENSAL DE SERVIÇO",
    unit: cab.instituicao.unidade || "Unidade não informada",
    sector: cab.setor,
    period: `${DIAS_PT_FULL[cab.mes - 1]} ${cab.ano}`,
    emission: emissao,
    issuer: cab.emitidoPor
  });

  const assinaturasHtml = opts.incluirAssinatura ? buildSignatureHtml({
    responsavel,
    responsavelTecnico
  }) : "";

  const obsRodape = opts.incluirObservacoesRodape ? `
    <div class="obs-rodape">
      <p><b>OBSERVAÇÕES:</b> Escala sujeita a alteração. Qualquer troca de plantão deve ser comunicada à coordenação.</p>
    </div>` : "";

  const footerHtml = buildFooterHtml(sistema);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Escala Mensal Oficial</title>
<style>
  ${DOCUMENT_CSS_BASE}
  @page { size: A4 landscape; margin: 10mm; }
  
  .toolbar { position: sticky; top: 0; background:#fff; padding: 10px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 15px; display:flex; gap:10px; }
  .toolbar button { background:#0e7490; color:#fff; border:none; padding: 8px 16px; border-radius: 6px; cursor:pointer; font-size: 13px; font-weight: 600; }
  .toolbar button.secondary { background:#fff; color:#111; border:1px solid #cbd5e1; }

  /* Ajustes para tabela densa (Mensal) */
  table.escala { border: 1.5px solid #111; table-layout: fixed; }
  table.escala th, table.escala td { border: 1px solid #ccc; padding: 4px 2px; text-align: center; vertical-align: middle; font-size: 8pt; line-height: 1.1; }
  table.escala thead th { background: #e2e8f0; border-bottom: 1.5px solid #111; }
  table.escala th.nome, table.escala td.nome { text-align: left; padding-left: 8px; width: 140px; border-right: 1.5px solid #111; }
  table.escala td.nome .cons { font-size: 7.5pt; color: #666; display:block; margin-top: 1px; }
  table.escala th.fds, table.escala td.fds { background: #f1f5f9; }
  table.escala th.week-sep, table.escala td.week-sep { border-right: 1.5px solid #111; }
  table.escala th.total, table.escala td.total { background:#e2e8f0; font-weight: 900; width: 50px; border-left: 1.5px solid #111; }

  /* Agrupamentos */
  .group-header td { text-align: left !important; padding: 6px 12px !important; font-weight: 800 !important; text-transform: uppercase; }
  .group-header.unidade { background: #1e293b; color: white; letter-spacing: 1px; }
  .group-header.setor { background: #f1f5f9; border-bottom: 1px solid #111 !important; }
  .group-header.profissao { background: #fff; color: #64748b; font-style: italic; border-bottom: 1px solid #eee !important; font-size: 8.5pt !important; }

  .legenda { margin-top: 15px; padding: 10px; border: 1px solid #ccc; font-size: 8pt; background: #f8fafc; border-radius: 4px; }
  .legenda .lg-item { display:inline-block; margin-right: 15px; white-space:nowrap; margin-bottom: 5px; }
  .obs-rodape { margin-top: 10px; font-size: 9pt; }

  @media print {
    @page { size: A4 landscape; margin: 6mm; }
    html, body { margin: 0 !important; padding: 0 !important; }
    .toolbar { display: none !important; }
    thead { display: table-header-group; }

    /* Compactação base de impressão */
    .header-institucional { padding-bottom: 3px !important; margin-bottom: 4px !important; }
    .header-institucional .titles h1 { font-size: 9pt !important; }
    .header-institucional .titles h2 { font-size: 7pt !important; }
    .header-institucional img { width: 36px !important; height: 36px !important; }
    .doc-title { font-size: 10pt !important; margin: 4px 0 2px !important; }
    .doc-info { font-size: 7.5pt !important; margin-bottom: 4px !important; padding-bottom: 2px !important; }

    table.escala th, table.escala td { padding: 2px 1px !important; font-size: 7.5pt !important; line-height: 1.05 !important; }
    table.escala td.nome .cons { font-size: 6.5pt !important; }
    .legenda { margin-top: 6px !important; padding: 5px 8px !important; font-size: 7pt !important; }
    .legenda .lg-item { margin-right: 10px !important; margin-bottom: 2px !important; }
    .obs-rodape { margin-top: 5px !important; font-size: 7.5pt !important; }
    .assinatura-block, .signatures { margin-top: 18px !important; gap: 30px !important; }
    .assinatura-line, .sig .line { margin-top: 24px !important; font-size: 8.5pt !important; }
    .assinatura-info, .sig small { font-size: 7.5pt !important; }
    .footer-institucional { margin-top: 10px !important; font-size: 7pt !important; padding-top: 6px !important; }

    /* Evita quebra em blocos críticos */
    .legenda, .obs-rodape, .assinatura-block, .signatures, .footer-institucional {
      page-break-inside: avoid; break-inside: avoid;
    }
    .assinatura-block, .signatures, .footer-institucional { break-before: avoid; page-break-before: avoid; }
    table.escala tr { page-break-inside: avoid; break-inside: avoid; }

    /* Mantém o rodapé do documento (legenda + obs + assinaturas + footer)
       agrupado e junto da última linha da tabela, evitando 2ª página vazia */
    .print-bottom { page-break-inside: avoid; break-inside: avoid; break-before: avoid; page-break-before: avoid; }

    /* Modo ultra-compacto quando o conteúdo excede 1 página */
    body.compact-print .header-institucional img { width: 28px !important; height: 28px !important; }
    body.compact-print .header-institucional .titles h1 { font-size: 8pt !important; }
    body.compact-print .header-institucional .titles h2 { font-size: 6.5pt !important; }
    body.compact-print .doc-title { font-size: 9pt !important; margin: 2px 0 1px !important; }
    body.compact-print .doc-info { font-size: 6.5pt !important; margin-bottom: 2px !important; padding-bottom: 1px !important; }
    body.compact-print table.escala th,
    body.compact-print table.escala td { padding: 1px 1px !important; font-size: 6.5pt !important; line-height: 1 !important; }
    body.compact-print table.escala td.nome { padding-left: 4px !important; }
    body.compact-print table.escala td.nome .cons { font-size: 5.5pt !important; }
    body.compact-print .legenda { margin-top: 3px !important; padding: 3px 6px !important; font-size: 6pt !important; }
    body.compact-print .obs-rodape { margin-top: 3px !important; font-size: 6.5pt !important; }
    body.compact-print .assinatura-block, body.compact-print .signatures { margin-top: 8px !important; gap: 16px !important; }
    body.compact-print .assinatura-line, body.compact-print .sig .line { margin-top: 14px !important; font-size: 7.5pt !important; }
    body.compact-print .assinatura-info, body.compact-print .sig small { font-size: 6.5pt !important; }
    body.compact-print .footer-institucional { margin-top: 4px !important; font-size: 6pt !important; padding-top: 3px !important; }

    /* Fill Page: usado apenas na impressão para esticar a escala até o bloco inferior real */
    body.fill-page-print table.escala thead th {
      height: var(--print-head-row-h, auto) !important;
      padding-top: var(--print-head-pad-y, 2px) !important;
      padding-bottom: var(--print-head-pad-y, 2px) !important;
      font-size: var(--print-head-font, 7.5pt) !important;
    }
    body.fill-page-print table.escala tbody tr.group-header td {
      height: var(--print-group-row-h, auto) !important;
      padding-top: var(--print-group-pad-y, 2px) !important;
      padding-bottom: var(--print-group-pad-y, 2px) !important;
      font-size: var(--print-group-font, 7.5pt) !important;
    }
    body.fill-page-print table.escala tbody tr.row-prof {
      height: var(--print-data-row-h, auto) !important;
    }
    body.fill-page-print table.escala tbody tr.row-prof td {
      height: var(--print-data-row-h, auto) !important;
      padding-top: var(--print-data-pad-y, 2px) !important;
      padding-bottom: var(--print-data-pad-y, 2px) !important;
      font-size: var(--print-body-font, 7.5pt) !important;
    }
    body.fill-page-print table.escala tbody tr.row-prof td.nome .cons {
      font-size: var(--print-cons-font, 6.5pt) !important;
    }

    /* Tier extra-compacto (acionado se ainda exceder) */
    body.ultra-compact-print .header-institucional img { width: 22px !important; height: 22px !important; }
    body.ultra-compact-print .header-institucional { padding-bottom: 1px !important; margin-bottom: 2px !important; }
    body.ultra-compact-print .doc-title { font-size: 8pt !important; }
    body.ultra-compact-print .doc-info { font-size: 6pt !important; }
    body.ultra-compact-print table.escala th,
    body.ultra-compact-print table.escala td { padding: 0px 1px !important; font-size: 6pt !important; }
    body.ultra-compact-print .legenda { font-size: 5.5pt !important; padding: 2px 4px !important; }
    body.ultra-compact-print .obs-rodape { font-size: 6pt !important; }
    body.ultra-compact-print .assinatura-block, body.ultra-compact-print .signatures { margin-top: 4px !important; }
    body.ultra-compact-print .assinatura-line, body.ultra-compact-print .sig .line { margin-top: 10px !important; font-size: 7pt !important; }
    body.ultra-compact-print .footer-institucional { font-size: 5.5pt !important; margin-top: 2px !important; }
  }

</style>
</head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.__doPrint && window.__doPrint()">🖨️ Imprimir Escala</button>
    <button class="secondary" onclick="window.close()">Fechar</button>
  </div>
  <script>
    // Auto-compactação progressiva: tenta caber tudo em 1 página A4 paisagem
    window.__doPrint = function(){
      try {
        // A4 paisagem útil ~ 1110 x 780 px (96dpi) com margem ~6mm
        var maxH = 780;
        document.body.classList.remove('compact-print', 'ultra-compact-print', 'fill-page-print');
        ['--print-head-row-h','--print-head-pad-y','--print-head-font','--print-group-row-h','--print-group-pad-y','--print-group-font','--print-data-row-h','--print-data-pad-y','--print-body-font','--print-cons-font'].forEach(function(v){ document.body.style.removeProperty(v); });
        void document.body.offsetHeight;

        if (document.documentElement.scrollHeight <= maxH) {
          var table = document.querySelector('table.escala');
          var bottom = document.querySelector('.print-bottom');
          if (table && bottom) {
            var tableTop = table.getBoundingClientRect().top + window.scrollY;
            var bottomH = bottom.getBoundingClientRect().height;
            var availableTableH = Math.max(180, maxH - tableTop - bottomH - 4);
            var currentTableH = table.getBoundingClientRect().height;
            if (availableTableH > currentTableH + 8) {
              var dataRows = Math.max(1, table.querySelectorAll('tbody tr.row-prof').length);
              var groupRows = table.querySelectorAll('tbody tr.group-header').length;
              var headRows = table.tHead ? table.tHead.rows.length : 1;
              var targetTableH = availableTableH * 0.95;
              var headH = Math.max(14, Math.min(24, targetTableH * 0.06));
              var groupH = Math.max(10, Math.min(18, targetTableH * 0.035));
              var reservedRowsH = (headRows * headH) + (groupRows * groupH);
              var dataH = Math.max(18, (targetTableH - reservedRowsH) / dataRows);
              var bodyFont = Math.max(7.5, Math.min(11.5, dataH * 0.16));
              document.body.style.setProperty('--print-data-row-h', dataH.toFixed(1) + 'px');
              document.body.style.setProperty('--print-group-row-h', groupH.toFixed(1) + 'px');
              document.body.style.setProperty('--print-head-row-h', headH.toFixed(1) + 'px');
              document.body.style.setProperty('--print-data-pad-y', Math.max(2, Math.min(8, dataH * 0.06)).toFixed(1) + 'px');
              document.body.style.setProperty('--print-group-pad-y', Math.max(1, Math.min(4, groupH * 0.08)).toFixed(1) + 'px');
              document.body.style.setProperty('--print-head-pad-y', Math.max(1, Math.min(4, headH * 0.08)).toFixed(1) + 'px');
              document.body.style.setProperty('--print-body-font', bodyFont.toFixed(1) + 'pt');
              document.body.style.setProperty('--print-head-font', Math.max(7.5, Math.min(10.5, bodyFont * 0.92)).toFixed(1) + 'pt');
              document.body.style.setProperty('--print-group-font', Math.max(7.5, Math.min(10, bodyFont * 0.9)).toFixed(1) + 'pt');
              document.body.style.setProperty('--print-cons-font', Math.max(6.5, bodyFont - 1).toFixed(1) + 'pt');
              document.body.classList.add('fill-page-print');
              void document.body.offsetHeight;
            }
          }
        }

        if (document.documentElement.scrollHeight > maxH) {
          document.body.classList.remove('fill-page-print');
          document.body.classList.add('compact-print');
          void document.body.offsetHeight;
          if (document.documentElement.scrollHeight > maxH) {
            document.body.classList.add('ultra-compact-print');
          }
        }
      } catch(e){}
      setTimeout(function(){ window.print(); }, 120);
    };
  </script>




  ${headerHtml}

  <table class="escala">
    <thead>
      <tr>
        <th class="nome">PROFISSIONAL</th>
        ${colDiaTh}
        ${opts.incluirTotalHoras ? `<th class="total">${escapeHtml(totalLabel)}</th>` : ""}
        ${opts.incluirADN ? `<th class="total" style="background-color: #e0e7ff; color: #3730a3;">${opts.adnLabel || 'ADN'}</th>` : ""}
      </tr>
    </thead>
    <tbody>${linhasTr}</tbody>
  </table>

  <div class="print-bottom">
    <div class="legenda">
      <strong>Legenda:</strong> ${legendaTipos}
    </div>

    ${obsRodape}
    ${assinaturasHtml}

    ${footerHtml}
  </div>

</body>
</html>`;
}


export function abrirEscalaMensalOficial(
  cab: MensalCabecalho,
  profs: MensalProfissional[],
  tipos: MensalTipoLegenda[],
  opts: MensalOpts,
  autoPrint = false,
): boolean {
  const w = window.open("", "_blank", "width=1280,height=820");
  if (!w) return false;
  let html = buildHtml(cab, profs, tipos, opts);
  if (autoPrint) {
    html = html.replace("</body>", "<script>window.onload=()=>setTimeout(()=>window.__doPrint && window.__doPrint(),300)</script></body>");
  }
  w.document.write(html);
  w.document.close();

  // Registra documento versionado (silencioso)
  import("./registrarDocumento").then(({ registrarDocumentoGerado }) => {
    registrarDocumentoGerado({
      tipo: "escala_mensal",
      titulo: `Escala Mensal Oficial — ${cab.mes}/${cab.ano} ${cab.setor ?? ""}`.trim(),
      conteudoHtml: html,
      dadosGeracao: {
        cabecalho: { mes: cab.mes, ano: cab.ano, setor: cab.setor, profissao: cab.profissaoLabel },
        totalProfissionais: profs.length,
      },
    });
  });

  return true;
}


// ---------------------------------------------------------------
// PDF (jsPDF + autoTable)
// ---------------------------------------------------------------
export async function gerarPdfEscalaMensalOficial(
  cab: MensalCabecalho,
  profs: MensalProfissional[],
  tipos: MensalTipoLegenda[],
  opts: MensalOpts,
  filename: string,
  modo: "save" | "open" = "save"
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const totalDias = diasDoMes(cab.ano, cab.mes);
  const totalLabel = opts.totalLabel || "TOTAL";
  const margin = 10;
  let y = margin;

  if (opts.incluirLogo) {
    try {
      const [logoSms, logoOriximina] = await Promise.all([
        getLogoSmsDataUrl(),
        getLogoOriximinaDataUrl()
      ]);
      
      const logoSize = 12; // Menor no PDF
      if (logoSms) {
        doc.addImage(logoSms, "PNG", margin, y - 2, logoSize, logoSize);
      }
      
      if (logoOriximina) {
        doc.addImage(logoOriximina, "JPEG", pageW - margin - logoSize, y - 2, logoSize, logoSize);
      }
    } catch { /* ignora */ }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(14, 116, 144);
  doc.text("SECRETARIA MUNICIPAL DE SAÚDE — ORIXIMINÁ", pageW / 2, y + 2, { align: "center" });
  
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 60);
  doc.text("Hospital Municipal de Oriximiná · CNPJ 05.131.081/0001-82", pageW / 2, y + 5, { align: "center" });
  doc.text("GestorPlantão · Sistema de Gestão de Escalas", pageW / 2, y + 8, { align: "center" });

  
  y += 13;
  
  doc.setFontSize(10);
  doc.setTextColor(0);
  const mesLabel = DIAS_PT_FULL[cab.mes - 1];
  doc.text(`ESCALA MENSAL DE SERVIÇO — ${mesLabel} / ${cab.ano}`, pageW / 2, y, { align: "center" });
  y += 5;


  // Linha com: Unidade • Setor • Período • Emissão • Emitido por
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80);
  const emissao = new Date().toLocaleString("pt-BR");
  const infoParts = [
    cab.instituicao.unidade ? `Unidade: ${cab.instituicao.unidade}` : null,
    cab.setor ? `Setor: ${cab.setor}` : null,
    `Período: ${mesLabel}/${cab.ano}`,
    `Emissão: ${emissao}`,
    cab.emitidoPor ? `Emitido por: ${cab.emitidoPor}` : null
  ].filter(Boolean);
  doc.text(infoParts.join("  •  "), margin, y);
  y += 5;

  // ===== Tabela Principal — Formato Horizontal =====
  const headDias = Array.from({ length: totalDias }, (_, i) => {
    const d = i + 1;
    const dow = diaSemana(cab.ano, cab.mes, d);
    return { 
      content: `${d}\n${DIAS_SEM_ABREV[dow]}`, 
      styles: { halign: "center" as const, fontStyle: "bold" as const, fontSize: 6.5 } 
    };
  });

  const head = [[
    { content: "Profissional", styles: { halign: "left" as const, fontStyle: "bold" as const } },
    ...headDias,
    ...(opts.incluirTotalHoras ? [{ content: "Total", styles: { halign: "center" as const, fontStyle: "bold" as const } }] : []),
    ...(opts.incluirADN ? [{ content: opts.adnLabel || "ADN", styles: { halign: "center" as const, fontStyle: "bold" as const, fillColor: [238, 242, 255] as [number, number, number] } }] : [])
  ]];

  const totalCols = 1 + totalDias + (opts.incluirTotalHoras ? 1 : 0) + (opts.incluirADN ? 1 : 0);

  // Agrupa profissionais por Unidade -> Setor -> Profissão
  const tree = new Map<string, Map<string, Map<string, MensalProfissional[]>>>();
  for (const p of profs) {
    const u = p.unidade || cab.instituicao.unidade || "Unidade não informada";
    const s = p.setor || "Setor não informado";
    const prof = p.profissao || "Outras Profissões";
    if (!tree.has(u)) tree.set(u, new Map());
    const unidadeMap = tree.get(u)!;
    if (!unidadeMap.has(s)) unidadeMap.set(s, new Map());
    const setorMap = unidadeMap.get(s)!;
    if (!setorMap.has(prof)) setorMap.set(prof, []);
    setorMap.get(prof)!.push(p);
  }

  const body: any[] = [];
  const profsInBody: (MensalProfissional | null)[] = []; // Para mapear row index -> profissional

  const sortedUnidades = Array.from(tree.keys()).sort();
  for (const u of sortedUnidades) {
    body.push([{ content: `UNIDADE: ${u.toUpperCase()}`, colSpan: totalCols, styles: { fillColor: [226, 232, 240], fontStyle: "bold", halign: "left" } }]);
    profsInBody.push(null);

    const unidadeMap = tree.get(u)!;
    const sortedSetores = Array.from(unidadeMap.keys()).sort();
    for (const s of sortedSetores) {
      body.push([{ content: `SETOR: ${s.toUpperCase()}`, colSpan: totalCols, styles: { fillColor: [241, 245, 249], fontStyle: "bold", halign: "left" } }]);
      profsInBody.push(null);

      const setorMap = unidadeMap.get(s)!;
      const sortedProfissoes = Array.from(setorMap.keys()).sort();
      for (const pName of sortedProfissoes) {
        body.push([{ content: pName.toUpperCase(), colSpan: totalCols, styles: { fillColor: [255, 255, 255], fontStyle: "bold", halign: "left", textColor: [100, 100, 100], fontSize: 6.5 } }]);
        profsInBody.push(null);

        const sortedList = setorMap.get(pName)!.sort((a, b) => a.nome.localeCompare(b.nome));
        for (const p of sortedList) {
          const conselhoText = p.conselho && p.conselho !== "Não inf." ? p.conselho : "Não informado";
          const nomeCol = {
            content: `${p.nome}\n${p.profissao || ""}\n${conselhoText}`,
            styles: { halign: "left" as const, fontSize: 6.5, cellPadding: 1 }
          };

          const diaCols = Array.from({ length: totalDias }, (_, i) => {
            const d = i + 1;
            const lista = p.porDia[d] || [];
            if (lista.length === 0) return "—";
            return lista.map((s) => s.sigla).join("/");
          });

          const total = opts.incluirTotalHoras ? `${p.totalHoras}h` : `${p.totalPlantoes}`;
          body.push([
            nomeCol, 
            ...diaCols, 
            ...(opts.incluirTotalHoras ? [{ content: total, styles: { halign: "center" as const, fontStyle: "bold" as const, fontSize: 8 } }] : []),
            ...(opts.incluirADN ? [{ content: p.elegivelADN ? `${p.totalADN?.toFixed(opts.adnDecimals ?? 1)}h` : "—", styles: { halign: "center" as const, fontStyle: "bold" as const, fontSize: 8, fillColor: [238, 242, 255] as [number, number, number] } }] : [])
          ]);
          profsInBody.push(p);
        }
      }
    }
  }

  // Cálculo de larguras
  const availW = pageW - (margin * 2);
  const nomeW = 45; // Espaço um pouco maior para nome + profissão + conselho
  const totalW = opts.incluirTotalHoras ? 12 : 0;
  const adnW = opts.incluirADN ? 12 : 0;
  const diaW = (availW - nomeW - totalW - adnW) / totalDias;

  // ===== Modo Fill Page: distribui a altura útil real entre as linhas profissionais =====
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const legendaParts = tipos.map(t => `${t.sigla}=${t.nome}${t.start && t.end ? ` (${t.start}-${t.end}h)` : ""}`);
  legendaParts.push("!=Pendente", "*=Cancelado");
  const legendaText = "Legenda: " + legendaParts.join("  |  ");
  const wrappedLegenda = doc.splitTextToSize(legendaText, availW);
  const legendaLineH = 3.2;
  const legendGap = 3;
  const legendHeight = Math.max(legendaLineH, wrappedLegenda.length * legendaLineH);

  const obsText = opts.incluirObservacoesRodape
    ? "OBSERVAÇÕES: Escala sujeita a alteração. Qualquer troca de plantão deve ser comunicada à coordenação."
    : "";
  const wrappedObs = obsText ? doc.splitTextToSize(obsText, availW) : [];
  const obsGap = wrappedObs.length ? 2 : 0;
  const obsHeight = wrappedObs.length * 3.2;

  const totalGap = 3;
  const totalHeight = 4;
  const footerHeight = 8; // altura real do texto institucional inferior + respiro
  const signatureHasMedia = hasSignatureMedia(opts.responsavel) || hasSignatureMedia(opts.responsavelTecnico);
  const signatureInfoHeight = opts.incluirAssinatura
    ? Math.max(
        measureResponsavelInfoHeight(opts.responsavel, opts),
        measureResponsavelInfoHeight(opts.responsavelTecnico, opts),
        8
      )
    : 0;
  const signatureMediaHeight = opts.incluirAssinatura ? (signatureHasMedia ? 24 : 0) : 0;
  const signatureGap = opts.incluirAssinatura ? 2 : 0;
  const signatureHeight = opts.incluirAssinatura ? signatureMediaHeight + 4 + signatureInfoHeight : 0;
  const bottomContentHeight = legendGap + legendHeight + obsGap + obsHeight + totalGap + totalHeight + signatureGap + signatureHeight;
  const availableTableHeight = Math.max(42, pageH - footerHeight - y - bottomContentHeight);

  // A altura principal deve vir de: rowHeight = availableTableHeight / totalProfessionals.
  // Cabeçalho e grupos ficam compactos; o restante é redistribuído exclusivamente nas linhas reais.
  const dataRows = profsInBody.filter(p => p !== null).length || 1;
  const groupRows = profsInBody.length - dataRows;
  const targetTableHeight = availableTableHeight * 0.95;
  const headRowH = Math.max(5, Math.min(8, targetTableHeight * 0.045));
  const groupRowH = Math.max(3.8, Math.min(6.5, targetTableHeight * 0.026));
  const reservedStructuralHeight = headRowH + groupRows * groupRowH;
  const dataRowH = Math.max(4.2, (targetTableHeight - reservedStructuralHeight) / dataRows);

  // Fonte e padding proporcionais à altura da linha
  const bodyFont = Math.max(6, Math.min(15, dataRowH * 0.5));
  const headFont = Math.max(6, Math.min(11, bodyFont * 0.95));
  const totalFont = Math.max(7, Math.min(15, bodyFont + 1));
  const cellPad = Math.max(0.6, Math.min(4.2, dataRowH * 0.15));
  const groupPad = Math.max(0.4, Math.min(2.2, groupRowH * 0.12));

  const columnStyles: Record<number, any> = { 0: { cellWidth: nomeW } };
  if (opts.incluirTotalHoras) columnStyles[totalDias + 1] = { cellWidth: totalW };
  if (opts.incluirADN) columnStyles[totalDias + (opts.incluirTotalHoras ? 2 : 1)] = { cellWidth: adnW };

  autoTable(doc, {
    head,
    body,
    startY: y,
    theme: "grid",
    margin: { left: margin, right: margin },
    tableWidth: availW,
    styles: {
      fontSize: bodyFont,
      cellPadding: cellPad,
      minCellHeight: dataRowH,
      valign: "middle",
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
      textColor: 0,
      overflow: "linebreak"
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: 0,
      fontStyle: "bold",
      fontSize: headFont,
      lineWidth: 0.2,
      minCellHeight: headRowH,
      cellPadding: Math.max(0.6, Math.min(2.5, headRowH * 0.12))
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250] // Zebra (linhas alternadas com fundo levemente cinza)
    },
    columnStyles,
    didParseCell: (data) => {
      const ci = data.column.index;
      if (data.section === "body") {
        const prof = profsInBody[data.row.index];
        const isGroupRow = !prof;
        data.cell.styles.minCellHeight = isGroupRow ? groupRowH : dataRowH;
        data.cell.styles.cellHeight = isGroupRow ? groupRowH : dataRowH;
        data.cell.styles.cellPadding = isGroupRow ? groupPad : cellPad;
        if (isGroupRow) {
          data.cell.styles.fontSize = Math.max(6, Math.min(9, groupRowH * 0.55));
          data.cell.styles.overflow = "linebreak";
        }
      }
      if (ci > 0 && ci <= totalDias) {
        data.cell.styles.cellWidth = diaW;
        data.cell.styles.halign = "center";
        data.cell.styles.overflow = "hidden";

        if (data.section === "body") {
          const sigla = String(data.cell.raw || "");
          if (sigla !== "—") {
            const rowIndex = data.row.index;
            const dia = ci;
            const prof = profsInBody[rowIndex];
            if (!prof) return; // É uma linha de cabeçalho de grupo
            const lista = prof.porDia[dia] || [];
            if (lista.length > 0) {
              const color = getCategoryColor(lista[0].tipo || "", lista[0].status || "");
              data.cell.styles.fillColor = color.bg;
              data.cell.styles.textColor = color.text;
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fontSize = bodyFont;
            }
          }
        }
      }
      // Aumenta fonte das colunas Total/ADN
      if (data.section === "body" && (ci === totalDias + 1 || (opts.incluirADN && ci === totalDias + 2))) {
        data.cell.styles.fontSize = totalFont;
      }
      // Coluna nome: levemente maior
      if (data.section === "body" && ci === 0) {
        data.cell.styles.fontSize = Math.max(6, bodyFont * 0.92);
        data.cell.styles.overflow = "linebreak";
      }
    }
  });

  let finalY = (doc as any).lastAutoTable?.finalY || (y + 20);

  // ===== Legenda dinâmica =====
  doc.setFontSize(7);
  doc.setTextColor(80);
  finalY += legendGap;
  doc.text(wrappedLegenda, margin, finalY);
  finalY += legendHeight;

  if (wrappedObs.length) {
    finalY += obsGap;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(80);
    doc.text(wrappedObs, margin, finalY);
    finalY += obsHeight;
  }

  // ===== Totais =====
  finalY += totalGap;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0);
  const totalPlantoes = profs.reduce((acc, p) => acc + p.totalPlantoes, 0);
  const totalHorasGeral = profs.reduce((acc, p) => acc + p.totalHoras, 0);
  const resumoTxt = opts.incluirTotalHoras 
    ? `Total de plantões: ${totalPlantoes}    Total de horas: ${totalHorasGeral}h`
    : `Total de plantões: ${totalPlantoes}`;
  doc.text(resumoTxt, margin, finalY);
  finalY += totalHeight;

  // ===== Rodapé — Carimbo e Assinatura =====
  if (opts.incluirAssinatura) {
    const r1 = opts.responsavel;
    const r2 = opts.responsavelTecnico;
    const assY = finalY + signatureGap + signatureMediaHeight;
    const lineLen = 70;
    const gap = (availW - (lineLen * 2)) / 3;

    // Bloco Esquerdo — Responsável 1
    const xL = margin + gap + lineLen / 2;
    const startXL = margin + gap;
    
    // Assinatura Visual (Esquerda)
    if (r1?.assinaturaBase64 && r1.assinaturaBase64.length > 100) {
      try {
        const format = r1.assinaturaBase64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(r1.assinaturaBase64, format, startXL, assY - 18, 40, 16, undefined, 'FAST');
      } catch (e) { console.error("PDF R1 Assinatura Erro:", e); }
    }
    // Carimbo (Esquerda)
    if (r1?.carimboBase64 && r1.carimboBase64.length > 100) {
      try {
        const format = r1.carimboBase64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        const stampX = (r1.assinaturaBase64 && r1.assinaturaBase64.length > 100) ? startXL + 30 : startXL + 15;
        doc.addImage(r1.carimboBase64, format, stampX, assY - 22, 30, 20, undefined, 'FAST');
      } catch (e) { console.error("PDF R1 Carimbo Erro:", e); }
    }

    // Selo Digital (Esquerda) se não houver assinatura visual
    if (!r1?.assinaturaBase64 && (r1?.hasDigitalSeal || r1?.tipo === 'digital_gerado' || r1?.tipo === 'eletronica_interna')) {
      doc.setTextColor(30, 58, 138); 
      doc.setFont("courier", "bold");
      doc.setFontSize(8);
      doc.setDrawColor(30, 58, 138);
      doc.rect(startXL + 10, assY - 12, 50, 8);
      doc.text("ASSINADO DIGITALMENTE", xL, assY - 7, { align: "center" });
      doc.setTextColor(0);
      doc.setDrawColor(0);
      doc.setFont("helvetica", "normal");
    }

    doc.setLineWidth(0.3);
    doc.line(startXL, assY, startXL + lineLen, assY);
    renderResponsavelInfo(doc, r1, xL, assY + 4, opts);


    // Bloco Direito — Responsável 2
    const startXR = pageW - margin - gap - lineLen;
    const xR = startXR + lineLen / 2;
    
    // Assinatura Visual (Direita)
    if (r2?.assinaturaBase64 && r2.assinaturaBase64.length > 100) {
      try {
        const format = r2.assinaturaBase64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(r2.assinaturaBase64, format, startXR, assY - 18, 40, 16, undefined, 'FAST');
      } catch (e) { console.error("PDF R2 Assinatura Erro:", e); }
    }
    // Carimbo (Direita)
    if (r2?.carimboBase64 && r2.carimboBase64.length > 100) {
      try {
        const format = r2.carimboBase64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        const stampX = (r2.assinaturaBase64 && r2.assinaturaBase64.length > 100) ? startXR + 30 : startXR + 15;
        doc.addImage(r2.carimboBase64, format, stampX, assY - 22, 30, 20, undefined, 'FAST');
      } catch (e) { console.error("PDF R2 Carimbo Erro:", e); }
    }

    // Selo Digital (Direita)
    if (!r2?.assinaturaBase64 && (r2?.hasDigitalSeal || r2?.tipo === 'digital_gerado' || r2?.tipo === 'eletronica_interna')) {
      doc.setTextColor(30, 58, 138);
      doc.setFont("courier", "bold");
      doc.setFontSize(8);
      doc.setDrawColor(30, 58, 138);
      doc.rect(startXR + 10, assY - 12, 50, 8);
      doc.text("ASSINADO DIGITALMENTE", xR, assY - 7, { align: "center" });
      doc.setTextColor(0);
      doc.setDrawColor(0);
      doc.setFont("helvetica", "normal");
    }

    doc.setLineWidth(0.3);
    doc.line(startXR, assY, startXR + lineLen, assY);
    renderResponsavelInfo(doc, r2, xR, assY + 4, opts);

  }

  // ===== Rodapé Inferior =====
  doc.setFontSize(7);
  doc.setTextColor(150);
  const footerText = `Documento emitido pelo ${cab.sistema || "GestorPlantão SMS Oriximiná"} • ${emissao}`;
  doc.text(footerText, pageW / 2, pageH - 5, { align: "center" });

  if (modo === "save") {
    doc.save(`${filename}.pdf`);
  } else {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }
}
