
CREATE TABLE public.anfitrioes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anfitrioes TO authenticated;
GRANT SELECT ON public.anfitrioes TO anon;
GRANT ALL ON public.anfitrioes TO service_role;
ALTER TABLE public.anfitrioes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anfitrioes equipe" ON public.anfitrioes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anfitrioes publico leitura" ON public.anfitrioes FOR SELECT TO anon USING (ativo);
INSERT INTO public.anfitrioes (nome) VALUES ('Stéfani'), ('Felipe');

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS anfitriao_id uuid REFERENCES public.anfitrioes(id),
  ADD COLUMN IF NOT EXISTS agendado_por uuid;

CREATE TABLE public.agendamento_tarefas (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid not null references public.agendamentos(id) on delete cascade,
  responsavel_id uuid,
  titulo text not null,
  concluida boolean not null default false,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendamento_tarefas TO authenticated;
GRANT ALL ON public.agendamento_tarefas TO service_role;
ALTER TABLE public.agendamento_tarefas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agendamento_tarefas equipe" ON public.agendamento_tarefas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.pipelines (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipelines TO authenticated;
GRANT ALL ON public.pipelines TO service_role;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipelines equipe" ON public.pipelines FOR ALL TO authenticated USING (true) WITH CHECK (true);
INSERT INTO public.pipelines (nome, ordem) VALUES ('Educadora Outsider', 0);

ALTER TABLE public.mentoradas ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES public.pipelines(id);
UPDATE public.mentoradas SET pipeline_id = (SELECT id FROM public.pipelines ORDER BY ordem LIMIT 1) WHERE pipeline_id IS NULL;

CREATE TABLE public.scripts (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  titulo text not null,
  texto text not null default '',
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scripts TO authenticated;
GRANT ALL ON public.scripts TO service_role;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scripts equipe" ON public.scripts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.produtos_cursos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  o_que_e text,
  como_funciona text,
  para_quem text,
  para_quem_nao text,
  entregaveis text,
  modulos_aulas text,
  diferenciais text,
  explicacao_comercial text,
  link_pagamento text,
  persona text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos_cursos TO authenticated;
GRANT ALL ON public.produtos_cursos TO service_role;
ALTER TABLE public.produtos_cursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "produtos_cursos equipe" ON public.produtos_cursos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.formularios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  link text not null default '',
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formularios TO authenticated;
GRANT ALL ON public.formularios TO service_role;
ALTER TABLE public.formularios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "formularios equipe" ON public.formularios FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.biblioteca_processos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  categoria text,
  conteudo text,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_processos TO authenticated;
GRANT ALL ON public.biblioteca_processos TO service_role;
ALTER TABLE public.biblioteca_processos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "biblioteca equipe" ON public.biblioteca_processos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.cliente_interacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null default 'nota',
  conteudo text not null,
  criado_por uuid,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_interacoes TO authenticated;
GRANT ALL ON public.cliente_interacoes TO service_role;
ALTER TABLE public.cliente_interacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cliente_interacoes equipe" ON public.cliente_interacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.cliente_documentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  nome text not null,
  url text not null,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_documentos TO authenticated;
GRANT ALL ON public.cliente_documentos TO service_role;
ALTER TABLE public.cliente_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cliente_documentos equipe" ON public.cliente_documentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
