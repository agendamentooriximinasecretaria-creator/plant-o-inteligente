import { toast } from 'sonner';

export const formatarTelefoneWhatsApp = (telefone: string): string => {
  const apenasNumeros = telefone.replace(/\D/g, '');

  if (apenasNumeros.startsWith('55') && apenasNumeros.length >= 12) {
    return apenasNumeros;
  }

  if (apenasNumeros.length === 11 || apenasNumeros.length === 10) {
    return `55${apenasNumeros}`;
  }

  return `55${apenasNumeros}`;
};

export const validarTelefone = (tel: string): boolean => {
  const numeros = tel.replace(/\D/g, '');
  return numeros.length >= 10 && numeros.length <= 13;
};

export const abrirWhatsApp = (
  telefone: string,
  nomeProfissional: string,
  contexto?: {
    tipo: 'plantao' | 'troca' | 'urgencia' | 'lembrete' | 'geral';
    data?: string;
    horario?: string;
    setor?: string;
    unidade?: string;
  }
) => {
  if (!telefone || telefone.trim() === '') {
    toast.warning(`${nomeProfissional.split(' ')[0]} não tem telefone cadastrado`);
    return;
  }

  if (!validarTelefone(telefone)) {
    toast.warning(`Telefone de ${nomeProfissional.split(' ')[0]} é inválido`);
    return;
  }

  const numero = formatarTelefoneWhatsApp(telefone);
  const primeiroNome = nomeProfissional.split(' ')[0];

  let mensagem = '';

  switch (contexto?.tipo) {
    case 'plantao':
      mensagem = `Olá ${primeiroNome}! Aqui é da gestão do GestorPlantão SMS Oriximiná. Estamos entrando em contato sobre seu plantão${contexto.setor ? ` em ${contexto.setor}` : ''}${contexto.data ? ` no dia ${contexto.data}` : ''}${contexto.horario ? ` às ${contexto.horario}` : ''}. Qualquer dúvida, estamos à disposição.`;
      break;
    case 'troca':
      mensagem = `Olá ${primeiroNome}! Aqui é da gestão do GestorPlantão SMS Oriximiná. Há uma solicitação de troca de plantão aguardando sua resposta. Acesse: gestorplantaosmsorimina.lovable.app`;
      break;
    case 'urgencia':
      mensagem = `⚠️ Urgência — ${primeiroNome}, precisamos de cobertura${contexto.setor ? ` em ${contexto.setor}` : ''}. Por favor, retorne o contato o mais rápido possível. GestorPlantão SMS Oriximiná.`;
      break;
    case 'lembrete':
      mensagem = `⏰ Lembrete — Olá ${primeiroNome}! Seu plantão é amanhã${contexto.data ? ` (${contexto.data})` : ''}${contexto.horario ? ` das ${contexto.horario}` : ''}${contexto.setor ? ` em ${contexto.setor}` : ''}. Qualquer imprevisto, avise com antecedência. GestorPlantão SMS Oriximiná.`;
      break;
    default:
      mensagem = `Olá ${primeiroNome}! Aqui é da gestão do GestorPlantão SMS Oriximiná. Precisamos falar com você sobre sua escala de plantões.`;
  }

  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;

  const novaAba = window.open(url, '_blank', 'noopener,noreferrer');

  if (!novaAba || novaAba.closed) {
    window.location.href = url;
  }
};

export const abrirLigacao = (telefone: string, nomeProfissional: string) => {
  if (!telefone || telefone.trim() === '') {
    toast.warning(`${nomeProfissional.split(' ')[0]} não tem telefone cadastrado`);
    return;
  }
  const numero = formatarTelefoneWhatsApp(telefone);
  window.location.href = `tel:+${numero}`;
};
