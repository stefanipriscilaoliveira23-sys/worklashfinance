
-- Create clientes table
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read clientes"
ON public.clientes FOR SELECT
USING (true);

CREATE POLICY "Authenticated can insert clientes"
ON public.clientes FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated can update clientes"
ON public.clientes FOR UPDATE
USING (true);

-- Add cliente_id FK to parcelas_mentoria
ALTER TABLE public.parcelas_mentoria
ADD COLUMN cliente_id UUID REFERENCES public.clientes(id);
