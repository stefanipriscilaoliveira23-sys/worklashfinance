CREATE TABLE public.processos_etapa (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  etapa text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  ordem integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.processos_etapa TO authenticated;
GRANT ALL ON public.processos_etapa TO service_role;

ALTER TABLE public.processos_etapa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem ver processos"
  ON public.processos_etapa FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados podem gerenciar processos"
  ON public.processos_etapa FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_processos_etapa_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_processos_etapa_updated_at
BEFORE UPDATE ON public.processos_etapa
FOR EACH ROW EXECUTE FUNCTION public.update_processos_etapa_updated_at();

ALTER TABLE public.mentorada_tarefas
  ADD COLUMN IF NOT EXISTS etapa text,
  ADD COLUMN IF NOT EXISTS processo_id uuid;

ALTER TABLE public.mentoradas
  ADD COLUMN IF NOT EXISTS receita_id uuid;

UPDATE public.mentorada_tarefas SET etapa = 'Onboarding' WHERE etapa IS NULL;

UPDATE public.mentoradas SET status_jornada = 'Ativa'
  WHERE status_jornada IN ('Em andamento', 'Acompanhamento');

INSERT INTO public.processos_etapa (etapa, titulo, descricao, ordem)
VALUES
  ('Onboarding', 'Enviar mensagem de boas-vindas', 'Ação da equipe', 1),
  ('Onboarding', 'Enviar contrato para assinatura', 'Ação da equipe', 2),
  ('Onboarding', 'Confirmar assinatura do contrato', 'Ação da equipe', 3),
  ('Onboarding', 'Liberar acesso à plataforma', 'Ação da equipe', 4),
  ('Onboarding', 'Adicionar no grupo de alunas', 'Ação da equipe', 5),
  ('Onboarding', 'Enviar formulário de onboarding', 'Ação da equipe', 6),
  ('Onboarding', 'Preencher formulário de onboarding', 'Ação para a mentorada', 7),
  ('Onboarding', 'Agendar call de boas-vindas', 'Ação da equipe', 8),
  ('Onboarding', 'Montar plano de ação inicial', 'Ação da equipe', 9),
  ('Onboarding', 'Registrar mentorada no financeiro', 'Ação da equipe', 10);