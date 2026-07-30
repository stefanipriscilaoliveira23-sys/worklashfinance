ALTER TABLE public.produtos_catalogo
  ADD COLUMN IF NOT EXISTS o_que_e text,
  ADD COLUMN IF NOT EXISTS como_funciona text,
  ADD COLUMN IF NOT EXISTS para_quem text,
  ADD COLUMN IF NOT EXISTS para_quem_nao text,
  ADD COLUMN IF NOT EXISTS entregaveis text,
  ADD COLUMN IF NOT EXISTS modulos_aulas text,
  ADD COLUMN IF NOT EXISTS diferenciais text,
  ADD COLUMN IF NOT EXISTS explicacao_comercial text,
  ADD COLUMN IF NOT EXISTS persona text,
  ADD COLUMN IF NOT EXISTS link_pagamento text;

-- atualiza os que já existem (match por nome)
UPDATE public.produtos_catalogo pc
SET o_que_e = COALESCE(pc.o_que_e, x.o_que_e),
    como_funciona = COALESCE(pc.como_funciona, x.como_funciona),
    para_quem = COALESCE(pc.para_quem, x.para_quem),
    para_quem_nao = COALESCE(pc.para_quem_nao, x.para_quem_nao),
    entregaveis = COALESCE(pc.entregaveis, x.entregaveis),
    modulos_aulas = COALESCE(pc.modulos_aulas, x.modulos_aulas),
    diferenciais = COALESCE(pc.diferenciais, x.diferenciais),
    explicacao_comercial = COALESCE(pc.explicacao_comercial, x.explicacao_comercial),
    persona = COALESCE(pc.persona, x.persona),
    link_pagamento = COALESCE(pc.link_pagamento, x.link_pagamento)
FROM public.produtos_cursos x
WHERE lower(trim(pc.nome)) = lower(trim(x.nome));

-- cria os que ainda não existem no catálogo
INSERT INTO public.produtos_catalogo (nome, categoria, ativo, o_que_e, como_funciona, para_quem, para_quem_nao, entregaveis, modulos_aulas, diferenciais, explicacao_comercial, persona, link_pagamento)
SELECT x.nome, 'Digitais'::produto_categoria, COALESCE(x.ativo, true), x.o_que_e, x.como_funciona, x.para_quem, x.para_quem_nao, x.entregaveis, x.modulos_aulas, x.diferenciais, x.explicacao_comercial, x.persona, x.link_pagamento
FROM public.produtos_cursos x
WHERE NOT EXISTS (
  SELECT 1 FROM public.produtos_catalogo pc WHERE lower(trim(pc.nome)) = lower(trim(x.nome))
);