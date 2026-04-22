-- 1. Sequence for sequential contract numbers
CREATE SEQUENCE IF NOT EXISTS public.parcelas_mentoria_num_seq START 1;

-- 2. Add numero_contrato column
ALTER TABLE public.parcelas_mentoria
  ADD COLUMN IF NOT EXISTS numero_contrato text UNIQUE;

-- 3. Backfill existing rows in creation order
DO $$
DECLARE
  r RECORD;
  n INT := 0;
BEGIN
  FOR r IN SELECT id FROM public.parcelas_mentoria WHERE numero_contrato IS NULL ORDER BY criado_em ASC, id ASC
  LOOP
    n := n + 1;
    UPDATE public.parcelas_mentoria
       SET numero_contrato = '#WL2026' || LPAD(n::text, 3, '0')
     WHERE id = r.id;
  END LOOP;
  -- Advance sequence past backfilled count
  PERFORM setval('public.parcelas_mentoria_num_seq', GREATEST(n, 1), true);
END $$;

-- 4. Trigger to auto-generate numero_contrato on insert
CREATE OR REPLACE FUNCTION public.gerar_numero_contrato()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prox INT;
BEGIN
  IF NEW.numero_contrato IS NULL OR NEW.numero_contrato = '' THEN
    prox := nextval('public.parcelas_mentoria_num_seq');
    NEW.numero_contrato := '#WL2026' || LPAD(prox::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gerar_numero_contrato ON public.parcelas_mentoria;
CREATE TRIGGER trg_gerar_numero_contrato
BEFORE INSERT ON public.parcelas_mentoria
FOR EACH ROW EXECUTE FUNCTION public.gerar_numero_contrato();