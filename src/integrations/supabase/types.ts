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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          criado_em: string
          email: string | null
          id: string
          instagram: string | null
          nome: string
          observacao: string | null
          telefone: string | null
          whatsapp: string | null
        }
        Insert: {
          criado_em?: string
          email?: string | null
          id?: string
          instagram?: string | null
          nome: string
          observacao?: string | null
          telefone?: string | null
          whatsapp?: string | null
        }
        Update: {
          criado_em?: string
          email?: string | null
          id?: string
          instagram?: string | null
          nome?: string
          observacao?: string | null
          telefone?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          chave: string
          criado_em: string
          id: string
          valor: string | null
        }
        Insert: {
          chave: string
          criado_em?: string
          id?: string
          valor?: string | null
        }
        Update: {
          chave?: string
          criado_em?: string
          id?: string
          valor?: string | null
        }
        Relationships: []
      }
      despesas_empresa: {
        Row: {
          categoria: Database["public"]["Enums"]["despesa_categoria_empresa"]
          criado_em: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          forma_pagamento: string | null
          id: string
          observacao: string | null
          saldo_pendente: number | null
          status: Database["public"]["Enums"]["status_despesa"] | null
          tipo_despesa: Database["public"]["Enums"]["tipo_despesa"]
          valor_original: number
          valor_pago_total: number | null
        }
        Insert: {
          categoria: Database["public"]["Enums"]["despesa_categoria_empresa"]
          criado_em?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          forma_pagamento?: string | null
          id?: string
          observacao?: string | null
          saldo_pendente?: number | null
          status?: Database["public"]["Enums"]["status_despesa"] | null
          tipo_despesa?: Database["public"]["Enums"]["tipo_despesa"]
          valor_original?: number
          valor_pago_total?: number | null
        }
        Update: {
          categoria?: Database["public"]["Enums"]["despesa_categoria_empresa"]
          criado_em?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          observacao?: string | null
          saldo_pendente?: number | null
          status?: Database["public"]["Enums"]["status_despesa"] | null
          tipo_despesa?: Database["public"]["Enums"]["tipo_despesa"]
          valor_original?: number
          valor_pago_total?: number | null
        }
        Relationships: []
      }
      despesas_pessoal: {
        Row: {
          categoria: Database["public"]["Enums"]["despesa_categoria_pessoal"]
          criado_em: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          forma_pagamento: string | null
          id: string
          observacao: string | null
          saldo_pendente: number | null
          status: Database["public"]["Enums"]["status_despesa"] | null
          tipo_despesa: Database["public"]["Enums"]["tipo_despesa"]
          valor_original: number
          valor_pago_total: number | null
        }
        Insert: {
          categoria: Database["public"]["Enums"]["despesa_categoria_pessoal"]
          criado_em?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          forma_pagamento?: string | null
          id?: string
          observacao?: string | null
          saldo_pendente?: number | null
          status?: Database["public"]["Enums"]["status_despesa"] | null
          tipo_despesa?: Database["public"]["Enums"]["tipo_despesa"]
          valor_original?: number
          valor_pago_total?: number | null
        }
        Update: {
          categoria?: Database["public"]["Enums"]["despesa_categoria_pessoal"]
          criado_em?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          observacao?: string | null
          saldo_pendente?: number | null
          status?: Database["public"]["Enums"]["status_despesa"] | null
          tipo_despesa?: Database["public"]["Enums"]["tipo_despesa"]
          valor_original?: number
          valor_pago_total?: number | null
        }
        Relationships: []
      }
      estoque_cmv: {
        Row: {
          criado_em: string
          custo_unitario: number | null
          data_compra: string
          id: string
          produto_descricao: string
          quantidade: number
          valor_absorvido: number | null
          valor_restante: number | null
          valor_total: number
        }
        Insert: {
          criado_em?: string
          custo_unitario?: number | null
          data_compra: string
          id?: string
          produto_descricao: string
          quantidade?: number
          valor_absorvido?: number | null
          valor_restante?: number | null
          valor_total?: number
        }
        Update: {
          criado_em?: string
          custo_unitario?: number | null
          data_compra?: string
          id?: string
          produto_descricao?: string
          quantidade?: number
          valor_absorvido?: number | null
          valor_restante?: number | null
          valor_total?: number
        }
        Relationships: []
      }
      eventos_despesas: {
        Row: {
          categoria_evento: Database["public"]["Enums"]["evento_despesa_categoria"]
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          evento_id: string
          id: string
          observacao: string | null
          saldo_pendente: number | null
          status: Database["public"]["Enums"]["status_despesa"] | null
          valor_original: number
          valor_pago_total: number | null
        }
        Insert: {
          categoria_evento?: Database["public"]["Enums"]["evento_despesa_categoria"]
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          evento_id: string
          id?: string
          observacao?: string | null
          saldo_pendente?: number | null
          status?: Database["public"]["Enums"]["status_despesa"] | null
          valor_original?: number
          valor_pago_total?: number | null
        }
        Update: {
          categoria_evento?: Database["public"]["Enums"]["evento_despesa_categoria"]
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          evento_id?: string
          id?: string
          observacao?: string | null
          saldo_pendente?: number | null
          status?: Database["public"]["Enums"]["status_despesa"] | null
          valor_original?: number
          valor_pago_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_despesas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_especiais"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_especiais: {
        Row: {
          criado_em: string
          data_evento: string | null
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          criado_em?: string
          data_evento?: string | null
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          criado_em?: string
          data_evento?: string | null
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      metas: {
        Row: {
          ano: number
          criado_em: string
          id: string
          mes: number
          pro_labore: number | null
          valor_meta: number
        }
        Insert: {
          ano: number
          criado_em?: string
          id?: string
          mes: number
          pro_labore?: number | null
          valor_meta?: number
        }
        Update: {
          ano?: number
          criado_em?: string
          id?: string
          mes?: number
          pro_labore?: number | null
          valor_meta?: number
        }
        Relationships: []
      }
      origens_venda_opcoes: {
        Row: {
          ativo: boolean
          id: string
          label: string
        }
        Insert: {
          ativo?: boolean
          id?: string
          label: string
        }
        Update: {
          ativo?: boolean
          id?: string
          label?: string
        }
        Relationships: []
      }
      pagamentos_parciais: {
        Row: {
          criado_em: string
          data_pagamento: string
          id: string
          observacao: string | null
          referencia_id: string
          referencia_tipo: string
          valor_pago: number
        }
        Insert: {
          criado_em?: string
          data_pagamento: string
          id?: string
          observacao?: string | null
          referencia_id: string
          referencia_tipo: string
          valor_pago?: number
        }
        Update: {
          criado_em?: string
          data_pagamento?: string
          id?: string
          observacao?: string | null
          referencia_id?: string
          referencia_tipo?: string
          valor_pago?: number
        }
        Relationships: []
      }
      parcelas_mentoria: {
        Row: {
          cliente_email: string | null
          cliente_id: string | null
          cliente_nome: string
          criado_em: string
          data_fim_prevista: string | null
          data_inicio: string
          data_termino_mentoria_anterior: string | null
          data_ultimo_acesso_anterior: string | null
          entrada_data: string | null
          entrada_valor: number | null
          id: string
          is_renovacao: boolean | null
          periodicidade: Database["public"]["Enums"]["periodicidade"]
          quant_parcelas: number
          receita_id: string | null
          status_geral: Database["public"]["Enums"]["status_parcela"] | null
          tipo_mentoria: Database["public"]["Enums"]["produto_categoria"]
          valor_total: number
        }
        Insert: {
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome: string
          criado_em?: string
          data_fim_prevista?: string | null
          data_inicio: string
          data_termino_mentoria_anterior?: string | null
          data_ultimo_acesso_anterior?: string | null
          entrada_data?: string | null
          entrada_valor?: number | null
          id?: string
          is_renovacao?: boolean | null
          periodicidade?: Database["public"]["Enums"]["periodicidade"]
          quant_parcelas?: number
          receita_id?: string | null
          status_geral?: Database["public"]["Enums"]["status_parcela"] | null
          tipo_mentoria: Database["public"]["Enums"]["produto_categoria"]
          valor_total?: number
        }
        Update: {
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          criado_em?: string
          data_fim_prevista?: string | null
          data_inicio?: string
          data_termino_mentoria_anterior?: string | null
          data_ultimo_acesso_anterior?: string | null
          entrada_data?: string | null
          entrada_valor?: number | null
          id?: string
          is_renovacao?: boolean | null
          periodicidade?: Database["public"]["Enums"]["periodicidade"]
          quant_parcelas?: number
          receita_id?: string | null
          status_geral?: Database["public"]["Enums"]["status_parcela"] | null
          tipo_mentoria?: Database["public"]["Enums"]["produto_categoria"]
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_mentoria_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_mentoria_receita_id_fkey"
            columns: ["receita_id"]
            isOneToOne: false
            referencedRelation: "receitas"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas_mentoria_detalhe: {
        Row: {
          data_pagamento: string | null
          data_vencimento: string
          id: string
          numero_parcela: number
          observacao: string | null
          parcela_mentoria_id: string
          saldo_parcela: number | null
          status: Database["public"]["Enums"]["status_parcela"] | null
          valor_pago_parcial: number | null
          valor_real: number | null
          valor_sugerido: number | null
        }
        Insert: {
          data_pagamento?: string | null
          data_vencimento: string
          id?: string
          numero_parcela: number
          observacao?: string | null
          parcela_mentoria_id: string
          saldo_parcela?: number | null
          status?: Database["public"]["Enums"]["status_parcela"] | null
          valor_pago_parcial?: number | null
          valor_real?: number | null
          valor_sugerido?: number | null
        }
        Update: {
          data_pagamento?: string | null
          data_vencimento?: string
          id?: string
          numero_parcela?: number
          observacao?: string | null
          parcela_mentoria_id?: string
          saldo_parcela?: number | null
          status?: Database["public"]["Enums"]["status_parcela"] | null
          valor_pago_parcial?: number | null
          valor_real?: number | null
          valor_sugerido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_mentoria_detalhe_parcela_mentoria_id_fkey"
            columns: ["parcela_mentoria_id"]
            isOneToOne: false
            referencedRelation: "parcelas_mentoria"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos_catalogo: {
        Row: {
          ativo: boolean
          categoria: Database["public"]["Enums"]["produto_categoria"]
          custo_direto_fixo_mensal: number | null
          custo_direto_percentual: number | null
          id: string
          nome: string
          observacao: string | null
          plataformas: string[] | null
          tipo: string | null
        }
        Insert: {
          ativo?: boolean
          categoria: Database["public"]["Enums"]["produto_categoria"]
          custo_direto_fixo_mensal?: number | null
          custo_direto_percentual?: number | null
          id?: string
          nome: string
          observacao?: string | null
          plataformas?: string[] | null
          tipo?: string | null
        }
        Update: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["produto_categoria"]
          custo_direto_fixo_mensal?: number | null
          custo_direto_percentual?: number | null
          id?: string
          nome?: string
          observacao?: string | null
          plataformas?: string[] | null
          tipo?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      receitas: {
        Row: {
          cliente_email: string | null
          cliente_nome: string | null
          criado_em: string
          data: string
          data_fim_mentoria: string | null
          forma_pagamento: string | null
          id: string
          is_ascensao: boolean | null
          lancado_por: string | null
          moeda_original: string | null
          observacao: string | null
          origens_venda: string[] | null
          plataforma: Database["public"]["Enums"]["plataforma_origem"]
          produto_categoria:
            | Database["public"]["Enums"]["produto_categoria"]
            | null
          produto_entrada_id: string | null
          produto_id: string | null
          produto_nome: string
          status: string | null
          taxa_cambio: number | null
          taxa_plataforma_percentual: number | null
          taxa_plataforma_valor: number | null
          valor_bruto: number
          valor_em_brl: number | null
          valor_liquido: number | null
        }
        Insert: {
          cliente_email?: string | null
          cliente_nome?: string | null
          criado_em?: string
          data: string
          data_fim_mentoria?: string | null
          forma_pagamento?: string | null
          id?: string
          is_ascensao?: boolean | null
          lancado_por?: string | null
          moeda_original?: string | null
          observacao?: string | null
          origens_venda?: string[] | null
          plataforma: Database["public"]["Enums"]["plataforma_origem"]
          produto_categoria?:
            | Database["public"]["Enums"]["produto_categoria"]
            | null
          produto_entrada_id?: string | null
          produto_id?: string | null
          produto_nome: string
          status?: string | null
          taxa_cambio?: number | null
          taxa_plataforma_percentual?: number | null
          taxa_plataforma_valor?: number | null
          valor_bruto?: number
          valor_em_brl?: number | null
          valor_liquido?: number | null
        }
        Update: {
          cliente_email?: string | null
          cliente_nome?: string | null
          criado_em?: string
          data?: string
          data_fim_mentoria?: string | null
          forma_pagamento?: string | null
          id?: string
          is_ascensao?: boolean | null
          lancado_por?: string | null
          moeda_original?: string | null
          observacao?: string | null
          origens_venda?: string[] | null
          plataforma?: Database["public"]["Enums"]["plataforma_origem"]
          produto_categoria?:
            | Database["public"]["Enums"]["produto_categoria"]
            | null
          produto_entrada_id?: string | null
          produto_id?: string | null
          produto_nome?: string
          status?: string | null
          taxa_cambio?: number | null
          taxa_plataforma_percentual?: number | null
          taxa_plataforma_valor?: number | null
          valor_bruto?: number
          valor_em_brl?: number | null
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "receitas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      atualizar_parcelas_atrasadas: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "operacional"
      despesa_categoria_empresa:
        | "Salário Funcionário"
        | "Tráfego Pago"
        | "Plataforma Digital"
        | "Aluguel Comercial"
        | "Serviços Terceiros"
        | "Contabilidade"
        | "Transportadora"
        | "Energia"
        | "Internet"
        | "Planos e Benefícios"
        | "IA"
        | "CMV Produto Físico"
        | "Variável"
        | "Outros"
      despesa_categoria_pessoal:
        | "Aluguéis/Financiamentos"
        | "Investimentos"
        | "Despesas Casa"
        | "Lazer"
        | "Alimentação"
        | "Saúde/Farmácia"
        | "Vestuário"
        | "Transporte"
        | "Pet"
        | "Estética"
        | "Outros"
      evento_despesa_categoria: "Fechado" | "Precisa Fechar" | "Pago/Presente"
      periodicidade: "Semanal" | "Quinzenal" | "Mensal"
      plataforma_origem: "Hotmart" | "Kiwify" | "Eduzz" | "Direto Pix" | "Outro"
      produto_categoria:
        | "Mentoria Outsider"
        | "Mentoria Digital Beauty"
        | "Consultoria Premium"
        | "Consultoria Express"
        | "Curso/Formação"
        | "Ferramenta"
        | "Apostila"
        | "Produto Físico"
        | "Renovação Mentoria"
        | "Outros"
      status_despesa: "A Vencer" | "Pago" | "Em Atraso" | "Parcialmente Pago"
      status_parcela: "Pendente" | "Quitado" | "Atraso" | "Parcialmente Pago"
      tipo_despesa: "Fixa" | "Variável"
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
      app_role: ["admin", "operacional"],
      despesa_categoria_empresa: [
        "Salário Funcionário",
        "Tráfego Pago",
        "Plataforma Digital",
        "Aluguel Comercial",
        "Serviços Terceiros",
        "Contabilidade",
        "Transportadora",
        "Energia",
        "Internet",
        "Planos e Benefícios",
        "IA",
        "CMV Produto Físico",
        "Variável",
        "Outros",
      ],
      despesa_categoria_pessoal: [
        "Aluguéis/Financiamentos",
        "Investimentos",
        "Despesas Casa",
        "Lazer",
        "Alimentação",
        "Saúde/Farmácia",
        "Vestuário",
        "Transporte",
        "Pet",
        "Estética",
        "Outros",
      ],
      evento_despesa_categoria: ["Fechado", "Precisa Fechar", "Pago/Presente"],
      periodicidade: ["Semanal", "Quinzenal", "Mensal"],
      plataforma_origem: ["Hotmart", "Kiwify", "Eduzz", "Direto Pix", "Outro"],
      produto_categoria: [
        "Mentoria Outsider",
        "Mentoria Digital Beauty",
        "Consultoria Premium",
        "Consultoria Express",
        "Curso/Formação",
        "Ferramenta",
        "Apostila",
        "Produto Físico",
        "Renovação Mentoria",
        "Outros",
      ],
      status_despesa: ["A Vencer", "Pago", "Em Atraso", "Parcialmente Pago"],
      status_parcela: ["Pendente", "Quitado", "Atraso", "Parcialmente Pago"],
      tipo_despesa: ["Fixa", "Variável"],
    },
  },
} as const
