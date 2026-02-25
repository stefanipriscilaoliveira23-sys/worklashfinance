
-- Add checkout source column to receitas for UTM/ad tracking
ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS src_checkout text;
ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS sck text;
