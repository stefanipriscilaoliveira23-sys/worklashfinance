
CREATE POLICY "Authenticated can insert produtos"
  ON public.produtos_catalogo
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
