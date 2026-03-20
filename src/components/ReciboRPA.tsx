import { useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Printer, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PROFISSAO_LABELS: Record<string, string> = {
  medico: 'Médico(a)', enfermeiro: 'Enfermeiro(a)', fisioterapeuta: 'Fisioterapeuta',
  tecnico_enfermagem: 'Téc. Enfermagem', biomedico: 'Biomédico(a)', psicologo: 'Psicólogo(a)',
  terapeuta_ocupacional: 'Terapeuta Ocupacional', nutricionista: 'Nutricionista',
  fonoaudiologo: 'Fonoaudiólogo(a)', farmaceutico: 'Farmacêutico(a)', outro: 'Outro',
};

interface Props {
  profissionalId: string;
  periodoInicio: string;
  periodoFim: string;
  onClose?: () => void;
}

export default function ReciboRPA({ profissionalId, periodoInicio, periodoFim, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["rpa", profissionalId, periodoInicio, periodoFim],
    queryFn: async () => {
      const [profRes, shiftsRes] = await Promise.all([
        supabase.from("professionals").select("*, sectors:setor_principal_id(nome)").eq("id", profissionalId).single(),
        supabase.from("shifts").select("*, sectors:setor_id(nome)").eq("profissional_id", profissionalId)
          .gte("data", periodoInicio).lte("data", periodoFim).neq("status", "cancelado").order("data"),
      ]);
      return { prof: profRes.data, plantoes: shiftsRes.data || [] };
    },
  });

  const calc = useMemo(() => {
    if (!data) return null;
    const totalHoras = data.plantoes.reduce((a: number, p: any) => a + Number(p.carga_horaria), 0);
    const valorBruto = data.plantoes.reduce((a: number, p: any) => a + Number(p.valor_total), 0);
    const iss = Math.round(valorBruto * 0.05 * 100) / 100;
    const inss = Math.round(valorBruto * 0.11 * 100) / 100;
    const valorLiquido = Math.round((valorBruto - iss - inss) * 100) / 100;
    return { totalHoras, valorBruto, iss, inss, valorLiquido };
  }, [data]);

  const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR");
  const fmtMoney = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const mesAno = () => {
    const d = new Date(`${periodoInicio}T12:00:00`);
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };

  const handlePrint = () => window.print();

  const handlePDF = () => {
    if (!data || !calc) return;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const w = doc.internal.pageSize.getWidth();

    doc.setFontSize(14);
    doc.text("RECIBO DE PAGAMENTO AUTÔNOMO (RPA)", w / 2, 20, { align: "center" });

    doc.setFontSize(9);
    doc.text("HOSPITAL MUNICIPAL DE ORIXIMINÁ", w / 2, 30, { align: "center" });
    doc.text("CNPJ: 05.131.081/0001-82", w / 2, 35, { align: "center" });
    doc.text("Rua Barão do Rio Branco, nº 3288, Oriximiná/PA", w / 2, 40, { align: "center" });

    doc.setFontSize(10);
    doc.text(`PRESTADOR: ${data.prof?.nome}`, 15, 52);
    doc.text(`CPF: ${data.prof?.cpf || "Não informado"}  |  ${data.prof?.documento_conselho || data.prof?.conselho || ""}: ${data.prof?.documento_numero || data.prof?.registro || ""}`, 15, 58);
    doc.text(`Profissão: ${PROFISSAO_LABELS[data.prof?.profissao] || data.prof?.profissao}`, 15, 64);
    doc.text(`Período: ${fmtDate(periodoInicio)} a ${fmtDate(periodoFim)}`, 15, 70);

    autoTable(doc, {
      startY: 78,
      head: [["Data", "Setor", "Horas", "Valor"]],
      body: data.plantoes.map((p: any) => [
        fmtDate(p.data),
        (p.sectors as any)?.nome || "—",
        `${p.carga_horaria}h`,
        fmtMoney(Number(p.valor_total)),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 76, 129] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 130;
    doc.setFontSize(10);
    doc.text(`Valor Bruto: ${fmtMoney(calc.valorBruto)}`, 15, finalY + 10);
    doc.text(`(-) ISS 5%: ${fmtMoney(calc.iss)}`, 15, finalY + 16);
    doc.text(`(-) INSS 11%: ${fmtMoney(calc.inss)}`, 15, finalY + 22);
    doc.setFontSize(12);
    doc.text(`VALOR LÍQUIDO: ${fmtMoney(calc.valorLiquido)}`, 15, finalY + 32);

    doc.setFontSize(8);
    doc.text("Declaro ter recebido a importância acima referente aos serviços prestados.", 15, finalY + 45);
    doc.text(`Oriximiná/PA, ${new Date().toLocaleDateString("pt-BR")}`, 15, finalY + 55);
    doc.line(15, finalY + 70, 100, finalY + 70);
    doc.text(data.prof?.nome || "", 15, finalY + 75);
    doc.text(`CPF: ${data.prof?.cpf || ""}`, 15, finalY + 80);
    doc.text(`GestorPlantão SMS Oriximiná — ${mesAno()}`, w / 2, finalY + 95, { align: "center" });

    doc.save(`RPA-${data.prof?.nome?.replace(/\s+/g, "_")}-${periodoInicio}.pdf`);
  };

  if (isLoading) return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!data?.prof || !calc) return <p className="text-center text-muted-foreground py-8">Dados não encontrados.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 no-print">
        <button onClick={handlePrint} className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90">
          <Printer className="h-4 w-4" /> Imprimir
        </button>
        <button onClick={handlePDF} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
          <Download className="h-4 w-4" /> Baixar PDF
        </button>
        {onClose && <button onClick={onClose} className="ml-auto text-sm text-muted-foreground hover:text-foreground">Fechar</button>}
      </div>

      <div ref={printRef} className="bg-white text-black p-8 rounded-lg border max-w-[210mm] mx-auto text-sm print:shadow-none print:border-none">
        <h2 className="text-center text-base font-bold mb-1">RECIBO DE PAGAMENTO AUTÔNOMO (RPA)</h2>
        <div className="border-t border-b border-black py-2 text-center text-xs mb-4">
          <p className="font-bold">HOSPITAL MUNICIPAL DE ORIXIMINÁ</p>
          <p>CNPJ: 05.131.081/0001-82</p>
          <p>Rua Barão do Rio Branco, nº 3288, Santa Terezinha — Oriximiná/PA</p>
        </div>

        <div className="mb-4">
          <p className="font-bold text-xs mb-1">PRESTADOR DOS SERVIÇOS:</p>
          <p>Nome: <strong>{data.prof.nome}</strong></p>
          <p>CPF: {data.prof.cpf || "Não informado"}</p>
          <p>{data.prof.documento_conselho || data.prof.conselho || "Registro"}: {data.prof.documento_numero || data.prof.registro || "—"} — {PROFISSAO_LABELS[data.prof.profissao] || data.prof.profissao}</p>
          {data.prof.endereco && <p>Endereço: {data.prof.endereco}</p>}
        </div>

        <div className="mb-4">
          <p className="font-bold text-xs mb-1">DESCRIÇÃO DOS SERVIÇOS:</p>
          <p>Prestação de serviços — plantões</p>
          <p>Período: {fmtDate(periodoInicio)} a {fmtDate(periodoFim)}</p>
        </div>

        <table className="w-full border-collapse mb-4 text-xs">
          <thead>
            <tr className="bg-gray-100"><th className="border p-1.5 text-left">Data</th><th className="border p-1.5 text-left">Setor</th><th className="border p-1.5 text-right">Horas</th><th className="border p-1.5 text-right">Valor</th></tr>
          </thead>
          <tbody>
            {data.plantoes.map((p: any) => (
              <tr key={p.id}>
                <td className="border p-1.5">{fmtDate(p.data)}</td>
                <td className="border p-1.5">{(p.sectors as any)?.nome || "—"}</td>
                <td className="border p-1.5 text-right">{p.carga_horaria}h</td>
                <td className="border p-1.5 text-right">{fmtMoney(Number(p.valor_total))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-black pt-3 space-y-1 text-right">
          <p>Valor Bruto: <strong>{fmtMoney(calc.valorBruto)}</strong></p>
          <p>(-) ISS 5%: {fmtMoney(calc.iss)}</p>
          <p>(-) INSS 11%: {fmtMoney(calc.inss)}</p>
          <p className="text-base font-bold mt-2">VALOR LÍQUIDO: {fmtMoney(calc.valorLiquido)}</p>
        </div>

        <div className="mt-8 text-xs">
          <p>Declaro ter recebido a importância acima referente aos serviços prestados.</p>
          <p className="mt-4">Oriximiná/PA, {new Date().toLocaleDateString("pt-BR")}</p>
          <div className="mt-10 border-t border-black w-64 pt-1">
            <p className="font-bold">{data.prof.nome}</p>
            <p>CPF: {data.prof.cpf || ""}</p>
          </div>
        </div>

        <p className="mt-8 text-center text-[10px] text-gray-400">GestorPlantão SMS Oriximiná — {mesAno()}</p>
      </div>
    </div>
  );
}
