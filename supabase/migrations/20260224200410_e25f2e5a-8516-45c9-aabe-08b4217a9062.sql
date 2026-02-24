-- Função que atualiza automaticamente parcelas vencidas para 'Atraso'
CREATE OR REPLACE FUNCTION public.atualizar_parcelas_atrasadas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE parcelas_mentoria_detalhe
  SET status = 'Atraso'
  WHERE data_vencimento < CURRENT_DATE
    AND status = 'Pendente'
    AND data_pagamento IS NULL;
END;
$$;