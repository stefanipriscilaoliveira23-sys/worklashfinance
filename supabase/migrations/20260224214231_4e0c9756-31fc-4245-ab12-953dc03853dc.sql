
-- Add produto_id column to parcelas_mentoria to link to specific catalog product
ALTER TABLE public.parcelas_mentoria
ADD COLUMN produto_id uuid REFERENCES public.produtos_catalogo(id);

-- Populate produto_id for existing records where there's a 1:1 category-to-product mapping
UPDATE public.parcelas_mentoria pm
SET produto_id = pc.id
FROM public.produtos_catalogo pc
WHERE pc.categoria = pm.tipo_mentoria
  AND pc.ativo = true
  AND pm.tipo_mentoria NOT IN ('Renovação Mentoria')
  AND pm.produto_id IS NULL;
