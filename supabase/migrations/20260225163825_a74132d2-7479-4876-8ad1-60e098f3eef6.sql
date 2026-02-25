ALTER TABLE public.receitas 
  ADD COLUMN IF NOT EXISTS valor_contrato numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_inicio_mentoria date;