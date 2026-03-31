CREATE OR REPLACE FUNCTION public.atualizar_despesas_atrasadas()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE despesas_empresa
  SET status = 'Em Atraso'
  WHERE data_vencimento < CURRENT_DATE
    AND status IN ('A Vencer', 'Parcialmente Pago');

  UPDATE despesas_pessoal
  SET status = 'Em Atraso'
  WHERE data_vencimento < CURRENT_DATE
    AND status IN ('A Vencer', 'Parcialmente Pago');
END;
$function$;