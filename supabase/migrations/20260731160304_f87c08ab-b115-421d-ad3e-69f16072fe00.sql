UPDATE public.clientes
SET whatsapp = telefone
WHERE (whatsapp IS NULL OR btrim(whatsapp) = '')
  AND telefone IS NOT NULL AND btrim(telefone) <> '';

UPDATE public.mentoradas
SET status_renovacao = 'Não renovou'
WHERE status_jornada IN ('Inativa', 'Cancelada')
  AND (status_renovacao IS DISTINCT FROM 'Não renovou');

UPDATE public.mentoradas
SET status_renovacao = 'Não venceu'
WHERE status_jornada NOT IN ('Inativa', 'Cancelada')
  AND (status_renovacao IS NULL OR btrim(status_renovacao) = '')
  AND (data_termino IS NULL OR data_termino >= CURRENT_DATE);