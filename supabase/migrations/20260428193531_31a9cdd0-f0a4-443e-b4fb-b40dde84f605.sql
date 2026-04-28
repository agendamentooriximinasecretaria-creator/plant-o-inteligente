
-- Expansão da tabela professional_stamps para o novo modelo unificado
ALTER TABLE public.professional_stamps
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'digital_gerado',
  ADD COLUMN IF NOT EXISTS especialidade TEXT,
  ADD COLUMN IF NOT EXISTS uf_conselho TEXT,
  ADD COLUMN IF NOT EXISTS cidade_uf TEXT,
  ADD COLUMN IF NOT EXISTS estilo TEXT NOT NULL DEFAULT 'completo',
  ADD COLUMN IF NOT EXISTS largura INTEGER NOT NULL DEFAULT 320,
  ADD COLUMN IF NOT EXISTS altura_max INTEGER NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS espacamento_top INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS espacamento_bottom INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS alinhamento_texto TEXT NOT NULL DEFAULT 'centro',
  ADD COLUMN IF NOT EXISTS tamanho_fonte INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS mostrar_linha_assinatura BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mostrar_profissao BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mostrar_especialidade BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mostrar_uf_conselho BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mostrar_setor BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mostrar_cidade_uf BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mostrar_data_local BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mostrar_codigo_validacao BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mostrar_hash BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mostrar_qr_code BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contextos_uso TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

-- Substituir constraint antigo de posição para incluir as novas opções
ALTER TABLE public.professional_stamps
  DROP CONSTRAINT IF EXISTS professional_stamps_assinatura_posicao_check;

ALTER TABLE public.professional_stamps
  ADD CONSTRAINT professional_stamps_assinatura_posicao_check
  CHECK (assinatura_posicao IN (
    'esquerda','centro','direita',
    'rodape_esquerdo','rodape_centro','rodape_direito',
    'final_documento','personalizado'
  ));

-- Constraints de domínio para os novos campos
ALTER TABLE public.professional_stamps
  ADD CONSTRAINT professional_stamps_tipo_check
  CHECK (tipo IN ('digital_gerado','imagem_carimbo','assinatura_manuscrita','eletronica_interna'));

ALTER TABLE public.professional_stamps
  ADD CONSTRAINT professional_stamps_estilo_check
  CHECK (estilo IN ('compacto','completo','oficial'));

ALTER TABLE public.professional_stamps
  ADD CONSTRAINT professional_stamps_alinhamento_check
  CHECK (alinhamento_texto IN ('esquerda','centro','direita','justificado'));
