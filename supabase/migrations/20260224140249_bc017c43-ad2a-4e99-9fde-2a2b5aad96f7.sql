
-- Add whatsapp and instagram to clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS instagram text;

-- Add DELETE policy for clientes (admin only)
CREATE POLICY "Admins can delete clientes" ON public.clientes FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
