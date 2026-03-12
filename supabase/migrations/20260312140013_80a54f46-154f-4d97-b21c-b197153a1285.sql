
CREATE OR REPLACE FUNCTION public.atualizar_despesas_atrasadas()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  UPDATE despesas_empresa
  SET status = 'Em Atraso'
  WHERE data_vencimento < CURRENT_DATE
    AND status IN ('A Vencer', 'Parcialmente Pago')
    AND (valor_pago_total IS NULL OR valor_pago_total < valor_original);

  UPDATE despesas_pessoal
  SET status = 'Em Atraso'
  WHERE data_vencimento < CURRENT_DATE
    AND status IN ('A Vencer', 'Parcialmente Pago')
    AND (valor_pago_total IS NULL OR valor_pago_total < valor_original);
END;
$$;
