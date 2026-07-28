CREATE POLICY "Administrativo can manage produtos" ON public.produtos_catalogo
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'administrativo'::app_role))
WITH CHECK (has_role(auth.uid(), 'administrativo'::app_role));