CREATE TABLE IF NOT EXISTS public.import_contatos (
  id bigserial PRIMARY KEY,
  nome text,
  email text,
  telefone text,
  digits text,
  tags text[] DEFAULT '{}'::text[]
);
GRANT ALL ON public.import_contatos TO service_role;
GRANT ALL ON SEQUENCE public.import_contatos_id_seq TO service_role;
ALTER TABLE public.import_contatos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_import_contatos_email ON public.import_contatos (email);
CREATE INDEX IF NOT EXISTS idx_import_contatos_digits ON public.import_contatos (digits);