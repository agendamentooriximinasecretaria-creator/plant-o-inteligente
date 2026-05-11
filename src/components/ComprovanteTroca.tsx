import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Printer, Download, ShieldCheck } from "lucide-react";
import jsPDF from "jspdf";
import { LOGO_SMS_PATH, getLogoSmsDataUrl } from "@/lib/logoSMS";
import SignDocumentDialog from "@/components/SignDocumentDialog";
import { listSignatures, type SignatureRecord } from "@/lib/eSignature";

interface Props {
  trocaId: string;
  onClose?: () => void;
}

export default function ComprovanteTroca({ trocaId, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [signOpen, setSignOpen] = useState(false);
  const [signatures, setSignatures] = useState<SignatureRecord[]>([]);

  const refreshSigs = () => listSignatures('troca', trocaId).then(setSignatures).catch(() => {});
  useEffect(() => { refreshSigs(); }, [trocaId]);

  const { data, isLoading } = useQuery({
    queryKey: ["comprovante-troca", trocaId],
    queryFn: async () => {
      const { data: troca, error } = await supabase
        .from("shift_swaps")
        .select("*, solicitante:solicitante_id(nome, profissao, registro, conselho), destinatario:destinatario_id(nome, profissao, registro, conselho)")
        .eq("id", trocaId)
        .single();
      if (error) throw error;

      const { data: shiftOrigem } = await supabase
        .from("shifts")
        .select("*, sectors:setor_id(nome), units:unidade_id(nome)")
        .eq("id", troca.shift_id)
        .single();

      let shiftDestino = null;
      if (troca.shift_id_destino) {
        const { data: sd } = await supabase
          .from("shifts")
          .select("*, sectors:setor_id(nome), units:unidade_id(nome)")
          .eq("id", troca.shift_id_destino)
          .single();
        shiftDestino = sd;
      }

      const { data: historico } = await supabase
        .from("swap_history")
        .select("*")
        .eq("swap_id", trocaId)
        .order("created_at", { ascending: true });

      return { troca, shiftOrigem, shiftDestino, historico: historico || [] };
    },
  });

  const PROFISSAO_LABELS: Record<string, string> = {
    medico: "Médico(a)", enfermeiro: "Enfermeiro(a)", fisioterapeuta: "Fisioterapeuta",
    tecnico_enfermagem: "Téc. Enfermagem", biomedico: "Biomédico(a)", psicologo: "Psicólogo(a)",
    terapeuta_ocupacional: "Terapeuta Ocupacional", nutricionista: "Nutricionista",
    fonoaudiologo: "Fonoaudiólogo(a)", farmaceutico: "Farmacêutico(a)", outro: "Outro",
  };

  const fmtDate = (d: string | null) => d ? new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR") : "—";
  const fmtDateTime = (d: string | null) => d ? new Date(d).toLocaleString("pt-BR") : "—";

  const seqNumber = () => {
    const year = new Date().getFullYear();
    const short = trocaId.slice(0, 4).toUpperCase();
    return `TRO-${year}-${short}`;
  };

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    if (!data) return;
    const { troca, shiftOrigem, shiftDestino, historico } = data;
    const doc = new jsPDF("p", "mm", "a4");
    const w = doc.internal.pageSize.getWidth();
    let y = 15;

    // Logo redonda centralizada
    const logo = await getLogoSmsDataUrl();
    if (logo) {
      const size = 18;
      const cx = w / 2;
      try {
        doc.setFillColor(255, 255, 255);
        doc.circle(cx, y + size / 2, size / 2 + 0.4, "F");
        doc.addImage(logo, "JPEG", cx - size / 2, y, size, size);
        doc.setDrawColor(14, 116, 144);
        doc.setLineWidth(0.4);
        doc.circle(cx, y + size / 2, size / 2, "S");
      } catch { /* noop */ }
      y += size + 4;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("COMPROVANTE DE TROCA DE PLANTÃO", w / 2, y, { align: "center" });
    y += 8;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("HOSPITAL MUNICIPAL DE ORIXIMINÁ — CNPJ: 05.131.081/0001-82", w / 2, y, { align: "center" });
    y += 5;
    doc.text("Rua Barão do Rio Branco, nº 3288, Bairro Santa Terezinha, CEP 68270-000 — Oriximiná/PA", w / 2, y, { align: "center" });
    y += 8;

    doc.setDrawColor(180);
    doc.line(15, y, w - 15, y);
    y += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Comprovante Nº: ${seqNumber()}`, 15, y);
    doc.text(`Data: ${fmtDate(troca.created_at?.split("T")[0])}`, w - 15, y, { align: "right" });
    y += 8;

    doc.text("DADOS DA TROCA", 15, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`Tipo: ${troca.tipo === "administrativa" ? "Administrativa" : "Voluntária"}`, 15, y); y += 5;
    doc.text(`Status: ${troca.status.toUpperCase()}`, 15, y); y += 5;
    if (troca.aprovado_em) { doc.text(`Aprovado em: ${fmtDateTime(troca.aprovado_em)}`, 15, y); y += 5; }
    if (troca.motivo || troca.motivo_administrativo) { doc.text(`Motivo: ${troca.motivo_administrativo || troca.motivo}`, 15, y); y += 5; }
    y += 3;

    doc.line(15, y, w - 15, y); y += 6;
    const solName = (troca.solicitante as any)?.nome || "—";
    const destName = (troca.destinatario as any)?.nome || "—";

    doc.setFont("helvetica", "bold");
    doc.text("PROFISSIONAL A", 15, y);
    doc.text("PROFISSIONAL B", w / 2 + 5, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text(solName, 15, y);
    doc.text(destName, w / 2 + 5, y);
    y += 5;
    doc.text(`${PROFISSAO_LABELS[(troca.solicitante as any)?.profissao] || ""} — ${(troca.solicitante as any)?.registro || ""}`, 15, y);
    doc.text(`${PROFISSAO_LABELS[(troca.destinatario as any)?.profissao] || ""} — ${(troca.destinatario as any)?.registro || ""}`, w / 2 + 5, y);
    y += 8;

    if (shiftOrigem) {
      doc.setFont("helvetica", "bold");
      doc.text("PLANTÃO ORIGINAL", 15, y);
      if (shiftDestino) doc.text("PLANTÃO DESTINO", w / 2 + 5, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.text(`Data: ${fmtDate(shiftOrigem.data)}`, 15, y);
      if (shiftDestino) doc.text(`Data: ${fmtDate(shiftDestino.data)}`, w / 2 + 5, y);
      y += 5;
      doc.text(`Horário: ${shiftOrigem.hora_inicio} – ${shiftOrigem.hora_fim}`, 15, y);
      if (shiftDestino) doc.text(`Horário: ${shiftDestino.hora_inicio} – ${shiftDestino.hora_fim}`, w / 2 + 5, y);
      y += 5;
      doc.text(`Setor: ${(shiftOrigem.sectors as any)?.nome || ""}`, 15, y);
      if (shiftDestino) doc.text(`Setor: ${(shiftDestino.sectors as any)?.nome || ""}`, w / 2 + 5, y);
      y += 5;
      doc.text(`Unidade: ${(shiftOrigem.units as any)?.nome || ""}`, 15, y);
      if (shiftDestino) doc.text(`Unidade: ${(shiftDestino.units as any)?.nome || ""}`, w / 2 + 5, y);
      y += 8;
    }

    doc.line(15, y, w - 15, y); y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("HISTÓRICO", 15, y); y += 5;
    doc.setFont("helvetica", "normal");
    for (const h of historico) {
      doc.text(`● ${fmtDateTime(h.created_at)} — ${h.acao} (${h.usuario})`, 15, y);
      y += 5;
      if (y > 260) { doc.addPage(); y = 15; }
    }

    // Carimbos e Assinaturas
    y += 10;
    if (y > 240) { doc.addPage(); y = 20; }
    
    // Adicionar blocos de assinatura eletrônica ao PDF
    for (const s of signatures.filter(sig => sig.status === 'ativa')) {
      doc.setDrawColor(180);
      doc.rect(15, y, w - 30, 25);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(`Assinado eletronicamente por ${s.signer_name}`, 20, y + 8);
      doc.setFont("helvetica", "normal");
      doc.text(`${s.signer_role.replace("_", " ")} em ${new Date(s.signed_at).toLocaleString("pt-BR")}`, 20, y + 13);
      doc.text(`Código: ${s.validation_code} | Hash: ${s.content_hash.slice(0, 20)}...`, 20, y + 18);
      
      try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/validar/${s.validation_code}`)}`;
        // Nota: addImage com URL externa pode precisar ser pré-carregada ou convertida para dataURL
        // Para simplificar, deixamos o espaço ou usamos um marcador visual se necessário.
      } catch { /* noop */ }
      
      y += 30;
      if (y > 270) { doc.addPage(); y = 20; }
    }

    y = doc.internal.pageSize.getHeight() - 20;
    doc.setFontSize(7);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")} | Usuário: ${user?.email || ""} | ID: ${trocaId}`, 15, y);
    y += 4;
    doc.text("GestorPlantão SMS Oriximiná — gestorplantaosmsoriximina.lovable.app", 15, y);

    doc.save(`Comprovante-Troca-${seqNumber()}.pdf`);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!data) return <p className="text-muted-foreground text-center p-8">Troca não encontrada.</p>;

  const { troca, shiftOrigem, shiftDestino, historico } = data;
  const solicitante = troca.solicitante as any;
  const destinatario = troca.destinatario as any;

  return (
    <div className="space-y-4">
      {/* Action bar — won't print */}
      <div className="flex gap-2 print:hidden">
        <button onClick={handlePrint} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          <Printer className="h-4 w-4" /> Imprimir
        </button>
        <button onClick={handleDownloadPDF} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
          <Download className="h-4 w-4" /> Baixar PDF
        </button>
        <button onClick={() => setSignOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-primary text-primary px-4 py-2 text-sm font-medium hover:bg-primary/10">
          <ShieldCheck className="h-4 w-4" /> Assinar eletronicamente
        </button>
        {onClose && (
          <button onClick={onClose} className="ml-auto inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Fechar
          </button>
        )}
      </div>

      {/* Printable area */}
      <div ref={printRef} className="bg-card border border-border rounded-lg p-6 print:border-2 print:border-black print:shadow-none print:rounded-none">
        {/* Header */}
        <div className="flex flex-col items-center text-center border-b border-border pb-4 mb-4">
          <img
            src={LOGO_SMS_PATH}
            alt="SMS Oriximiná"
            className="h-16 w-16 rounded-full object-cover border border-border bg-background mb-2"
          />
          <h2 className="text-lg font-bold text-primary">GestorPlantão · SMS Oriximiná</h2>
          <h3 className="text-base font-bold text-foreground mt-1">COMPROVANTE DE TROCA DE PLANTÃO</h3>
        </div>

        {/* Hospital */}
        <div className="text-center border-b border-border pb-3 mb-4">
          <p className="text-sm font-semibold text-foreground">HOSPITAL MUNICIPAL DE ORIXIMINÁ</p>
          <p className="text-xs text-muted-foreground">CNPJ: 05.131.081/0001-82</p>
          <p className="text-xs text-muted-foreground">Rua Barão do Rio Branco, nº 3288, Bairro Santa Terezinha, CEP 68270-000 — Oriximiná/PA</p>
        </div>

        {/* Number + date */}
        <div className="flex justify-between border-b border-border pb-3 mb-4 text-sm">
          <span className="font-semibold text-foreground">Comprovante Nº: {seqNumber()}</span>
          <span className="text-muted-foreground">Data: {fmtDate(troca.created_at?.split("T")[0])}</span>
        </div>

        {/* Swap details */}
        <div className="border-b border-border pb-4 mb-4">
          <h4 className="text-sm font-bold text-foreground mb-2">DADOS DA TROCA</h4>
          <div className="grid grid-cols-2 gap-1 text-sm">
            <p><span className="text-muted-foreground">Tipo:</span> <span className="text-foreground">{troca.tipo === "administrativa" ? "Administrativa" : "Voluntária"}</span></p>
            <p><span className="text-muted-foreground">Status:</span> <span className="text-foreground font-medium">✅ {troca.status.toUpperCase()}</span></p>
            {troca.aprovado_em && <p><span className="text-muted-foreground">Aprovado em:</span> <span className="text-foreground">{fmtDateTime(troca.aprovado_em)}</span></p>}
          </div>
          {(troca.motivo || troca.motivo_administrativo) && (
            <p className="text-sm mt-2"><span className="text-muted-foreground">Motivo:</span> <span className="text-foreground">{troca.motivo_administrativo || troca.motivo}</span></p>
          )}
        </div>

        {/* Professionals + shifts */}
        <div className="grid grid-cols-2 gap-4 border-b border-border pb-4 mb-4">
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">PROFISSIONAL A</h4>
            <p className="text-sm font-semibold text-foreground">{solicitante?.nome || "—"}</p>
            <p className="text-xs text-muted-foreground">{PROFISSAO_LABELS[solicitante?.profissao] || ""} — {solicitante?.registro || ""}</p>
            {shiftOrigem && (
              <div className="mt-2 p-2 bg-muted rounded text-xs space-y-0.5">
                <p className="font-semibold text-foreground">PLANTÃO ORIGINAL</p>
                <p className="text-foreground">📅 {fmtDate(shiftOrigem.data)}</p>
                <p className="text-foreground">⏰ {shiftOrigem.hora_inicio} – {shiftOrigem.hora_fim}</p>
                <p className="text-foreground">🏥 {(shiftOrigem.sectors as any)?.nome} — {(shiftOrigem.units as any)?.nome}</p>
              </div>
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">PROFISSIONAL B</h4>
            <p className="text-sm font-semibold text-foreground">{destinatario?.nome || "—"}</p>
            <p className="text-xs text-muted-foreground">{PROFISSAO_LABELS[destinatario?.profissao] || ""} — {destinatario?.registro || ""}</p>
            {(shiftDestino || shiftOrigem) && (
              <div className="mt-2 p-2 bg-muted rounded text-xs space-y-0.5">
                <p className="font-semibold text-foreground">PLANTÃO {shiftDestino ? "DESTINO" : "ASSUMIDO"}</p>
                <p className="text-foreground">📅 {fmtDate((shiftDestino || shiftOrigem)?.data)}</p>
                <p className="text-foreground">⏰ {(shiftDestino || shiftOrigem)?.hora_inicio} – {(shiftDestino || shiftOrigem)?.hora_fim}</p>
                <p className="text-foreground">🏥 {((shiftDestino || shiftOrigem)?.sectors as any)?.nome} — {((shiftDestino || shiftOrigem)?.units as any)?.nome}</p>
              </div>
            )}
          </div>
        </div>

        {/* History */}
        <div className="border-b border-border pb-4 mb-4">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">HISTÓRICO DA TROCA</h4>
          <div className="space-y-1.5">
            {historico.map((h: any) => (
              <div key={h.id} className="flex items-start gap-2 text-xs">
                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span className="text-foreground">{fmtDateTime(h.created_at)} — {h.acao} <span className="text-muted-foreground">por {h.usuario}</span></span>
              </div>
            ))}
          </div>
        </div>

        {/* Signature lines */}
        <div className="grid grid-cols-3 gap-6 mt-8 mb-6">
          {[solicitante?.nome || "Profissional A", destinatario?.nome || "Profissional B", "Gestor Responsável"].map((name, i) => (
            <div key={i} className="text-center">
              <div className="border-t border-foreground/30 pt-2 mt-8">
                <p className="text-xs font-medium text-foreground">{name}</p>
                <p className="text-[10px] text-muted-foreground">{i < 2 ? (i === 0 ? "Profissional A" : "Profissional B") : "Gestor Responsável"}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Assinaturas eletrônicas */}
        {signatures.length > 0 && (
          <div className="mt-4 space-y-2">
            {signatures.filter(s => s.status === 'ativa').map(s => (
              <div key={s.id} className="rounded-md border border-border p-3 text-[11px] flex gap-3 items-center bg-muted/20">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(`${window.location.origin}/validar/${s.validation_code}`)}`}
                  alt="QR" className="h-16 w-16" />
                <div className="leading-relaxed">
                  <div><strong>Documento assinado eletronicamente</strong> por <strong>{s.signer_name}</strong>, {s.signer_role.replace('_', ' ')}, em {new Date(s.signed_at).toLocaleString('pt-BR')}.</div>
                  <div>Código: <strong className="font-mono">{s.validation_code}</strong> · Verifique em /validar/{s.validation_code}</div>
                  <div className="text-muted-foreground italic text-[10px]">Assinatura eletrônica interna — não substitui ICP-Brasil.</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border pt-3 text-center text-[10px] text-muted-foreground space-y-0.5 mt-4">
          <p>Gerado em: {new Date().toLocaleString("pt-BR")} | Usuário: {user?.email || ""}</p>
          <p>ID do Registro: {trocaId}</p>
          <p>GestorPlantão SMS Oriximiná — gestorplantaosmsoriximina.lovable.app</p>
          <p className="italic mt-1">Este documento é válido como comprovante de troca de plantão conforme registrado no sistema.</p>
        </div>
      </div>

      <SignDocumentDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        document={{
          document_type: 'troca',
          document_id: trocaId,
          document_title: `Comprovante de troca ${seqNumber()}`,
          content: JSON.stringify({ trocaId, troca: data?.troca, shiftOrigem: data?.shiftOrigem, shiftDestino: data?.shiftDestino }),
        }}
        onSigned={() => {
          refreshSigs();
          // Registrar no histórico quando assinado
          supabase.from('swap_history').insert({
            swap_id: trocaId,
            acao: 'Documento assinado eletronicamente',
            usuario: user?.email || 'Usuário',
            user_id: user?.id
          }).then(() => {});
        }}
      />
    </div>
  );
}
