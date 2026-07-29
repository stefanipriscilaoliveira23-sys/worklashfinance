
CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'geral',
  link_interno text,
  lida boolean NOT NULL DEFAULT false,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select_own" ON public.notificacoes FOR SELECT TO authenticated USING (destinatario_id = auth.uid());
CREATE POLICY "notif_insert_auth" ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notif_update_own" ON public.notificacoes FOR UPDATE TO authenticated USING (destinatario_id = auth.uid());
CREATE POLICY "notif_delete_own" ON public.notificacoes FOR DELETE TO authenticated USING (destinatario_id = auth.uid());
CREATE INDEX idx_notif_dest ON public.notificacoes(destinatario_id, lida, created_at DESC);

CREATE TABLE public.mentoradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  instagram text,
  email text,
  telefone text,
  cpf text,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  programa text NOT NULL DEFAULT 'Educadora Outsider',
  prazo_meses integer NOT NULL DEFAULT 3,
  data_inicio date,
  data_termino date,
  valor_mentoria numeric DEFAULT 0,
  forma_pagamento text[] DEFAULT '{}',
  vendedor text,
  proxima_parcela date,
  qtd_renovacoes integer NOT NULL DEFAULT 0,
  data_saida date,
  status_jornada text NOT NULL DEFAULT 'Onboarding',
  motivo_cancelamento text,
  status_cobranca text DEFAULT 'Em dia',
  status_renovacao text DEFAULT 'Não venceu',
  link_plano_acao text,
  link_briefing text,
  link_formulario_onboarding text,
  contrato_url text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentoradas TO authenticated;
GRANT ALL ON public.mentoradas TO service_role;
ALTER TABLE public.mentoradas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mentoradas_all_auth" ON public.mentoradas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.mentorada_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorada_id uuid NOT NULL REFERENCES public.mentoradas(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  categoria text NOT NULL DEFAULT 'Ação para a mentorada',
  ordem integer NOT NULL DEFAULT 0,
  concluida boolean NOT NULL DEFAULT false,
  concluida_em timestamptz,
  responsavel uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentorada_tarefas TO authenticated;
GRANT ALL ON public.mentorada_tarefas TO service_role;
ALTER TABLE public.mentorada_tarefas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mt_all_auth" ON public.mentorada_tarefas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.mentorada_acompanhamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorada_id uuid NOT NULL REFERENCES public.mentoradas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  data_prevista date,
  feito boolean NOT NULL DEFAULT false,
  feito_em timestamptz,
  canal text,
  observacao text,
  responsavel uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentorada_acompanhamentos TO authenticated;
GRANT ALL ON public.mentorada_acompanhamentos TO service_role;
ALTER TABLE public.mentorada_acompanhamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ma_all_auth" ON public.mentorada_acompanhamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.mentorada_interacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorada_id uuid NOT NULL REFERENCES public.mentoradas(id) ON DELETE CASCADE,
  data timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL DEFAULT 'Nota',
  conteudo text NOT NULL,
  autor text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentorada_interacoes TO authenticated;
GRANT ALL ON public.mentorada_interacoes TO service_role;
ALTER TABLE public.mentorada_interacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mi_all_auth" ON public.mentorada_interacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.mensagens_modelo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL UNIQUE,
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagens_modelo TO authenticated;
GRANT ALL ON public.mensagens_modelo TO service_role;
ALTER TABLE public.mensagens_modelo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mm_all_auth" ON public.mensagens_modelo FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.mensagens_modelo (tipo, texto) VALUES
('D+3', 'Oii [Nome], tudo certo com seu acesso na mentoria? Conseguiu entrar na plataforma e ver as primeiras aulas? 😊'),
('D+7', 'Oi [Nome], já conseguiu avançar nos conteúdos iniciais? Se precisar de algo, estou aqui para te ajudar! 💜'),
('Planejamento mensal', 'Oii [Nome], como foi seu progresso no mês passado? Alguma dificuldade ou ponto que quer ajustar nesse próximo mês? Vamos garantir que você esteja no caminho certo! 💪'),
('Resgate 15 dias', 'Oi [Nome], percebi que você não tem interagido tanto na mentoria. Está tudo bem? Se precisar de ajuda ou ajuste no seu plano, estou aqui para te apoiar! 💜'),
('Resgate follow-up', 'Oi [Nome], senti sua falta por aqui! Sei que às vezes a rotina fica puxada, mas me avise se puder te ajudar. Quero garantir que você aproveite ao máximo sua jornada! ✨'),
('Destaque', '[Nome], vi seu progresso e estou super orgulhosa! 🎉 Quer compartilhar sua experiência com o grupo? Isso pode motivar muitas pessoas!'),
('Renovação 1 mês', 'Oii [Nome], sua mentoria está chegando na reta final! Bora conversar sobre os próximos passos e sua renovação? 💜'),
('Renovação 1 semana', 'Oi [Nome], falta pouquinho para sua mentoria encerrar. Vamos alinhar sua renovação para você não perder o ritmo? ✨');

CREATE TABLE public.agenda_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  duracao_minutos integer NOT NULL DEFAULT 60,
  descricao text,
  titulo_pagina text,
  subtitulo_pagina text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_tipos TO authenticated;
GRANT SELECT ON public.agenda_tipos TO anon;
GRANT ALL ON public.agenda_tipos TO service_role;
ALTER TABLE public.agenda_tipos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "at_all_auth" ON public.agenda_tipos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "at_select_anon" ON public.agenda_tipos FOR SELECT TO anon USING (ativo = true);

CREATE TABLE public.agenda_disponibilidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id uuid NOT NULL REFERENCES public.agenda_tipos(id) ON DELETE CASCADE,
  dia_semana integer NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_disponibilidade TO authenticated;
GRANT SELECT ON public.agenda_disponibilidade TO anon;
GRANT ALL ON public.agenda_disponibilidade TO service_role;
ALTER TABLE public.agenda_disponibilidade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_all_auth" ON public.agenda_disponibilidade FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ad_select_anon" ON public.agenda_disponibilidade FOR SELECT TO anon USING (true);

CREATE TABLE public.agenda_bloqueios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  hora_inicio time,
  hora_fim time,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_bloqueios TO authenticated;
GRANT SELECT ON public.agenda_bloqueios TO anon;
GRANT ALL ON public.agenda_bloqueios TO service_role;
ALTER TABLE public.agenda_bloqueios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ab_all_auth" ON public.agenda_bloqueios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ab_select_anon" ON public.agenda_bloqueios FOR SELECT TO anon USING (true);

CREATE TABLE public.agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id uuid REFERENCES public.agenda_tipos(id) ON DELETE SET NULL,
  nome text NOT NULL,
  whatsapp text,
  instagram text,
  mentorada_id uuid REFERENCES public.mentoradas(id) ON DELETE SET NULL,
  data date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  link_reuniao text,
  responsavel uuid,
  status text NOT NULL DEFAULT 'Pendente',
  observacoes text,
  origem text NOT NULL DEFAULT 'Interno',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendamentos TO authenticated;
GRANT ALL ON public.agendamentos TO service_role;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ag_all_auth" ON public.agendamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_agendamentos_data ON public.agendamentos(data);

CREATE POLICY "contratos_read_auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'contratos-mentoria');
CREATE POLICY "contratos_insert_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contratos-mentoria');
CREATE POLICY "contratos_update_auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'contratos-mentoria');
CREATE POLICY "contratos_delete_auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'contratos-mentoria');
