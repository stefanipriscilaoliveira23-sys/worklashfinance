
-- =============================================
-- ENUMS
-- =============================================
CREATE TYPE public.produto_categoria AS ENUM (
  'Mentoria Outsider', 'Mentoria Digital Beauty', 'Consultoria Premium', 'Consultoria Express',
  'Curso/Formação', 'Ferramenta', 'Apostila', 'Produto Físico', 'Renovação Mentoria', 'Outros'
);

CREATE TYPE public.despesa_categoria_empresa AS ENUM (
  'Salário Funcionário', 'Tráfego Pago', 'Plataforma Digital', 'Aluguel Comercial',
  'Serviços Terceiros', 'Contabilidade', 'Transportadora', 'Energia', 'Internet',
  'Planos e Benefícios', 'IA', 'CMV Produto Físico', 'Variável', 'Outros'
);

CREATE TYPE public.despesa_categoria_pessoal AS ENUM (
  'Aluguéis/Financiamentos', 'Investimentos', 'Despesas Casa', 'Lazer', 'Alimentação',
  'Saúde/Farmácia', 'Vestuário', 'Transporte', 'Pet', 'Estética', 'Outros'
);

CREATE TYPE public.tipo_despesa AS ENUM ('Fixa', 'Variável');

CREATE TYPE public.status_parcela AS ENUM ('Pendente', 'Quitado', 'Atraso', 'Parcialmente Pago');

CREATE TYPE public.status_despesa AS ENUM ('A Vencer', 'Pago', 'Em Atraso', 'Parcialmente Pago');

CREATE TYPE public.periodicidade AS ENUM ('Semanal', 'Quinzenal', 'Mensal');

CREATE TYPE public.plataforma_origem AS ENUM ('Hotmart', 'Kiwify', 'Eduzz', 'Direto Pix', 'Outro');

CREATE TYPE public.app_role AS ENUM ('admin', 'operacional');

-- =============================================
-- USER ROLES TABLE
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'operacional',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- PROFILES TABLE
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operacional');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- ORIGENS VENDA OPCOES
-- =============================================
CREATE TABLE public.origens_venda_opcoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.origens_venda_opcoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read origens" ON public.origens_venda_opcoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage origens" ON public.origens_venda_opcoes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.origens_venda_opcoes (label) VALUES
  ('Tráfego Pago'), ('Stories Orgânico'), ('Post Orgânico'), ('Social Selling'),
  ('Grupo WhatsApp'), ('Call de Diagnóstico'), ('Call Estratégica'), ('Link Bio'),
  ('Destaque Instagram'), ('Base Existente'), ('Indicação'), ('Ascensão'), ('Outro');

-- =============================================
-- PRODUTOS CATALOGO
-- =============================================
CREATE TABLE public.produtos_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria produto_categoria NOT NULL,
  plataformas TEXT[] DEFAULT '{}',
  custo_direto_percentual NUMERIC DEFAULT 0,
  custo_direto_fixo_mensal NUMERIC DEFAULT 0,
  tipo TEXT DEFAULT 'digital',
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacao TEXT
);
ALTER TABLE public.produtos_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read produtos" ON public.produtos_catalogo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage produtos" ON public.produtos_catalogo FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RECEITAS
-- =============================================
CREATE TABLE public.receitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  produto_nome TEXT NOT NULL,
  produto_id UUID REFERENCES public.produtos_catalogo(id),
  produto_categoria produto_categoria,
  plataforma plataforma_origem NOT NULL,
  valor_bruto NUMERIC NOT NULL DEFAULT 0,
  taxa_plataforma_percentual NUMERIC DEFAULT 0,
  taxa_plataforma_valor NUMERIC DEFAULT 0,
  valor_liquido NUMERIC DEFAULT 0,
  moeda_original TEXT DEFAULT 'BRL',
  taxa_cambio NUMERIC DEFAULT 1,
  valor_em_brl NUMERIC DEFAULT 0,
  cliente_nome TEXT,
  cliente_email TEXT,
  forma_pagamento TEXT,
  origens_venda TEXT[] DEFAULT '{}',
  produto_entrada_id UUID,
  is_ascensao BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'ativo',
  observacao TEXT,
  lancado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.receitas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read receitas" ON public.receitas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert receitas" ON public.receitas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update receitas" ON public.receitas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete receitas" ON public.receitas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- PARCELAS MENTORIA
-- =============================================
CREATE TABLE public.parcelas_mentoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome TEXT NOT NULL,
  cliente_email TEXT,
  tipo_mentoria produto_categoria NOT NULL,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  entrada_valor NUMERIC DEFAULT 0,
  entrada_data DATE,
  quant_parcelas INTEGER NOT NULL DEFAULT 1,
  periodicidade periodicidade NOT NULL DEFAULT 'Mensal',
  data_inicio DATE NOT NULL,
  data_fim_prevista DATE,
  is_renovacao BOOLEAN DEFAULT false,
  data_termino_mentoria_anterior DATE,
  data_ultimo_acesso_anterior DATE,
  receita_id UUID REFERENCES public.receitas(id),
  status_geral status_parcela DEFAULT 'Pendente',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.parcelas_mentoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read parcelas" ON public.parcelas_mentoria FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert parcelas" ON public.parcelas_mentoria FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update parcelas" ON public.parcelas_mentoria FOR UPDATE TO authenticated USING (true);

-- =============================================
-- PARCELAS MENTORIA DETALHE
-- =============================================
CREATE TABLE public.parcelas_mentoria_detalhe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcela_mentoria_id UUID REFERENCES public.parcelas_mentoria(id) ON DELETE CASCADE NOT NULL,
  numero_parcela INTEGER NOT NULL,
  data_vencimento DATE NOT NULL,
  valor_sugerido NUMERIC DEFAULT 0,
  valor_real NUMERIC DEFAULT 0,
  valor_pago_parcial NUMERIC DEFAULT 0,
  saldo_parcela NUMERIC DEFAULT 0,
  status status_parcela DEFAULT 'Pendente',
  data_pagamento DATE,
  observacao TEXT
);
ALTER TABLE public.parcelas_mentoria_detalhe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read detalhe" ON public.parcelas_mentoria_detalhe FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert detalhe" ON public.parcelas_mentoria_detalhe FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update detalhe" ON public.parcelas_mentoria_detalhe FOR UPDATE TO authenticated USING (true);

-- =============================================
-- DESPESAS EMPRESA
-- =============================================
CREATE TABLE public.despesas_empresa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  categoria despesa_categoria_empresa NOT NULL,
  tipo_despesa tipo_despesa NOT NULL DEFAULT 'Variável',
  valor_original NUMERIC NOT NULL DEFAULT 0,
  valor_pago_total NUMERIC DEFAULT 0,
  saldo_pendente NUMERIC DEFAULT 0,
  data_vencimento DATE,
  data_pagamento DATE,
  status status_despesa DEFAULT 'A Vencer',
  forma_pagamento TEXT,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.despesas_empresa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read desp empresa" ON public.despesas_empresa FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert desp empresa" ON public.despesas_empresa FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update desp empresa" ON public.despesas_empresa FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete desp empresa" ON public.despesas_empresa FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- DESPESAS PESSOAL
-- =============================================
CREATE TABLE public.despesas_pessoal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  categoria despesa_categoria_pessoal NOT NULL,
  tipo_despesa tipo_despesa NOT NULL DEFAULT 'Variável',
  valor_original NUMERIC NOT NULL DEFAULT 0,
  valor_pago_total NUMERIC DEFAULT 0,
  saldo_pendente NUMERIC DEFAULT 0,
  data_vencimento DATE,
  data_pagamento DATE,
  status status_despesa DEFAULT 'A Vencer',
  forma_pagamento TEXT,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.despesas_pessoal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read desp pessoal" ON public.despesas_pessoal FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert desp pessoal" ON public.despesas_pessoal FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update desp pessoal" ON public.despesas_pessoal FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete desp pessoal" ON public.despesas_pessoal FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- PAGAMENTOS PARCIAIS
-- =============================================
CREATE TABLE public.pagamentos_parciais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia_id UUID NOT NULL,
  referencia_tipo TEXT NOT NULL,
  valor_pago NUMERIC NOT NULL DEFAULT 0,
  data_pagamento DATE NOT NULL,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pagamentos_parciais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read pagamentos" ON public.pagamentos_parciais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert pagamentos" ON public.pagamentos_parciais FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================
-- EVENTOS ESPECIAIS
-- =============================================
CREATE TABLE public.eventos_especiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  data_evento DATE,
  descricao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.eventos_especiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read eventos" ON public.eventos_especiais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert eventos" ON public.eventos_especiais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update eventos" ON public.eventos_especiais FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete eventos" ON public.eventos_especiais FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- EVENTOS DESPESAS
-- =============================================
CREATE TABLE public.eventos_despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id UUID REFERENCES public.eventos_especiais(id) ON DELETE CASCADE NOT NULL,
  descricao TEXT NOT NULL,
  valor_original NUMERIC NOT NULL DEFAULT 0,
  valor_pago_total NUMERIC DEFAULT 0,
  saldo_pendente NUMERIC DEFAULT 0,
  data_vencimento DATE,
  data_pagamento DATE,
  status status_despesa DEFAULT 'A Vencer',
  observacao TEXT
);
ALTER TABLE public.eventos_despesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read ev despesas" ON public.eventos_despesas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert ev despesas" ON public.eventos_despesas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update ev despesas" ON public.eventos_despesas FOR UPDATE TO authenticated USING (true);

-- =============================================
-- ESTOQUE CMV
-- =============================================
CREATE TABLE public.estoque_cmv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_descricao TEXT NOT NULL,
  data_compra DATE NOT NULL,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  quantidade INTEGER NOT NULL DEFAULT 0,
  custo_unitario NUMERIC DEFAULT 0,
  valor_absorvido NUMERIC DEFAULT 0,
  valor_restante NUMERIC DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.estoque_cmv ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read estoque" ON public.estoque_cmv FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert estoque" ON public.estoque_cmv FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update estoque" ON public.estoque_cmv FOR UPDATE TO authenticated USING (true);

-- =============================================
-- METAS
-- =============================================
CREATE TABLE public.metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  valor_meta NUMERIC NOT NULL DEFAULT 0,
  pro_labore NUMERIC DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read metas" ON public.metas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage metas" ON public.metas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- CONFIGURACOES
-- =============================================
CREATE TABLE public.configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT NOT NULL UNIQUE,
  valor TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage config" ON public.configuracoes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
