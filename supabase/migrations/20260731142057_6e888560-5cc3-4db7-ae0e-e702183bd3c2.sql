ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[];
CREATE INDEX IF NOT EXISTS idx_clientes_email_lower ON public.clientes (lower(email));
CREATE INDEX IF NOT EXISTS idx_clientes_telefone_digits ON public.clientes (regexp_replace(coalesce(telefone,''), '\D', '', 'g'));
CREATE INDEX IF NOT EXISTS idx_clientes_nome_lower ON public.clientes (lower(nome));