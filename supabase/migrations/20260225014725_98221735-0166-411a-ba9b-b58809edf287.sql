
-- Create priority enum
CREATE TYPE public.prioridade_despesa AS ENUM ('Alta', 'Média', 'Baixa');

-- Add priority column to both expense tables
ALTER TABLE public.despesas_empresa ADD COLUMN prioridade public.prioridade_despesa NOT NULL DEFAULT 'Média';
ALTER TABLE public.despesas_pessoal ADD COLUMN prioridade public.prioridade_despesa NOT NULL DEFAULT 'Média';

-- Create cofrinho table
CREATE TABLE public.cofrinho (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  observacao TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(data)
);

ALTER TABLE public.cofrinho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cofrinho" ON public.cofrinho FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert cofrinho" ON public.cofrinho FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update cofrinho" ON public.cofrinho FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete cofrinho" ON public.cofrinho FOR DELETE USING (true);

-- Auto-assign priorities for existing despesas_empresa based on category
UPDATE despesas_empresa SET prioridade = 'Alta' WHERE categoria IN ('Salário Funcionário', 'Aluguel Comercial', 'Contabilidade', 'Energia', 'Internet');
UPDATE despesas_empresa SET prioridade = 'Média' WHERE categoria IN ('Plataforma Digital', 'Serviços Terceiros', 'Planos e Benefícios', 'IA', 'CMV Produto Físico');
UPDATE despesas_empresa SET prioridade = 'Baixa' WHERE categoria IN ('Tráfego Pago', 'Transportadora', 'Variável', 'Outros');

-- Auto-assign priorities for existing despesas_pessoal based on category
UPDATE despesas_pessoal SET prioridade = 'Alta' WHERE categoria IN ('Aluguéis/Financiamentos', 'Despesas Casa', 'Saúde/Farmácia');
UPDATE despesas_pessoal SET prioridade = 'Média' WHERE categoria IN ('Alimentação', 'Transporte', 'Investimentos');
UPDATE despesas_pessoal SET prioridade = 'Baixa' WHERE categoria IN ('Lazer', 'Vestuário', 'Pet', 'Estética', 'Outros');
