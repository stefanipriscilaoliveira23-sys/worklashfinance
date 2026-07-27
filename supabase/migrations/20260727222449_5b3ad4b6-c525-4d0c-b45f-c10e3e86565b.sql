
-- 1) Enums novos para o módulo de dívidas
DO $$ BEGIN
  CREATE TYPE public.divida_tipo AS ENUM (
    'Empréstimo bancário','Financiamento','Cartão de crédito','Cheque especial',
    'Fornecedor','Imposto','Pessoa física','Outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.divida_prioridade AS ENUM ('Alta','Média','Baixa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Campos novos em dividas (todos nullable para preservar dados existentes)
ALTER TABLE public.dividas
  ADD COLUMN IF NOT EXISTS tipo public.divida_tipo,
  ADD COLUMN IF NOT EXISTS prioridade public.divida_prioridade,
  ADD COLUMN IF NOT EXISTS juros_mensal_percentual numeric,
  ADD COLUMN IF NOT EXISTS qtd_parcelas_contratadas integer,
  ADD COLUMN IF NOT EXISTS parcelas_pagas integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_parcela_mensal numeric,
  ADD COLUMN IF NOT EXISTS garantia text,
  ADD COLUMN IF NOT EXISTS saldo_atual numeric,
  ADD COLUMN IF NOT EXISTS proximo_vencimento date,
  ADD COLUMN IF NOT EXISTS despesa_empresa_id uuid REFERENCES public.despesas_empresa(id) ON DELETE SET NULL;

-- 3) Tabela de amortizações
CREATE TABLE IF NOT EXISTS public.dividas_amortizacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  divida_id uuid NOT NULL REFERENCES public.dividas(id) ON DELETE CASCADE,
  data_pagamento date NOT NULL,
  valor_pago numeric NOT NULL,
  juros_periodo numeric,
  principal_amortizado numeric,
  saldo_apos numeric,
  observacao text,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dividas_amortizacoes TO authenticated;
GRANT ALL ON public.dividas_amortizacoes TO service_role;

ALTER TABLE public.dividas_amortizacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins visualizam amortizações de dívidas"
  ON public.dividas_amortizacoes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins criam amortizações de dívidas"
  ON public.dividas_amortizacoes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins editam amortizações de dívidas"
  ON public.dividas_amortizacoes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins excluem amortizações de dívidas"
  ON public.dividas_amortizacoes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_dividas_amortizacoes_divida
  ON public.dividas_amortizacoes(divida_id, data_pagamento DESC);
