-- Permitir que usuários autenticados possam manter a meta mensal pelo Dashboard
-- (mantém leitura já existente e preserva exclusão apenas para admin)
DROP POLICY IF EXISTS "Admins can manage metas" ON public.metas;

CREATE POLICY "Authenticated can insert metas"
ON public.metas
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update metas"
ON public.metas
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can delete metas"
ON public.metas
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));