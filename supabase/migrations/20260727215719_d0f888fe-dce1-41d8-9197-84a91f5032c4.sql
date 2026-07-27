
-- Enums
CREATE TYPE public.divida_situacao AS ENUM (
  'Identificada, mas ainda não apurada',
  'Aguardando consulta ao credor',
  'Sem negociação',
  'Negociação pendente',
  'Em negociação',
  'Acordo realizado',
  'Parcelada',
  'Em pagamento',
  'Em atraso após acordo',
  'Contestada',
  'Prescrita ou em análise jurídica',
  'Quitada'
);

CREATE TYPE public.divida_valor_precisao AS ENUM (
  'Exato',
  'Aproximado',
  'Desatualizado',
  'Desconhecido',
  'Aguardando confirmação do credor'
);

CREATE TYPE public.divida_proxima_acao AS ENUM (
  'Identificar o credor atual',
  'Consultar saldo atualizado',
  'Solicitar contrato',
  'Solicitar memória de cálculo',
  'Verificar juros e multas',
  'Consultar possibilidade de desconto',
  'Solicitar proposta de negociação',
  'Comparar propostas',
  'Negociar',
  'Aguardar recursos',
  'Buscar orientação jurídica',
  'Outra'
);

CREATE TYPE public.divida_contato_canal AS ENUM (
  'Telefone', 'WhatsApp', 'E-mail', 'Presencial', 'Portal do credor', 'Carta', 'Outro'
);

-- Tabela principal
CREATE TABLE public.dividas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  credor TEXT,
  credor_nao_identificado BOOLEAN NOT NULL DEFAULT false,
  valor_aproximado NUMERIC,
  valor_precisao public.divida_valor_precisao NOT NULL DEFAULT 'Desconhecido',
  data_valor_informado DATE,
  situacao public.divida_situacao NOT NULL DEFAULT 'Identificada, mas ainda não apurada',
  responsavel TEXT,
  observacoes TEXT,
  documentos_disponiveis TEXT,
  dados_faltando TEXT,
  proxima_acao public.divida_proxima_acao,
  proxima_acao_prazo DATE,
  situacao_contato TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dividas TO authenticated;
GRANT ALL ON public.dividas TO service_role;
ALTER TABLE public.dividas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins select dividas" ON public.dividas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert dividas" ON public.dividas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update dividas" ON public.dividas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete dividas" ON public.dividas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Histórico de contatos / propostas
CREATE TABLE public.dividas_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  divida_id UUID NOT NULL REFERENCES public.dividas(id) ON DELETE CASCADE,
  data_contato DATE NOT NULL DEFAULT CURRENT_DATE,
  canal public.divida_contato_canal,
  pessoa_contatada TEXT,
  saldo_informado NUMERIC,
  desconto_oferecido NUMERIC,
  valor_a_vista NUMERIC,
  entrada_solicitada NUMERIC,
  qtd_parcelas INTEGER,
  valor_parcela NUMERIC,
  validade_proposta DATE,
  protocolo TEXT,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dividas_historico TO authenticated;
GRANT ALL ON public.dividas_historico TO service_role;
ALTER TABLE public.dividas_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins select dividas_hist" ON public.dividas_historico FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert dividas_hist" ON public.dividas_historico FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update dividas_hist" ON public.dividas_historico FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete dividas_hist" ON public.dividas_historico FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_dividas_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER dividas_set_updated_at
  BEFORE UPDATE ON public.dividas
  FOR EACH ROW EXECUTE FUNCTION public.update_dividas_updated_at();
