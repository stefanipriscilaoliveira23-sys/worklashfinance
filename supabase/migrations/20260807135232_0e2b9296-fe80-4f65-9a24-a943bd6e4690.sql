CREATE POLICY "Authenticated can update produtos"
ON public.produtos_catalogo
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);