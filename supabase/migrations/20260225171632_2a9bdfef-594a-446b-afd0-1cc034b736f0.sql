
DROP POLICY "Admins can delete receitas" ON public.receitas;
CREATE POLICY "Authenticated can delete receitas" ON public.receitas FOR DELETE USING (true);
