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
        ]
      }
      professionals: {
        Row: {
          agencia: string | null
          avatar_url: string | null
          banco: string | null
          chave_pix: string | null
          conselho: string | null
          conta: string | null
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
          valor_hora: number
          valor_plantao: number | null
          vinculo: string | null
        }
        Insert: {
          agencia?: string | null
          avatar_url?: string | null
          banco?: string | null
          chave_pix?: string | null
          conselho?: string | null
          conta?: string | null
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
          valor_hora?: number
          valor_plantao?: number | null
          vinculo?: string | null
        }
        Update: {
          agencia?: string | null
          avatar_url?: string | null
          banco?: string | null
          chave_pix?: string | null
          conselho?: string | null
          conta?: string | null
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
          valor_hora?: number
          valor_plantao?: number | null
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
        ]
      }
      shifts: {
        Row: {
          carga_horaria: number
          created_at: string
          created_by: string | null
          data: string
          hora_fim: string
          hora_inicio: string
          id: string
          observacoes: string | null
          profissao: Database["public"]["Enums"]["profissao_type"]
          profissional_id: string
          setor_id: string
          status: Database["public"]["Enums"]["shift_status"]
          tipo_plantao: string
          unidade_id: string
          updated_at: string
          valor_hora: number
          valor_total: number
        }
        Insert: {
          carga_horaria: number
          created_at?: string
          created_by?: string | null
          data: string
          hora_fim: string
          hora_inicio: string
          id?: string
          observacoes?: string | null
          profissao: Database["public"]["Enums"]["profissao_type"]
          profissional_id: string
          setor_id: string
          status?: Database["public"]["Enums"]["shift_status"]
          tipo_plantao?: string
          unidade_id: string
          updated_at?: string
          valor_hora?: number
          valor_total?: number
        }
        Update: {
          carga_horaria?: number
          created_at?: string
          created_by?: string | null
          data?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          observacoes?: string | null
          profissao?: Database["public"]["Enums"]["profissao_type"]
          profissional_id?: string
          setor_id?: string
          status?: Database["public"]["Enums"]["shift_status"]
          tipo_plantao?: string
          unidade_id?: string
          updated_at?: string
          valor_hora?: number
          valor_total?: number
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
      [_ in never]: never
    }
    Functions: {
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
      get_my_professional_id: { Args: never; Returns: string }
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
          id: string
          nome: string
          profissao: Database["public"]["Enums"]["profissao_type"]
          setor_principal_id: string
          unidade_principal_id: string
        }[]
      }
    }
    Enums: {
      app_role: "gestor_master" | "coordenador" | "profissional"
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
