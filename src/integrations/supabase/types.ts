export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      acionamentos_reforco: {
        Row: {
          acionado_por: string | null
          created_at: string | null
          id: string
          justificativa_recusa: string | null
          motivo: string
          prioridade: string
          profissional_id: string
          resposta_em: string | null
          setor_destino_id: string | null
          setor_origem_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          acionado_por?: string | null
          created_at?: string | null
          id?: string
          justificativa_recusa?: string | null
          motivo: string
          prioridade?: string
          profissional_id: string
          resposta_em?: string | null
          setor_destino_id?: string | null
          setor_origem_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          acionado_por?: string | null
          created_at?: string | null
          id?: string
          justificativa_recusa?: string | null
          motivo?: string
          prioridade?: string
          profissional_id?: string
          resposta_em?: string | null
          setor_destino_id?: string | null
          setor_origem_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acionamentos_reforco_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acionamentos_reforco_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "professionals_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acionamentos_reforco_setor_destino_id_fkey"
            columns: ["setor_destino_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acionamentos_reforco_setor_origem_id_fkey"
            columns: ["setor_origem_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json | null
          id: string
          modulo: string
          status: string
          user_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          modulo: string
          status?: string
          user_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          modulo?: string
          status?: string
          user_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: []
      }
      censo_pacientes: {
        Row: {
          created_at: string | null
          data: string
          id: string
          leitos_ocupados: number
          proporcao_minima: number | null
          registrado_por: string | null
          setor_id: string
        }
        Insert: {
          created_at?: string | null
          data?: string
          id?: string
          leitos_ocupados?: number
          proporcao_minima?: number | null
          registrado_por?: string | null
          setor_id: string
        }
        Update: {
          created_at?: string | null
          data?: string
          id?: string
          leitos_ocupados?: number
          proporcao_minima?: number | null
          registrado_por?: string | null
          setor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "censo_pacientes_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      document_signatures: {
        Row: {
          content_hash: string
          created_at: string
          document_id: string
          document_title: string | null
          document_type: string
          document_version: number
          id: string
          ip_address: string | null
          metadata: Json
          previous_signature_id: string | null
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          signed_at: string
          signed_by_professional_id: string | null
          signed_by_user_id: string
          signer_name: string
          signer_role: Database["public"]["Enums"]["signature_role"]
          status: Database["public"]["Enums"]["signature_status"]
          user_agent: string | null
          validation_code: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          document_id: string
          document_title?: string | null
          document_type: string
          document_version?: number
          id?: string
          ip_address?: string | null
          metadata?: Json
          previous_signature_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          signed_at?: string
          signed_by_professional_id?: string | null
          signed_by_user_id: string
          signer_name: string
          signer_role: Database["public"]["Enums"]["signature_role"]
          status?: Database["public"]["Enums"]["signature_status"]
          user_agent?: string | null
          validation_code: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          document_id?: string
          document_title?: string | null
          document_type?: string
          document_version?: number
          id?: string
          ip_address?: string | null
          metadata?: Json
          previous_signature_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          signed_at?: string
          signed_by_professional_id?: string | null
          signed_by_user_id?: string
          signer_name?: string
          signer_role?: Database["public"]["Enums"]["signature_role"]
          status?: Database["public"]["Enums"]["signature_status"]
          user_agent?: string | null
          validation_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_signatures_previous_signature_id_fkey"
            columns: ["previous_signature_id"]
            isOneToOne: false
            referencedRelation: "document_signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          abnt_config: Json
          ativo: boolean
          conteudo_html: string
          created_at: string
          created_by: string | null
          descricao: string | null
          escopo: Database["public"]["Enums"]["document_template_scope"]
          id: string
          is_personalizado: boolean
          is_system_default: boolean
          nome: string
          owner_profissional_id: string | null
          perfis_edicao: string[]
          perfis_uso: string[]
          setor_id: string | null
          sigla: string | null
          tipo: Database["public"]["Enums"]["document_template_type"]
          unidade_id: string | null
          updated_at: string
          variaveis_disponiveis: string[] | null
          versao: number
        }
        Insert: {
          abnt_config?: Json
          ativo?: boolean
          conteudo_html?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          escopo?: Database["public"]["Enums"]["document_template_scope"]
          id?: string
          is_personalizado?: boolean
          is_system_default?: boolean
          nome: string
          owner_profissional_id?: string | null
          perfis_edicao?: string[]
          perfis_uso?: string[]
          setor_id?: string | null
          sigla?: string | null
          tipo: Database["public"]["Enums"]["document_template_type"]
          unidade_id?: string | null
          updated_at?: string
          variaveis_disponiveis?: string[] | null
          versao?: number
        }
        Update: {
          abnt_config?: Json
          ativo?: boolean
          conteudo_html?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          escopo?: Database["public"]["Enums"]["document_template_scope"]
          id?: string
          is_personalizado?: boolean
          is_system_default?: boolean
          nome?: string
          owner_profissional_id?: string | null
          perfis_edicao?: string[]
          perfis_uso?: string[]
          setor_id?: string | null
          sigla?: string | null
          tipo?: Database["public"]["Enums"]["document_template_type"]
          unidade_id?: string | null
          updated_at?: string
          variaveis_disponiveis?: string[] | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_owner_profissional_id_fkey"
            columns: ["owner_profissional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_templates_owner_profissional_id_fkey"
            columns: ["owner_profissional_id"]
            isOneToOne: false
            referencedRelation: "professionals_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_templates_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_templates_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_documents: {
        Row: {
          assinado_em: string | null
          assinado_por: string | null
          atualizado_por: string | null
          codigo_validacao: string
          conteudo_html: string
          created_at: string
          criado_por: string | null
          dados_geracao: Json
          hash: string
          id: string
          modelo_id: string | null
          modelo_nome: string | null
          motivo_retificacao: string | null
          previous_document_id: string | null
          profissional_id: string | null
          root_document_id: string | null
          setor_id: string | null
          signature_id: string | null
          status: Database["public"]["Enums"]["generated_document_status"]
          tipo_documento: Database["public"]["Enums"]["generated_document_type"]
          titulo: string
          unidade_id: string | null
          updated_at: string
          versao: number
        }
        Insert: {
          assinado_em?: string | null
          assinado_por?: string | null
          atualizado_por?: string | null
          codigo_validacao: string
          conteudo_html?: string
          created_at?: string
          criado_por?: string | null
          dados_geracao?: Json
          hash: string
          id?: string
          modelo_id?: string | null
          modelo_nome?: string | null
          motivo_retificacao?: string | null
          previous_document_id?: string | null
          profissional_id?: string | null
          root_document_id?: string | null
          setor_id?: string | null
          signature_id?: string | null
          status?: Database["public"]["Enums"]["generated_document_status"]
          tipo_documento: Database["public"]["Enums"]["generated_document_type"]
          titulo: string
          unidade_id?: string | null
          updated_at?: string
          versao?: number
        }
        Update: {
          assinado_em?: string | null
          assinado_por?: string | null
          atualizado_por?: string | null
          codigo_validacao?: string
          conteudo_html?: string
          created_at?: string
          criado_por?: string | null
          dados_geracao?: Json
          hash?: string
          id?: string
          modelo_id?: string | null
          modelo_nome?: string | null
          motivo_retificacao?: string | null
          previous_document_id?: string | null
          profissional_id?: string | null
          root_document_id?: string | null
          setor_id?: string | null
          signature_id?: string | null
          status?: Database["public"]["Enums"]["generated_document_status"]
          tipo_documento?: Database["public"]["Enums"]["generated_document_type"]
          titulo?: string
          unidade_id?: string | null
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "generated_documents_previous_document_id_fkey"
            columns: ["previous_document_id"]
            isOneToOne: false
            referencedRelation: "generated_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "document_signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_ocupacao: {
        Row: {
          id: string
          nivel: string
          pacientes: number
          registrado_em: string | null
          setor_id: string
        }
        Insert: {
          id?: string
          nivel: string
          pacientes?: number
          registrado_em?: string | null
          setor_id: string
        }
        Update: {
          id?: string
          nivel?: string
          pacientes?: number
          registrado_em?: string | null
          setor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_ocupacao_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          assunto: string
          ativo: boolean
          categoria: string
          created_at: string
          id: string
          mensagem: string
          tipo: string
          updated_at: string
        }
        Insert: {
          assunto: string
          ativo?: boolean
          categoria?: string
          created_at?: string
          id?: string
          mensagem: string
          tipo: string
          updated_at?: string
        }
        Update: {
          assunto?: string
          ativo?: boolean
          categoria?: string
          created_at?: string
          id?: string
          mensagem?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          canal: string | null
          created_at: string
          id: string
          lida: boolean
          mensagem: string
          professional_id: string | null
          status_envio: string | null
          tipo: string
          titulo: string
          user_id: string | null
        }
        Insert: {
          canal?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          mensagem: string
          professional_id?: string | null
          status_envio?: string | null
          tipo: string
          titulo: string
          user_id?: string | null
        }
        Update: {
          canal?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string
          professional_id?: string | null
          status_envio?: string | null
          tipo?: string
          titulo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_documents: {
        Row: {
          arquivo_path: string | null
          created_at: string
          data_emissao: string | null
          id: string
          nome: string
          numero: string | null
          observacoes: string | null
          profissional_id: string
          status: string
          tipo: string
          updated_at: string
          validade: string | null
        }
        Insert: {
          arquivo_path?: string | null
          created_at?: string
          data_emissao?: string | null
          id?: string
          nome: string
          numero?: string | null
          observacoes?: string | null
          profissional_id: string
          status?: string
          tipo: string
          updated_at?: string
          validade?: string | null
        }
        Update: {
          arquivo_path?: string | null
          created_at?: string
          data_emissao?: string | null
          id?: string
          nome?: string
          numero?: string | null
          observacoes?: string | null
          profissional_id?: string
          status?: string
          tipo?: string
          updated_at?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_documents_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_documents_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "professionals_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_stamps: {
        Row: {
          alinhamento_texto: string
          altura_max: number
          assinatura_path: string | null
          assinatura_posicao: string
          assinatura_tamanho: number
          bloqueado: boolean
          bloqueado_motivo: string | null
          cargo: string | null
          carimbo_path: string | null
          carimbo_tamanho: number
          cbo: string | null
          cidade_uf: string | null
          cns: string | null
          contextos_uso: string[]
          cor_texto: string
          created_at: string
          espacamento_bottom: number
          espacamento_top: number
          especialidade: string | null
          estilo: string
          id: string
          largura: number
          metadata: Json
          mostrar_cbo: boolean
          mostrar_cidade_uf: boolean
          mostrar_cns: boolean
          mostrar_codigo_validacao: boolean
          mostrar_conselho: boolean
          mostrar_data_local: boolean
          mostrar_especialidade: boolean
          mostrar_hash: boolean
          mostrar_linha_assinatura: boolean
          mostrar_profissao: boolean
          mostrar_qr_code: boolean
          mostrar_setor: boolean
          mostrar_uf_conselho: boolean
          mostrar_unidade: boolean
          profissional_id: string
          tamanho_fonte: number
          texto_personalizado: string | null
          tipo: string
          uf_conselho: string | null
          updated_at: string
        }
        Insert: {
          alinhamento_texto?: string
          altura_max?: number
          assinatura_path?: string | null
          assinatura_posicao?: string
          assinatura_tamanho?: number
          bloqueado?: boolean
          bloqueado_motivo?: string | null
          cargo?: string | null
          carimbo_path?: string | null
          carimbo_tamanho?: number
          cbo?: string | null
          cidade_uf?: string | null
          cns?: string | null
          contextos_uso?: string[]
          cor_texto?: string
          created_at?: string
          espacamento_bottom?: number
          espacamento_top?: number
          especialidade?: string | null
          estilo?: string
          id?: string
          largura?: number
          metadata?: Json
          mostrar_cbo?: boolean
          mostrar_cidade_uf?: boolean
          mostrar_cns?: boolean
          mostrar_codigo_validacao?: boolean
          mostrar_conselho?: boolean
          mostrar_data_local?: boolean
          mostrar_especialidade?: boolean
          mostrar_hash?: boolean
          mostrar_linha_assinatura?: boolean
          mostrar_profissao?: boolean
          mostrar_qr_code?: boolean
          mostrar_setor?: boolean
          mostrar_uf_conselho?: boolean
          mostrar_unidade?: boolean
          profissional_id: string
          tamanho_fonte?: number
          texto_personalizado?: string | null
          tipo?: string
          uf_conselho?: string | null
          updated_at?: string
        }
        Update: {
          alinhamento_texto?: string
          altura_max?: number
          assinatura_path?: string | null
          assinatura_posicao?: string
          assinatura_tamanho?: number
          bloqueado?: boolean
          bloqueado_motivo?: string | null
          cargo?: string | null
          carimbo_path?: string | null
          carimbo_tamanho?: number
          cbo?: string | null
          cidade_uf?: string | null
          cns?: string | null
          contextos_uso?: string[]
          cor_texto?: string
          created_at?: string
          espacamento_bottom?: number
          espacamento_top?: number
          especialidade?: string | null
          estilo?: string
          id?: string
          largura?: number
          metadata?: Json
          mostrar_cbo?: boolean
          mostrar_cidade_uf?: boolean
          mostrar_cns?: boolean
          mostrar_codigo_validacao?: boolean
          mostrar_conselho?: boolean
          mostrar_data_local?: boolean
          mostrar_especialidade?: boolean
          mostrar_hash?: boolean
          mostrar_linha_assinatura?: boolean
          mostrar_profissao?: boolean
          mostrar_qr_code?: boolean
          mostrar_setor?: boolean
          mostrar_uf_conselho?: boolean
          mostrar_unidade?: boolean
          profissional_id?: string
          tamanho_fonte?: number
          texto_personalizado?: string | null
          tipo?: string
          uf_conselho?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      professional_unavailability: {
        Row: {
          created_at: string
          data_fim: string
          data_inicio: string
          documento_url: string | null
          id: string
          motivo: string
          motivo_gestor: string | null
          observacao_gestor: string | null
          observacao_profissional: string | null
          profissional_id: string
          status: string
          substituto_id: string | null
          tipo: string
          tipo_gestor: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_fim: string
          data_inicio: string
          documento_url?: string | null
          id?: string
          motivo: string
          motivo_gestor?: string | null
          observacao_gestor?: string | null
          observacao_profissional?: string | null
          profissional_id: string
          status?: string
          substituto_id?: string | null
          tipo?: string
          tipo_gestor?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_fim?: string
          data_inicio?: string
          documento_url?: string | null
          id?: string
          motivo?: string
          motivo_gestor?: string | null
          observacao_gestor?: string | null
          observacao_profissional?: string | null
          profissional_id?: string
          status?: string
          substituto_id?: string | null
          tipo?: string
          tipo_gestor?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_unavailability_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_unavailability_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "professionals_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_unavailability_substituto_id_fkey"
            columns: ["substituto_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_unavailability_substituto_id_fkey"
            columns: ["substituto_id"]
            isOneToOne: false
            referencedRelation: "professionals_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          avatar_url: string | null
          cargo: string | null
          competencias: string[] | null
          conselho: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          documento_conselho: string | null
          documento_numero: string | null
          documento_validade: string | null
          email: string
          endereco: string | null
          especialidade: string | null
          id: string
          limite_trocas_paciente_mes: number
          limite_trocas_plantao_mes: number
          nome: string
          observacoes: string | null
          profissao: Database["public"]["Enums"]["profissao_type"]
          registro: string | null
          setor_principal_id: string | null
          status: string
          telefone: string | null
          unidade_principal_id: string | null
          updated_at: string
          user_id: string | null
          vinculo: string | null
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          competencias?: string[] | null
          conselho?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          documento_conselho?: string | null
          documento_numero?: string | null
          documento_validade?: string | null
          email: string
          endereco?: string | null
          especialidade?: string | null
          id?: string
          limite_trocas_paciente_mes?: number
          limite_trocas_plantao_mes?: number
          nome: string
          observacoes?: string | null
          profissao: Database["public"]["Enums"]["profissao_type"]
          registro?: string | null
          setor_principal_id?: string | null
          status?: string
          telefone?: string | null
          unidade_principal_id?: string | null
          updated_at?: string
          user_id?: string | null
          vinculo?: string | null
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          competencias?: string[] | null
          conselho?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          documento_conselho?: string | null
          documento_numero?: string | null
          documento_validade?: string | null
          email?: string
          endereco?: string | null
          especialidade?: string | null
          id?: string
          limite_trocas_paciente_mes?: number
          limite_trocas_plantao_mes?: number
          nome?: string
          observacoes?: string | null
          profissao?: Database["public"]["Enums"]["profissao_type"]
          registro?: string | null
          setor_principal_id?: string | null
          status?: string
          telefone?: string | null
          unidade_principal_id?: string | null
          updated_at?: string
          user_id?: string | null
          vinculo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_setor_principal_id_fkey"
            columns: ["setor_principal_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_unidade_principal_id_fkey"
            columns: ["unidade_principal_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          nome: string
          profissional_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          id?: string
          nome: string
          profissional_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          nome?: string
          profissional_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "professionals_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          created_at: string
          id: string
          min_profissionais_diurno: number | null
          min_profissionais_fds: number | null
          min_profissionais_noturno: number | null
          nome: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_profissionais_diurno?: number | null
          min_profissionais_fds?: number | null
          min_profissionais_noturno?: number | null
          nome: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          min_profissionais_diurno?: number | null
          min_profissionais_fds?: number | null
          min_profissionais_noturno?: number | null
          nome?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sectors_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      setor_ocupacao: {
        Row: {
          atualizado_por: string | null
          capacidade_maxima: number
          id: string
          nivel: string
          pacientes_atual: number
          setor_id: string
          updated_at: string | null
        }
        Insert: {
          atualizado_por?: string | null
          capacidade_maxima?: number
          id?: string
          nivel?: string
          pacientes_atual?: number
          setor_id: string
          updated_at?: string | null
        }
        Update: {
          atualizado_por?: string | null
          capacidade_maxima?: number
          id?: string
          nivel?: string
          pacientes_atual?: number
          setor_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "setor_ocupacao_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: true
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_swaps: {
        Row: {
          aprovado_em: string | null
          bypass_aprovacao: boolean | null
          created_at: string
          destinatario_id: string | null
          id: string
          motivo: string
          motivo_administrativo: string | null
          observacao_gestor: string | null
          observacao_rejeicao: string | null
          rejeitado_em: string | null
          shift_id: string | null
          shift_id_destino: string | null
          solicitante_id: string
          stamp_aprovador_id: string | null
          stamp_destinatario_id: string | null
          stamp_solicitante_id: string | null
          status: Database["public"]["Enums"]["swap_status"]
          tipo: string
          updated_at: string
        }
        Insert: {
          aprovado_em?: string | null
          bypass_aprovacao?: boolean | null
          created_at?: string
          destinatario_id?: string | null
          id?: string
          motivo: string
          motivo_administrativo?: string | null
          observacao_gestor?: string | null
          observacao_rejeicao?: string | null
          rejeitado_em?: string | null
          shift_id?: string | null
          shift_id_destino?: string | null
          solicitante_id: string
          stamp_aprovador_id?: string | null
          stamp_destinatario_id?: string | null
          stamp_solicitante_id?: string | null
          status?: Database["public"]["Enums"]["swap_status"]
          tipo?: string
          updated_at?: string
        }
        Update: {
          aprovado_em?: string | null
          bypass_aprovacao?: boolean | null
          created_at?: string
          destinatario_id?: string | null
          id?: string
          motivo?: string
          motivo_administrativo?: string | null
          observacao_gestor?: string | null
          observacao_rejeicao?: string | null
          rejeitado_em?: string | null
          shift_id?: string | null
          shift_id_destino?: string | null
          solicitante_id?: string
          stamp_aprovador_id?: string | null
          stamp_destinatario_id?: string | null
          stamp_solicitante_id?: string | null
          status?: Database["public"]["Enums"]["swap_status"]
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_swaps_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "professionals_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_shift_id_destino_fkey"
            columns: ["shift_id_destino"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "professionals_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_stamp_aprovador_id_fkey"
            columns: ["stamp_aprovador_id"]
            isOneToOne: false
            referencedRelation: "professional_stamps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_stamp_destinatario_id_fkey"
            columns: ["stamp_destinatario_id"]
            isOneToOne: false
            referencedRelation: "professional_stamps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_stamp_solicitante_id_fkey"
            columns: ["stamp_solicitante_id"]
            isOneToOne: false
            referencedRelation: "professional_stamps"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_types: {
        Row: {
          ativo: boolean
          carga_horaria: number
          cor: string | null
          created_at: string
          hora_fim: string
          hora_inicio: string
          id: string
          nome: string
          ordem: number
          sigla: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          carga_horaria?: number
          cor?: string | null
          created_at?: string
          hora_fim: string
          hora_inicio: string
          id?: string
          nome: string
          ordem?: number
          sigla: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          carga_horaria?: number
          cor?: string | null
          created_at?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          nome?: string
          ordem?: number
          sigla?: string
          updated_at?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          atraso_minutos: number | null
          carga_horaria: number
          checkin_em: string | null
          checkin_lat: number | null
          checkin_lng: number | null
          checkin_metodo: string | null
          checkout_em: string | null
          confirmado_em: string | null
          confirmado_pelo_profissional: boolean
          created_at: string
          created_by: string | null
          data: string
          faltou: boolean
          hora_fim: string
          hora_inicio: string
          id: string
          observacoes: string | null
          profissao: Database["public"]["Enums"]["profissao_type"]
          profissional_id: string
          setor_id: string | null
          status: Database["public"]["Enums"]["shift_status"]
          tipo_plantao: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          atraso_minutos?: number | null
          carga_horaria: number
          checkin_em?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkin_metodo?: string | null
          checkout_em?: string | null
          confirmado_em?: string | null
          confirmado_pelo_profissional?: boolean
          created_at?: string
          created_by?: string | null
          data: string
          faltou?: boolean
          hora_fim: string
          hora_inicio: string
          id?: string
          observacoes?: string | null
          profissao: Database["public"]["Enums"]["profissao_type"]
          profissional_id: string
          setor_id?: string | null
          status?: Database["public"]["Enums"]["shift_status"]
          tipo_plantao?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          atraso_minutos?: number | null
          carga_horaria?: number
          checkin_em?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkin_metodo?: string | null
          checkout_em?: string | null
          confirmado_em?: string | null
          confirmado_pelo_profissional?: boolean
          created_at?: string
          created_by?: string | null
          data?: string
          faltou?: boolean
          hora_fim?: string
          hora_inicio?: string
          id?: string
          observacoes?: string | null
          profissao?: Database["public"]["Enums"]["profissao_type"]
          profissional_id?: string
          setor_id?: string | null
          status?: Database["public"]["Enums"]["shift_status"]
          tipo_plantao?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "professionals_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      swap_attachments: {
        Row: {
          analisado_em: string | null
          analisado_por: string | null
          created_at: string
          descricao: string | null
          enviado_por_profissional_id: string | null
          enviado_por_user_id: string
          id: string
          mime_type: string
          motivo_rejeicao: string | null
          nome_original: string
          status: Database["public"]["Enums"]["swap_attachment_status"]
          storage_path: string
          tamanho: number
          tipo_documento: Database["public"]["Enums"]["swap_attachment_type"]
          troca_id: string
          updated_at: string
        }
        Insert: {
          analisado_em?: string | null
          analisado_por?: string | null
          created_at?: string
          descricao?: string | null
          enviado_por_profissional_id?: string | null
          enviado_por_user_id: string
          id?: string
          mime_type: string
          motivo_rejeicao?: string | null
          nome_original: string
          status?: Database["public"]["Enums"]["swap_attachment_status"]
          storage_path: string
          tamanho: number
          tipo_documento?: Database["public"]["Enums"]["swap_attachment_type"]
          troca_id: string
          updated_at?: string
        }
        Update: {
          analisado_em?: string | null
          analisado_por?: string | null
          created_at?: string
          descricao?: string | null
          enviado_por_profissional_id?: string | null
          enviado_por_user_id?: string
          id?: string
          mime_type?: string
          motivo_rejeicao?: string | null
          nome_original?: string
          status?: Database["public"]["Enums"]["swap_attachment_status"]
          storage_path?: string
          tamanho?: number
          tipo_documento?: Database["public"]["Enums"]["swap_attachment_type"]
          troca_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      swap_history: {
        Row: {
          acao: string
          created_at: string
          detalhes: string | null
          id: string
          swap_id: string
          user_id: string | null
          usuario: string
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: string | null
          id?: string
          swap_id: string
          user_id?: string | null
          usuario: string
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: string | null
          id?: string
          swap_id?: string
          user_id?: string | null
          usuario?: string
        }
        Relationships: [
          {
            foreignKeyName: "swap_history_swap_id_fkey"
            columns: ["swap_id"]
            isOneToOne: false
            referencedRelation: "shift_swaps"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      units: {
        Row: {
          created_at: string
          endereco: string | null
          id: string
          nome: string
          telefone: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          endereco?: string | null
          id?: string
          nome: string
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          endereco?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      professionals_safe: {
        Row: {
          avatar_url: string | null
          cargo: string | null
          competencias: string[] | null
          conselho: string | null
          cpf: string | null
          created_at: string | null
          data_nascimento: string | null
          documento_conselho: string | null
          documento_numero: string | null
          documento_validade: string | null
          email: string | null
          endereco: string | null
          especialidade: string | null
          id: string | null
          nome: string | null
          observacoes: string | null
          profissao: Database["public"]["Enums"]["profissao_type"] | null
          registro: string | null
          setor_principal_id: string | null
          status: string | null
          telefone: string | null
          unidade_principal_id: string | null
          updated_at: string | null
          user_id: string | null
          vinculo: string | null
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          competencias?: string[] | null
          conselho?: string | null
          cpf?: never
          created_at?: string | null
          data_nascimento?: string | null
          documento_conselho?: string | null
          documento_numero?: string | null
          documento_validade?: string | null
          email?: string | null
          endereco?: string | null
          especialidade?: string | null
          id?: string | null
          nome?: string | null
          observacoes?: string | null
          profissao?: Database["public"]["Enums"]["profissao_type"] | null
          registro?: string | null
          setor_principal_id?: string | null
          status?: string | null
          telefone?: string | null
          unidade_principal_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          vinculo?: string | null
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          competencias?: string[] | null
          conselho?: string | null
          cpf?: never
          created_at?: string | null
          data_nascimento?: string | null
          documento_conselho?: string | null
          documento_numero?: string | null
          documento_validade?: string | null
          email?: string | null
          endereco?: string | null
          especialidade?: string | null
          id?: string | null
          nome?: string | null
          observacoes?: string | null
          profissao?: Database["public"]["Enums"]["profissao_type"] | null
          registro?: string | null
          setor_principal_id?: string | null
          status?: string | null
          telefone?: string | null
          unidade_principal_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          vinculo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_setor_principal_id_fkey"
            columns: ["setor_principal_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_unidade_principal_id_fkey"
            columns: ["unidade_principal_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_descanso_minimo: {
        Args: {
          p_data: string
          p_descanso_horas: number
          p_exclude_id?: string
          p_hora_fim: string
          p_hora_inicio: string
          p_profissional_id: string
        }
        Returns: {
          gap_horas: number
          violando_shift_id: string
          vizinho_fim: string
          vizinho_inicio: string
        }[]
      }
      check_professional_has_stamp: {
        Args: { p_profissional_id: string }
        Returns: boolean
      }
      check_shift_conflict: {
        Args: {
          p_data: string
          p_exclude_id?: string
          p_hora_fim: string
          p_hora_inicio: string
          p_profissional_id: string
        }
        Returns: {
          conflicting_end: string
          conflicting_shift_id: string
          conflicting_start: string
        }[]
      }
      count_trocas_plantao_mes: {
        Args: { _profissional_id: string }
        Returns: number
      }
      get_my_professional_id: { Args: never; Returns: string }
      get_trocas_status_mes: {
        Args: { _profissional_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      list_professional_directory: {
        Args: never
        Returns: {
          cargo: string
          id: string
          nome: string
          profissao: Database["public"]["Enums"]["profissao_type"]
          setor_principal_id: string
          unidade_principal_id: string
        }[]
      }
      validate_generated_document: {
        Args: { _code: string }
        Returns: {
          assinado_em: string
          codigo_validacao: string
          created_at: string
          hash: string
          id: string
          root_document_id: string
          status: Database["public"]["Enums"]["generated_document_status"]
          tipo_documento: Database["public"]["Enums"]["generated_document_type"]
          titulo: string
          versao: number
        }[]
      }
      validate_signature: {
        Args: { _code: string }
        Returns: {
          content_hash: string
          document_title: string
          document_type: string
          document_version: number
          signed_at: string
          signer_name: string
          signer_role: Database["public"]["Enums"]["signature_role"]
          status: Database["public"]["Enums"]["signature_status"]
          validation_code: string
        }[]
      }
    }
    Enums: {
      app_role: "gestor_master" | "coordenador" | "profissional"
      document_template_scope: "global" | "unidade" | "setor" | "pessoal"
      document_template_type:
        | "escala_mensal_oficial"
        | "escala_semanal"
        | "comprovante_plantao"
        | "solicitacao_troca"
        | "aprovacao_troca"
        | "recusa_troca"
        | "declaracao_comparecimento"
        | "relatorio_plantoes"
        | "relatorio_horas"
        | "ficha_profissional"
        | "personalizado"
      generated_document_status:
        | "rascunho"
        | "gerado"
        | "assinado"
        | "publicado"
        | "retificado"
        | "cancelado"
        | "arquivado"
      generated_document_type:
        | "escala_mensal"
        | "comprovante_plantao"
        | "troca_plantao"
        | "relatorio_oficial"
        | "documento_personalizado"
        | "outro"
      profissao_type:
        | "medico"
        | "enfermeiro"
        | "fisioterapeuta"
        | "tecnico_enfermagem"
        | "biomedico"
        | "psicologo"
        | "terapeuta_ocupacional"
        | "nutricionista"
        | "fonoaudiologo"
        | "farmaceutico"
        | "outro"
      shift_status:
        | "agendado"
        | "confirmado"
        | "pendente"
        | "em_aberto"
        | "trocando"
        | "concluido"
        | "cancelado"
      signature_role:
        | "profissional"
        | "coordenador"
        | "gestor_master"
        | "institucional"
      signature_status: "ativa" | "revogada" | "substituida"
      swap_attachment_status: "ativo" | "removido" | "rejeitado"
      swap_attachment_type:
        | "atestado_medico"
        | "declaracao"
        | "comprovante_consulta"
        | "convocacao"
        | "documento_institucional"
        | "documento_pessoal"
        | "outro"
      swap_status:
        | "solicitada"
        | "aguardando_resposta"
        | "aceita"
        | "recusada"
        | "aguardando_aprovacao"
        | "aprovada"
        | "rejeitada"
        | "cancelada"
        | "concluida"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["gestor_master", "coordenador", "profissional"],
      document_template_scope: ["global", "unidade", "setor", "pessoal"],
      document_template_type: [
        "escala_mensal_oficial",
        "escala_semanal",
        "comprovante_plantao",
        "solicitacao_troca",
        "aprovacao_troca",
        "recusa_troca",
        "declaracao_comparecimento",
        "relatorio_plantoes",
        "relatorio_horas",
        "ficha_profissional",
        "personalizado",
      ],
      generated_document_status: [
        "rascunho",
        "gerado",
        "assinado",
        "publicado",
        "retificado",
        "cancelado",
        "arquivado",
      ],
      generated_document_type: [
        "escala_mensal",
        "comprovante_plantao",
        "troca_plantao",
        "relatorio_oficial",
        "documento_personalizado",
        "outro",
      ],
      profissao_type: [
        "medico",
        "enfermeiro",
        "fisioterapeuta",
        "tecnico_enfermagem",
        "biomedico",
        "psicologo",
        "terapeuta_ocupacional",
        "nutricionista",
        "fonoaudiologo",
        "farmaceutico",
        "outro",
      ],
      shift_status: [
        "agendado",
        "confirmado",
        "pendente",
        "em_aberto",
        "trocando",
        "concluido",
        "cancelado",
      ],
      signature_role: [
        "profissional",
        "coordenador",
        "gestor_master",
        "institucional",
      ],
      signature_status: ["ativa", "revogada", "substituida"],
      swap_attachment_status: ["ativo", "removido", "rejeitado"],
      swap_attachment_type: [
        "atestado_medico",
        "declaracao",
        "comprovante_consulta",
        "convocacao",
        "documento_institucional",
        "documento_pessoal",
        "outro",
      ],
      swap_status: [
        "solicitada",
        "aguardando_resposta",
        "aceita",
        "recusada",
        "aguardando_aprovacao",
        "aprovada",
        "rejeitada",
        "cancelada",
        "concluida",
      ],
    },
  },
} as const
