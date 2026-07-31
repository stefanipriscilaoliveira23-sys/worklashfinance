ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_receitas_cliente_id ON public.receitas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_mentoria_cliente_id ON public.parcelas_mentoria (cliente_id);