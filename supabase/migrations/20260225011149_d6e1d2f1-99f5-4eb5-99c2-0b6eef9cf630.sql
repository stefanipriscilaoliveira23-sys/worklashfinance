
ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS importado boolean NOT NULL DEFAULT false;
