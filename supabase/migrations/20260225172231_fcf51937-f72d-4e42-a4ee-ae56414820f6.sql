
ALTER TABLE public.parcelas_mentoria DROP CONSTRAINT parcelas_mentoria_receita_id_fkey;
ALTER TABLE public.parcelas_mentoria ADD CONSTRAINT parcelas_mentoria_receita_id_fkey 
  FOREIGN KEY (receita_id) REFERENCES public.receitas(id) ON DELETE SET NULL;
