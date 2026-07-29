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
      agenda_bloqueios: {
        Row: {
          created_at: string
          data: string
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          motivo: string | null
        }
        Insert: {
          created_at?: string
          data: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          motivo?: string | null
        }
        Update: {
          created_at?: string
          data?: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          motivo?: string | null
        }
        Relationships: []
      }
      agenda_disponibilidade: {
        Row: {
          created_at: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id: string
          tipo_id: string
        }
        Insert: {
          created_at?: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id?: string
          tipo_id: string
        }
        Update: {
          created_at?: string
          dia_semana?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          tipo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_disponibilidade_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "agenda_tipos"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_tipos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          duracao_minutos: number
          id: string
          nome: string
          slug: string
          subtitulo_pagina: string | null
          titulo_pagina: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number
          id?: string
          nome: string
          slug: string
          subtitulo_pagina?: string | null
          titulo_pagina?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number
          id?: string
          nome?: string
          slug?: string
          subtitulo_pagina?: string | null
          titulo_pagina?: string | null
        }
        Relationships: []
      }
      agendamentos: {
        Row: {
          created_at: string
          data: string
          hora_fim: string
          hora_inicio: string
          id: string
          instagram: string | null
          link_reuniao: string | null
          mentorada_id: string | null
          nome: string
          observacoes: string | null
          origem: string
          responsavel: string | null
          status: string
          tipo_id: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          data: string
          hora_fim: string
          hora_inicio: string
          id?: string
          instagram?: string | null
          link_reuniao?: string | null
          mentorada_id?: string | null
          nome: string
          observacoes?: string | null
          origem?: string
          responsavel?: string | null
          status?: string
          tipo_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          data?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          instagram?: string | null
          link_reuniao?: string | null
          mentorada_id?: string | null
          nome?: string
          observacoes?: string | null
          origem?: string
          responsavel?: string | null
          status?: string
          tipo_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_mentorada_id_fkey"
            columns: ["mentorada_id"]
            isOneToOne: false
            referencedRelation: "mentoradas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "agenda_tipos"
            referencedColumns: ["id"]
          },
        ]
      }
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
      cofrinho: {
        Row: {
          criado_em: string
          data: string
          id: string
          observacao: string | null
          valor: number
        }
        Insert: {
          criado_em?: string
          data: string
          id?: string
          observacao?: string | null
          valor?: number
        }
        Update: {
          criado_em?: string
          data?: string
          id?: string
          observacao?: string | null
          valor?: number
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
          despesa_pai_id: string | null
          forma_pagamento: string | null
          id: string
          numero_parcela_atual: number | null
          observacao: string | null
          prioridade: Database["public"]["Enums"]["prioridade_despesa"]
          saldo_pendente: number | null
          status: Database["public"]["Enums"]["status_despesa"] | null
          tipo_despesa: Database["public"]["Enums"]["tipo_despesa"]
          total_parcelas: number | null
          valor_original: number
          valor_pago_total: number | null
        }
        Insert: {
          categoria: Database["public"]["Enums"]["despesa_categoria_empresa"]
          criado_em?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          despesa_pai_id?: string | null
          forma_pagamento?: string | null
          id?: string
          numero_parcela_atual?: number | null
          observacao?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_despesa"]
          saldo_pendente?: number | null
          status?: Database["public"]["Enums"]["status_despesa"] | null
          tipo_despesa?: Database["public"]["Enums"]["tipo_despesa"]
          total_parcelas?: number | null
          valor_original?: number
          valor_pago_total?: number | null
        }
        Update: {
          categoria?: Database["public"]["Enums"]["despesa_categoria_empresa"]
          criado_em?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          despesa_pai_id?: string | null
          forma_pagamento?: string | null
          id?: string
          numero_parcela_atual?: number | null
          observacao?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_despesa"]
          saldo_pendente?: number | null
          status?: Database["public"]["Enums"]["status_despesa"] | null
          tipo_despesa?: Database["public"]["Enums"]["tipo_despesa"]
          total_parcelas?: number | null
          valor_original?: number
          valor_pago_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "despesas_empresa_despesa_pai_id_fkey"
            columns: ["despesa_pai_id"]
            isOneToOne: false
            referencedRelation: "despesas_empresa"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_parcelas: {
        Row: {
          criado_em: string
          data_pagamento: string | null
          data_vencimento: string
          despesa_id: string
          id: string
          numero_parcela: number
          observacao: string | null
          status: Database["public"]["Enums"]["status_despesa"] | null
          total_parcelas: number
          valor: number
        }
        Insert: {
          criado_em?: string
          data_pagamento?: string | null
          data_vencimento: string
          despesa_id: string
          id?: string
          numero_parcela: number
          observacao?: string | null
          status?: Database["public"]["Enums"]["status_despesa"] | null
          total_parcelas: number
          valor?: number
        }
        Update: {
          criado_em?: string
          data_pagamento?: string | null
          data_vencimento?: string
          despesa_id?: string
          id?: string
          numero_parcela?: number
          observacao?: string | null
          status?: Database["public"]["Enums"]["status_despesa"] | null
          total_parcelas?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_parcelas_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "despesas_empresa"
            referencedColumns: ["id"]
          },
        ]
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
          prioridade: Database["public"]["Enums"]["prioridade_despesa"]
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
          prioridade?: Database["public"]["Enums"]["prioridade_despesa"]
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
          prioridade?: Database["public"]["Enums"]["prioridade_despesa"]
          saldo_pendente?: number | null
          status?: Database["public"]["Enums"]["status_despesa"] | null
          tipo_despesa?: Database["public"]["Enums"]["tipo_despesa"]
          valor_original?: number
          valor_pago_total?: number | null
        }
        Relationships: []
      }
      dividas: {
        Row: {
          atualizado_em: string
          credor: string | null
          credor_nao_identificado: boolean
          criado_em: string
          dados_faltando: string | null
          data_valor_informado: string | null
          descricao: string
          despesa_empresa_id: string | null
          documentos_disponiveis: string | null
          garantia: string | null
          id: string
          juros_mensal_percentual: number | null
          observacoes: string | null
          parcelas_pagas: number | null
          prioridade: Database["public"]["Enums"]["divida_prioridade"] | null
          proxima_acao:
            | Database["public"]["Enums"]["divida_proxima_acao"]
            | null
          proxima_acao_prazo: string | null
          proximo_vencimento: string | null
          qtd_parcelas_contratadas: number | null
          responsavel: string | null
          saldo_atual: number | null
          situacao: Database["public"]["Enums"]["divida_situacao"]
          situacao_contato: string | null
          tipo: Database["public"]["Enums"]["divida_tipo"] | null
          valor_aproximado: number | null
          valor_parcela_mensal: number | null
          valor_precisao: Database["public"]["Enums"]["divida_valor_precisao"]
        }
        Insert: {
          atualizado_em?: string
          credor?: string | null
          credor_nao_identificado?: boolean
          criado_em?: string
          dados_faltando?: string | null
          data_valor_informado?: string | null
          descricao: string
          despesa_empresa_id?: string | null
          documentos_disponiveis?: string | null
          garantia?: string | null
          id?: string
          juros_mensal_percentual?: number | null
          observacoes?: string | null
          parcelas_pagas?: number | null
          prioridade?: Database["public"]["Enums"]["divida_prioridade"] | null
          proxima_acao?:
            | Database["public"]["Enums"]["divida_proxima_acao"]
            | null
          proxima_acao_prazo?: string | null
          proximo_vencimento?: string | null
          qtd_parcelas_contratadas?: number | null
          responsavel?: string | null
          saldo_atual?: number | null
          situacao?: Database["public"]["Enums"]["divida_situacao"]
          situacao_contato?: string | null
          tipo?: Database["public"]["Enums"]["divida_tipo"] | null
          valor_aproximado?: number | null
          valor_parcela_mensal?: number | null
          valor_precisao?: Database["public"]["Enums"]["divida_valor_precisao"]
        }
        Update: {
          atualizado_em?: string
          credor?: string | null
          credor_nao_identificado?: boolean
          criado_em?: string
          dados_faltando?: string | null
          data_valor_informado?: string | null
          descricao?: string
          despesa_empresa_id?: string | null
          documentos_disponiveis?: string | null
          garantia?: string | null
          id?: string
          juros_mensal_percentual?: number | null
          observacoes?: string | null
          parcelas_pagas?: number | null
          prioridade?: Database["public"]["Enums"]["divida_prioridade"] | null
          proxima_acao?:
            | Database["public"]["Enums"]["divida_proxima_acao"]
            | null
          proxima_acao_prazo?: string | null
          proximo_vencimento?: string | null
          qtd_parcelas_contratadas?: number | null
          responsavel?: string | null
          saldo_atual?: number | null
          situacao?: Database["public"]["Enums"]["divida_situacao"]
          situacao_contato?: string | null
          tipo?: Database["public"]["Enums"]["divida_tipo"] | null
          valor_aproximado?: number | null
          valor_parcela_mensal?: number | null
          valor_precisao?: Database["public"]["Enums"]["divida_valor_precisao"]
        }
        Relationships: [
          {
            foreignKeyName: "dividas_despesa_empresa_id_fkey"
            columns: ["despesa_empresa_id"]
            isOneToOne: false
            referencedRelation: "despesas_empresa"
            referencedColumns: ["id"]
          },
        ]
      }
      dividas_amortizacoes: {
        Row: {
          criado_em: string
          data_pagamento: string
          divida_id: string
          id: string
          juros_periodo: number | null
          observacao: string | null
          principal_amortizado: number | null
          saldo_apos: number | null
          valor_pago: number
        }
        Insert: {
          criado_em?: string
          data_pagamento: string
          divida_id: string
          id?: string
          juros_periodo?: number | null
          observacao?: string | null
          principal_amortizado?: number | null
          saldo_apos?: number | null
          valor_pago: number
        }
        Update: {
          criado_em?: string
          data_pagamento?: string
          divida_id?: string
          id?: string
          juros_periodo?: number | null
          observacao?: string | null
          principal_amortizado?: number | null
          saldo_apos?: number | null
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "dividas_amortizacoes_divida_id_fkey"
            columns: ["divida_id"]
            isOneToOne: false
            referencedRelation: "dividas"
            referencedColumns: ["id"]
          },
        ]
      }
      dividas_historico: {
        Row: {
          canal: Database["public"]["Enums"]["divida_contato_canal"] | null
          criado_em: string
          data_contato: string
          desconto_oferecido: number | null
          divida_id: string
          entrada_solicitada: number | null
          id: string
          observacoes: string | null
          pessoa_contatada: string | null
          protocolo: string | null
          qtd_parcelas: number | null
          saldo_informado: number | null
          validade_proposta: string | null
          valor_a_vista: number | null
          valor_parcela: number | null
        }
        Insert: {
          canal?: Database["public"]["Enums"]["divida_contato_canal"] | null
          criado_em?: string
          data_contato?: string
          desconto_oferecido?: number | null
          divida_id: string
          entrada_solicitada?: number | null
          id?: string
          observacoes?: string | null
          pessoa_contatada?: string | null
          protocolo?: string | null
          qtd_parcelas?: number | null
          saldo_informado?: number | null
          validade_proposta?: string | null
          valor_a_vista?: number | null
          valor_parcela?: number | null
        }
        Update: {
          canal?: Database["public"]["Enums"]["divida_contato_canal"] | null
          criado_em?: string
          data_contato?: string
          desconto_oferecido?: number | null
          divida_id?: string
          entrada_solicitada?: number | null
          id?: string
          observacoes?: string | null
          pessoa_contatada?: string | null
          protocolo?: string | null
          qtd_parcelas?: number | null
          saldo_informado?: number | null
          validade_proposta?: string | null
          valor_a_vista?: number | null
          valor_parcela?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dividas_historico_divida_id_fkey"
            columns: ["divida_id"]
            isOneToOne: false
            referencedRelation: "dividas"
            referencedColumns: ["id"]
          },
        ]
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
      eventos_presentes: {
        Row: {
          criado_em: string
          data_recebimento: string | null
          de_quem: string
          evento_id: string
          id: string
          observacao: string | null
          valor: number
        }
        Insert: {
          criado_em?: string
          data_recebimento?: string | null
          de_quem: string
          evento_id: string
          id?: string
          observacao?: string | null
          valor?: number
        }
        Update: {
          criado_em?: string
          data_recebimento?: string | null
          de_quem?: string
          evento_id?: string
          id?: string
          observacao?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "eventos_presentes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_especiais"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_modelo: {
        Row: {
          created_at: string
          id: string
          texto: string
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          texto: string
          tipo: string
        }
        Update: {
          created_at?: string
          id?: string
          texto?: string
          tipo?: string
        }
        Relationships: []
      }
      mentorada_acompanhamentos: {
        Row: {
          canal: string | null
          created_at: string
          data_prevista: string | null
          feito: boolean
          feito_em: string | null
          id: string
          mentorada_id: string
          observacao: string | null
          responsavel: string | null
          tipo: string
        }
        Insert: {
          canal?: string | null
          created_at?: string
          data_prevista?: string | null
          feito?: boolean
          feito_em?: string | null
          id?: string
          mentorada_id: string
          observacao?: string | null
          responsavel?: string | null
          tipo: string
        }
        Update: {
          canal?: string | null
          created_at?: string
          data_prevista?: string | null
          feito?: boolean
          feito_em?: string | null
          id?: string
          mentorada_id?: string
          observacao?: string | null
          responsavel?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentorada_acompanhamentos_mentorada_id_fkey"
            columns: ["mentorada_id"]
            isOneToOne: false
            referencedRelation: "mentoradas"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorada_interacoes: {
        Row: {
          autor: string | null
          conteudo: string
          created_at: string
          data: string
          id: string
          mentorada_id: string
          tipo: string
        }
        Insert: {
          autor?: string | null
          conteudo: string
          created_at?: string
          data?: string
          id?: string
          mentorada_id: string
          tipo?: string
        }
        Update: {
          autor?: string | null
          conteudo?: string
          created_at?: string
          data?: string
          id?: string
          mentorada_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentorada_interacoes_mentorada_id_fkey"
            columns: ["mentorada_id"]
            isOneToOne: false
            referencedRelation: "mentoradas"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorada_tarefas: {
        Row: {
          categoria: string
          concluida: boolean
          concluida_em: string | null
          created_at: string
          descricao: string | null
          id: string
          mentorada_id: string
          ordem: number
          responsavel: string | null
          titulo: string
        }
        Insert: {
          categoria?: string
          concluida?: boolean
          concluida_em?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          mentorada_id: string
          ordem?: number
          responsavel?: string | null
          titulo: string
        }
        Update: {
          categoria?: string
          concluida?: boolean
          concluida_em?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          mentorada_id?: string
          ordem?: number
          responsavel?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentorada_tarefas_mentorada_id_fkey"
            columns: ["mentorada_id"]
            isOneToOne: false
            referencedRelation: "mentoradas"
            referencedColumns: ["id"]
          },
        ]
      }
      mentoradas: {
        Row: {
          cliente_id: string | null
          contrato_url: string | null
          cpf: string | null
          created_at: string
          data_inicio: string | null
          data_saida: string | null
          data_termino: string | null
          email: string | null
          forma_pagamento: string[] | null
          id: string
          instagram: string | null
          link_briefing: string | null
          link_formulario_onboarding: string | null
          link_plano_acao: string | null
          motivo_cancelamento: string | null
          nome: string
          observacao: string | null
          prazo_meses: number
          programa: string
          proxima_parcela: string | null
          qtd_renovacoes: number
          status_cobranca: string | null
          status_jornada: string
          status_renovacao: string | null
          telefone: string | null
          valor_mentoria: number | null
          vendedor: string | null
        }
        Insert: {
          cliente_id?: string | null
          contrato_url?: string | null
          cpf?: string | null
          created_at?: string
          data_inicio?: string | null
          data_saida?: string | null
          data_termino?: string | null
          email?: string | null
          forma_pagamento?: string[] | null
          id?: string
          instagram?: string | null
          link_briefing?: string | null
          link_formulario_onboarding?: string | null
          link_plano_acao?: string | null
          motivo_cancelamento?: string | null
          nome: string
          observacao?: string | null
          prazo_meses?: number
          programa?: string
          proxima_parcela?: string | null
          qtd_renovacoes?: number
          status_cobranca?: string | null
          status_jornada?: string
          status_renovacao?: string | null
          telefone?: string | null
          valor_mentoria?: number | null
          vendedor?: string | null
        }
        Update: {
          cliente_id?: string | null
          contrato_url?: string | null
          cpf?: string | null
          created_at?: string
          data_inicio?: string | null
          data_saida?: string | null
          data_termino?: string | null
          email?: string | null
          forma_pagamento?: string[] | null
          id?: string
          instagram?: string | null
          link_briefing?: string | null
          link_formulario_onboarding?: string | null
          link_plano_acao?: string | null
          motivo_cancelamento?: string | null
          nome?: string
          observacao?: string | null
          prazo_meses?: number
          programa?: string
          proxima_parcela?: string | null
          qtd_renovacoes?: number
          status_cobranca?: string | null
          status_jornada?: string
          status_renovacao?: string | null
          telefone?: string | null
          valor_mentoria?: number | null
          vendedor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentoradas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
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
      notificacoes: {
        Row: {
          created_at: string
          criado_por: string | null
          descricao: string | null
          destinatario_id: string
          id: string
          lida: boolean
          link_interno: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          destinatario_id: string
          id?: string
          lida?: boolean
          link_interno?: string | null
          tipo?: string
          titulo: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          destinatario_id?: string
          id?: string
          lida?: boolean
          link_interno?: string | null
          tipo?: string
          titulo?: string
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
          numero_contrato: string | null
          periodicidade: Database["public"]["Enums"]["periodicidade"]
          produto_id: string | null
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
          numero_contrato?: string | null
          periodicidade?: Database["public"]["Enums"]["periodicidade"]
          produto_id?: string | null
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
          numero_contrato?: string | null
          periodicidade?: Database["public"]["Enums"]["periodicidade"]
          produto_id?: string | null
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
            foreignKeyName: "parcelas_mentoria_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos_catalogo"
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
          data_inicio_mentoria: string | null
          forma_pagamento: string | null
          id: string
          importado: boolean
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
          sck: string | null
          src_checkout: string | null
          status: string | null
          taxa_cambio: number | null
          taxa_plataforma_percentual: number | null
          taxa_plataforma_valor: number | null
          valor_bruto: number
          valor_contrato: number | null
          valor_em_brl: number | null
          valor_liquido: number | null
        }
        Insert: {
          cliente_email?: string | null
          cliente_nome?: string | null
          criado_em?: string
          data: string
          data_fim_mentoria?: string | null
          data_inicio_mentoria?: string | null
          forma_pagamento?: string | null
          id?: string
          importado?: boolean
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
          sck?: string | null
          src_checkout?: string | null
          status?: string | null
          taxa_cambio?: number | null
          taxa_plataforma_percentual?: number | null
          taxa_plataforma_valor?: number | null
          valor_bruto?: number
          valor_contrato?: number | null
          valor_em_brl?: number | null
          valor_liquido?: number | null
        }
        Update: {
          cliente_email?: string | null
          cliente_nome?: string | null
          criado_em?: string
          data?: string
          data_fim_mentoria?: string | null
          data_inicio_mentoria?: string | null
          forma_pagamento?: string | null
          id?: string
          importado?: boolean
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
          sck?: string | null
          src_checkout?: string | null
          status?: string | null
          taxa_cambio?: number | null
          taxa_plataforma_percentual?: number | null
          taxa_plataforma_valor?: number | null
          valor_bruto?: number
          valor_contrato?: number | null
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
      agenda_slots_ocupados: {
        Args: { _data: string }
        Returns: {
          hora_fim: string
          hora_inicio: string
        }[]
      }
      atualizar_despesas_atrasadas: { Args: never; Returns: undefined }
      atualizar_parcelas_atrasadas: { Args: never; Returns: undefined }
      criar_agendamento_publico: {
        Args: {
          _data: string
          _hora_inicio: string
          _instagram: string
          _nome: string
          _slug: string
          _whatsapp: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "operacional" | "vendedor" | "administrativo"
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
      divida_contato_canal:
        | "Telefone"
        | "WhatsApp"
        | "E-mail"
        | "Presencial"
        | "Portal do credor"
        | "Carta"
        | "Outro"
      divida_prioridade: "Alta" | "Média" | "Baixa"
      divida_proxima_acao:
        | "Identificar o credor atual"
        | "Consultar saldo atualizado"
        | "Solicitar contrato"
        | "Solicitar memória de cálculo"
        | "Verificar juros e multas"
        | "Consultar possibilidade de desconto"
        | "Solicitar proposta de negociação"
        | "Comparar propostas"
        | "Negociar"
        | "Aguardar recursos"
        | "Buscar orientação jurídica"
        | "Outra"
      divida_situacao:
        | "Identificada, mas ainda não apurada"
        | "Aguardando consulta ao credor"
        | "Sem negociação"
        | "Negociação pendente"
        | "Em negociação"
        | "Acordo realizado"
        | "Parcelada"
        | "Em pagamento"
        | "Em atraso após acordo"
        | "Contestada"
        | "Prescrita ou em análise jurídica"
        | "Quitada"
      divida_tipo:
        | "Empréstimo bancário"
        | "Financiamento"
        | "Cartão de crédito"
        | "Cheque especial"
        | "Fornecedor"
        | "Imposto"
        | "Pessoa física"
        | "Outro"
      divida_valor_precisao:
        | "Exato"
        | "Aproximado"
        | "Desatualizado"
        | "Desconhecido"
        | "Aguardando confirmação do credor"
      evento_despesa_categoria: "Fechado" | "Precisa Fechar" | "Pago/Presente"
      periodicidade: "Semanal" | "Quinzenal" | "Mensal"
      plataforma_origem: "Hotmart" | "Kiwify" | "Eduzz" | "Direto Pix" | "Outro"
      prioridade_despesa: "Alta" | "Média" | "Baixa"
      produto_categoria: "Mentorias" | "Renovações" | "Digitais" | "Físicos"
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
      app_role: ["admin", "operacional", "vendedor", "administrativo"],
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
      divida_contato_canal: [
        "Telefone",
        "WhatsApp",
        "E-mail",
        "Presencial",
        "Portal do credor",
        "Carta",
        "Outro",
      ],
      divida_prioridade: ["Alta", "Média", "Baixa"],
      divida_proxima_acao: [
        "Identificar o credor atual",
        "Consultar saldo atualizado",
        "Solicitar contrato",
        "Solicitar memória de cálculo",
        "Verificar juros e multas",
        "Consultar possibilidade de desconto",
        "Solicitar proposta de negociação",
        "Comparar propostas",
        "Negociar",
        "Aguardar recursos",
        "Buscar orientação jurídica",
        "Outra",
      ],
      divida_situacao: [
        "Identificada, mas ainda não apurada",
        "Aguardando consulta ao credor",
        "Sem negociação",
        "Negociação pendente",
        "Em negociação",
        "Acordo realizado",
        "Parcelada",
        "Em pagamento",
        "Em atraso após acordo",
        "Contestada",
        "Prescrita ou em análise jurídica",
        "Quitada",
      ],
      divida_tipo: [
        "Empréstimo bancário",
        "Financiamento",
        "Cartão de crédito",
        "Cheque especial",
        "Fornecedor",
        "Imposto",
        "Pessoa física",
        "Outro",
      ],
      divida_valor_precisao: [
        "Exato",
        "Aproximado",
        "Desatualizado",
        "Desconhecido",
        "Aguardando confirmação do credor",
      ],
      evento_despesa_categoria: ["Fechado", "Precisa Fechar", "Pago/Presente"],
      periodicidade: ["Semanal", "Quinzenal", "Mensal"],
      plataforma_origem: ["Hotmart", "Kiwify", "Eduzz", "Direto Pix", "Outro"],
      prioridade_despesa: ["Alta", "Média", "Baixa"],
      produto_categoria: ["Mentorias", "Renovações", "Digitais", "Físicos"],
      status_despesa: ["A Vencer", "Pago", "Em Atraso", "Parcialmente Pago"],
      status_parcela: ["Pendente", "Quitado", "Atraso", "Parcialmente Pago"],
      tipo_despesa: ["Fixa", "Variável"],
    },
  },
} as const
