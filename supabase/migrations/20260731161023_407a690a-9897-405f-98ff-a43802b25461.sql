-- Receitas: vendedor, desconto e frete
ALTER TABLE public.receitas
  ADD COLUMN IF NOT EXISTS vendedor text,
  ADD COLUMN IF NOT EXISTS desconto_percentual numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_valor numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frete_valor numeric DEFAULT 0;

-- Etapas editáveis por pipeline
CREATE TABLE IF NOT EXISTS public.pipeline_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_etapas TO authenticated;
GRANT SELECT ON public.pipeline_etapas TO anon;
GRANT ALL ON public.pipeline_etapas TO service_role;

ALTER TABLE public.pipeline_etapas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipeline_etapas_select" ON public.pipeline_etapas;
CREATE POLICY "pipeline_etapas_select" ON public.pipeline_etapas FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "pipeline_etapas_write" ON public.pipeline_etapas;
CREATE POLICY "pipeline_etapas_write" ON public.pipeline_etapas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Processos vinculados à pipeline
ALTER TABLE public.processos_etapa
  ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE CASCADE;

-- Seed: etapas padrão para pipelines que ainda não têm etapas
INSERT INTO public.pipeline_etapas (pipeline_id, nome, ordem)
SELECT p.id, e.nome, e.ord
FROM public.pipelines p
CROSS JOIN (VALUES
  ('Onboarding',1),('Ativa',2),('Em risco',3),('Renovação',4),
  ('Inativa',5),('Cancelada',6),('Concluída',7)
) AS e(nome, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.pipeline_etapas pe WHERE pe.pipeline_id = p.id);

-- Processos existentes ficam na primeira pipeline
UPDATE public.processos_etapa
SET pipeline_id = (SELECT id FROM public.pipelines ORDER BY ordem LIMIT 1)
WHERE pipeline_id IS NULL;