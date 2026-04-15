
-- Add new columns to despesas_empresa
ALTER TABLE public.despesas_empresa
  ADD COLUMN IF NOT EXISTS total_parcelas integer,
  ADD COLUMN IF NOT EXISTS numero_parcela_atual integer,
  ADD COLUMN IF NOT EXISTS despesa_pai_id uuid REFERENCES public.despesas_empresa(id) ON DELETE CASCADE;

-- Create despesas_parcelas table
CREATE TABLE public.despesas_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  despesa_id uuid NOT NULL REFERENCES public.despesas_empresa(id) ON DELETE CASCADE,
  numero_parcela integer NOT NULL,
  total_parcelas integer NOT NULL,
  data_vencimento date NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  status public.status_despesa DEFAULT 'A Vencer',
  data_pagamento date,
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.despesas_parcelas ENABLE ROW LEVEL SECURITY;

-- RLS policies (admin only, same as despesas_empresa)
CREATE POLICY "Admin can read desp parcelas"
  ON public.despesas_parcelas FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert desp parcelas"
  ON public.despesas_parcelas FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update desp parcelas"
  ON public.despesas_parcelas FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete desp parcelas"
  ON public.despesas_parcelas FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Update atualizar_despesas_atrasadas to include parcelas
CREATE OR REPLACE FUNCTION public.atualizar_despesas_atrasadas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE despesas_empresa
  SET status = 'Em Atraso'
  WHERE data_vencimento < CURRENT_DATE
    AND status IN ('A Vencer', 'Parcialmente Pago');

  UPDATE despesas_pessoal
  SET status = 'Em Atraso'
  WHERE data_vencimento < CURRENT_DATE
    AND status IN ('A Vencer', 'Parcialmente Pago');

  UPDATE despesas_parcelas
  SET status = 'Em Atraso'
  WHERE data_vencimento < CURRENT_DATE
    AND status IN ('A Vencer', 'Parcialmente Pago');
END;
$$;
