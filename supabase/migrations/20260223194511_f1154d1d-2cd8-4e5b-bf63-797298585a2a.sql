
-- Add category column to eventos_despesas for Fechado/Precisa Fechar/Pago categories
CREATE TYPE public.evento_despesa_categoria AS ENUM ('Fechado', 'Precisa Fechar', 'Pago/Presente');

ALTER TABLE public.eventos_despesas 
ADD COLUMN categoria_evento public.evento_despesa_categoria NOT NULL DEFAULT 'Fechado';
