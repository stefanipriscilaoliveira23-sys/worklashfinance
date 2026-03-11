
CREATE TABLE public.eventos_presentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos_especiais(id) ON DELETE CASCADE,
  de_quem text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  data_recebimento date,
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.eventos_presentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read ev presentes" ON public.eventos_presentes FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert ev presentes" ON public.eventos_presentes FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update ev presentes" ON public.eventos_presentes FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete ev presentes" ON public.eventos_presentes FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
