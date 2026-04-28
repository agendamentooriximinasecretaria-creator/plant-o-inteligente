import {
  GeneratedDocumentType,
  criarDocumentoVersionado,
} from "@/lib/documentVersioning";

/**
 * Registra um documento gerado de forma assíncrona e silenciosa.
 * Não interrompe o fluxo de impressão se houver erro de rede.
 */
export function registrarDocumentoGerado(params: {
  tipo: GeneratedDocumentType;
  titulo: string;
  conteudoHtml: string;
  dadosGeracao?: Record<string, any>;
  modeloId?: string | null;
  modeloNome?: string | null;
  unidadeId?: string | null;
  setorId?: string | null;
  profissionalId?: string | null;
}): Promise<string | null> {
  return criarDocumentoVersionado(params)
    .then((doc) => doc.codigo_validacao)
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[registrarDocumentoGerado] falha silenciosa:", err?.message ?? err);
      return null;
    });
}
