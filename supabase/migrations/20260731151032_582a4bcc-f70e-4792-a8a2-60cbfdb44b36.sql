UPDATE public.parcelas_mentoria
SET cliente_id = NULL
WHERE cliente_id IN (
  SELECT id FROM public.clientes
  WHERE NOT (
    ((nome IS NOT NULL AND trim(nome) <> '' AND nome !~ '^[0-9+\-\s()]+$') AND (telefone IS NOT NULL AND trim(telefone) <> ''))
    OR ((nome IS NOT NULL AND trim(nome) <> '' AND nome !~ '^[0-9+\-\s()]+$') AND (email IS NOT NULL AND trim(email) <> ''))
    OR ((email IS NOT NULL AND trim(email) <> '') AND (telefone IS NOT NULL AND trim(telefone) <> ''))
  )
);

DELETE FROM public.clientes
WHERE NOT (
  ((nome IS NOT NULL AND trim(nome) <> '' AND nome !~ '^[0-9+\-\s()]+$') AND (telefone IS NOT NULL AND trim(telefone) <> ''))
  OR ((nome IS NOT NULL AND trim(nome) <> '' AND nome !~ '^[0-9+\-\s()]+$') AND (email IS NOT NULL AND trim(email) <> ''))
  OR ((email IS NOT NULL AND trim(email) <> '') AND (telefone IS NOT NULL AND trim(telefone) <> ''))
);