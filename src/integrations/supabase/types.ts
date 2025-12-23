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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      arquivos_pdf: {
        Row: {
          data_upload: string | null
          id: string
          posto_id: string | null
          url: string
        }
        Insert: {
          data_upload?: string | null
          id?: string
          posto_id?: string | null
          url: string
        }
        Update: {
          data_upload?: string | null
          id?: string
          posto_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "arquivos_pdf_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes: {
        Row: {
          comentario: string | null
          created_at: string | null
          id: string
          nome_usuario: string | null
          rating: number
        }
        Insert: {
          comentario?: string | null
          created_at?: string | null
          id?: string
          nome_usuario?: string | null
          rating: number
        }
        Update: {
          comentario?: string | null
          created_at?: string | null
          id?: string
          nome_usuario?: string | null
          rating?: number
        }
        Relationships: []
      }
      config_sistema: {
        Row: {
          chave: string
          id: string
          updated_at: string
          valor: string
        }
        Insert: {
          chave: string
          id?: string
          updated_at?: string
          valor: string
        }
        Update: {
          chave?: string
          id?: string
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      correcoes_pdf: {
        Row: {
          aprovado_em: string | null
          id: string
          periodo: string
          solicitado_em: string | null
          status: string
          ubs_id: string
          user_id: string
        }
        Insert: {
          aprovado_em?: string | null
          id?: string
          periodo: string
          solicitado_em?: string | null
          status?: string
          ubs_id: string
          user_id: string
        }
        Update: {
          aprovado_em?: string | null
          id?: string
          periodo?: string
          solicitado_em?: string | null
          status?: string
          ubs_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "correcoes_pdf_ubs_id_fkey"
            columns: ["ubs_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correcoes_pdf_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas_medicamento: {
        Row: {
          data_entrega: string
          id: string
          lote_id: string | null
          observacao: string | null
          paciente_medicamento_id: string
          quantidade: number
        }
        Insert: {
          data_entrega?: string
          id?: string
          lote_id?: string | null
          observacao?: string | null
          paciente_medicamento_id: string
          quantidade?: number
        }
        Update: {
          data_entrega?: string
          id?: string
          lote_id?: string | null
          observacao?: string | null
          paciente_medicamento_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "entregas_medicamento_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_medicamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_medicamento_paciente_medicamento_id_fkey"
            columns: ["paciente_medicamento_id"]
            isOneToOne: false
            referencedRelation: "paciente_medicamento"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_medicamento: {
        Row: {
          created_at: string
          id: string
          lote: string
          medicamento_id: string
          quantidade: number
          validade: string
        }
        Insert: {
          created_at?: string
          id?: string
          lote: string
          medicamento_id: string
          quantidade?: number
          validade: string
        }
        Update: {
          created_at?: string
          id?: string
          lote?: string
          medicamento_id?: string
          quantidade?: number
          validade?: string
        }
        Relationships: [
          {
            foreignKeyName: "lotes_medicamento_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos_auto_custo"
            referencedColumns: ["id"]
          },
        ]
      }
      medicamentos: {
        Row: {
          created_at: string | null
          id: string
          marcas: string[] | null
          nome: string
          pagina_pdf: string | null
          posto_id: string
          quantidade: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          marcas?: string[] | null
          nome: string
          pagina_pdf?: string | null
          posto_id: string
          quantidade?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          marcas?: string[] | null
          nome?: string
          pagina_pdf?: string | null
          posto_id?: string
          quantidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicamentos_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
        ]
      }
      medicamentos_auto_custo: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          quantidade_por_unidade: number
          tipo_embalagem: string
          unidade_base: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          quantidade_por_unidade?: number
          tipo_embalagem?: string
          unidade_base?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          quantidade_por_unidade?: number
          tipo_embalagem?: string
          unidade_base?: string
        }
        Relationships: []
      }
      paciente_medicamento: {
        Row: {
          created_at: string
          data_autorizacao: string | null
          dispensacoes_realizadas: number | null
          disponivel_retirada: boolean
          duracao_meses: number | null
          id: string
          medicamento_id: string
          paciente_id: string
          quantidade_por_dispensacao: number
          status_medicamento: string | null
          unidade: string
        }
        Insert: {
          created_at?: string
          data_autorizacao?: string | null
          dispensacoes_realizadas?: number | null
          disponivel_retirada?: boolean
          duracao_meses?: number | null
          id?: string
          medicamento_id: string
          paciente_id: string
          quantidade_por_dispensacao?: number
          status_medicamento?: string | null
          unidade?: string
        }
        Update: {
          created_at?: string
          data_autorizacao?: string | null
          dispensacoes_realizadas?: number | null
          disponivel_retirada?: boolean
          duracao_meses?: number | null
          id?: string
          medicamento_id?: string
          paciente_id?: string
          quantidade_por_dispensacao?: number
          status_medicamento?: string | null
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "paciente_medicamento_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "medicamentos_auto_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paciente_medicamento_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes_auto_custo"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes_auto_custo: {
        Row: {
          cartao_sus: string
          created_at: string
          id: string
          nome_completo: string
          updated_at: string
        }
        Insert: {
          cartao_sus: string
          created_at?: string
          id?: string
          nome_completo: string
          updated_at?: string
        }
        Update: {
          cartao_sus?: string
          created_at?: string
          id?: string
          nome_completo?: string
          updated_at?: string
        }
        Relationships: []
      }
      postos: {
        Row: {
          atualizado_em: string | null
          contato: string | null
          horario_funcionamento: string
          id: string
          localidade: string
          nome: string
          responsavel_id: string | null
          status: string
        }
        Insert: {
          atualizado_em?: string | null
          contato?: string | null
          horario_funcionamento: string
          id?: string
          localidade: string
          nome: string
          responsavel_id?: string | null
          status?: string
        }
        Update: {
          atualizado_em?: string | null
          contato?: string | null
          horario_funcionamento?: string
          id?: string
          localidade?: string
          nome?: string
          responsavel_id?: string | null
          status?: string
        }
        Relationships: []
      }
      update_checks: {
        Row: {
          created_at: string | null
          data: string
          id: string
          manha: boolean
          tarde: boolean
          ubs_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: string
          id?: string
          manha?: boolean
          tarde?: boolean
          ubs_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: string
          id?: string
          manha?: boolean
          tarde?: boolean
          ubs_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "update_checks_ubs_id_fkey"
            columns: ["ubs_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "update_checks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario_posto: {
        Row: {
          posto_id: string
          user_id: string
        }
        Insert: {
          posto_id: string
          user_id: string
        }
        Update: {
          posto_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_posto_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_posto_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          criado_em: string | null
          email: string
          id: string
          nome: string
          senha: string
          tipo: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          criado_em?: string | null
          email: string
          id?: string
          nome: string
          senha: string
          tipo?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          criado_em?: string | null
          email?: string
          id?: string
          nome?: string
          senha?: string
          tipo?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_update_checks: { Args: never; Returns: undefined }
      fn_login: {
        Args: { p_email: string; p_senha: string }
        Returns: {
          email: string
          id: string
          nome: string
          tipo: string
        }[]
      }
    }
    Enums: {
      user_role: "admin" | "responsavel"
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
      user_role: ["admin", "responsavel"],
    },
  },
} as const
