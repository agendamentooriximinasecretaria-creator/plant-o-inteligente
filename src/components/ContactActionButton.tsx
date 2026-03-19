import { Phone, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ContactActionButtonProps {
  profissional: {
    nome: string;
    telefone?: string | null;
  };
  contexto?: {
    tipo: "plantao" | "troca" | "urgencia" | "geral";
    data?: string;
    horario?: string;
    setor?: string;
    unidade?: string;
  };
  size?: "sm" | "md";
}

const formatarTelefone = (tel: string): string => {
  const numeros = tel.replace(/\D/g, "");
  if (numeros.startsWith("55")) return numeros;
  if (numeros.length >= 10 && numeros.length <= 11) return `55${numeros}`;
  return numeros;
};

const validarTelefone = (tel: string): boolean => {
  const numeros = tel.replace(/\D/g, "");
  return numeros.length >= 10 && numeros.length <= 13;
};

const gerarMensagem = (profissional: { nome: string }, contexto?: ContactActionButtonProps["contexto"]): string => {
  const nome = profissional.nome.split(" ")[0];
  const tipo = contexto?.tipo || "geral";

  const mensagens: Record<string, string> = {
    plantao: `Olá ${nome}! Aqui é da gestão do GestorPlantão SMS Oriximiná. Estamos entrando em contato sobre seu plantão em ${contexto?.setor || "nossa unidade"} no dia ${contexto?.data || ""} às ${contexto?.horario || ""}. Qualquer dúvida, estamos à disposição.`,
    troca: `Olá ${nome}! Aqui é da gestão do GestorPlantão SMS Oriximiná. Há uma solicitação de troca de plantão aguardando sua resposta no sistema. Por favor, acesse: gestorplantaosmsorimina.lovable.app`,
    urgencia: `⚠️ Urgência — ${nome}, precisamos de cobertura em ${contexto?.setor || "nossa unidade"}. Por favor, entre em contato o mais rápido possível. GestorPlantão SMS Oriximiná.`,
    geral: `Olá ${nome}! Aqui é da gestão do GestorPlantão SMS Oriximiná. Precisamos falar com você sobre sua escala de plantões.`,
  };

  return encodeURIComponent(mensagens[tipo] || mensagens.geral);
};

export function ContactActionButton({ profissional, contexto, size = "sm" }: ContactActionButtonProps) {
  const temTelefone = profissional.telefone && validarTelefone(profissional.telefone);
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const btnPadding = size === "sm" ? "p-1" : "p-1.5";

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profissional.telefone || !validarTelefone(profissional.telefone)) {
      toast.warning(`${profissional.nome.split(" ")[0]} não tem telefone cadastrado`);
      return;
    }
    const numeroFormatado = formatarTelefone(profissional.telefone);
    const mensagem = gerarMensagem(profissional, contexto);

    // Abre WhatsApp Desktop instalado diretamente (não abre browser)
    window.location.href = `whatsapp://send?phone=${numeroFormatado}&text=${mensagem}`;
  };

  const handleLigacao = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profissional.telefone) {
      toast.warning("Telefone não cadastrado");
      return;
    }
    const numeroFormatado = formatarTelefone(profissional.telefone);
    window.location.href = `tel:+${numeroFormatado}`;
  };

  if (!temTelefone) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button disabled className={`${btnPadding} rounded opacity-40 cursor-not-allowed`}>
            <MessageCircle className={`${iconSize} text-muted-foreground`} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Cadastre o telefone</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="inline-flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={handleWhatsApp} className={`${btnPadding} rounded hover:bg-success/10 transition-colors`}>
            <MessageCircle className={`${iconSize} text-success`} />
          </button>
        </TooltipTrigger>
        <TooltipContent>WhatsApp</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={handleLigacao} className={`${btnPadding} rounded hover:bg-primary/10 transition-colors`}>
            <Phone className={`${iconSize} text-primary`} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Ligar</TooltipContent>
      </Tooltip>
    </div>
  );
}
