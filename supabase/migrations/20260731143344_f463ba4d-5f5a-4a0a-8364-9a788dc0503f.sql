CREATE OR REPLACE FUNCTION public.clientes_tags()
RETURNS TABLE(tag text, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t, count(*)::bigint
  FROM public.clientes c, unnest(coalesce(c.tags, '{}'::text[])) t
  WHERE t IS NOT NULL AND t <> ''
  GROUP BY t
  ORDER BY count(*) DESC
  LIMIT 300;
$$;

GRANT EXECUTE ON FUNCTION public.clientes_tags() TO authenticated;

CREATE OR REPLACE FUNCTION public.buscar_clientes(
  p_busca text DEFAULT NULL,
  p_tags text[] DEFAULT NULL,
  p_produto text DEFAULT NULL,
  p_de date DEFAULT NULL,
  p_ate date DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, nome text, email text, telefone text, whatsapp text,
  instagram text, observacao text, tags text[], criado_em timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT c.*
    FROM public.clientes c
    WHERE (
        p_busca IS NULL OR p_busca = '' OR
        c.nome ILIKE '%' || p_busca || '%' OR
        coalesce(c.email, '') ILIKE '%' || p_busca || '%' OR
        coalesce(c.telefone, '') ILIKE '%' || p_busca || '%' OR
        coalesce(c.whatsapp, '') ILIKE '%' || p_busca || '%' OR
        coalesce(c.instagram, '') ILIKE '%' || p_busca || '%'
      )
      AND (p_tags IS NULL OR array_length(p_tags, 1) IS NULL OR c.tags && p_tags)
      AND (p_de IS NULL OR c.criado_em::date >= p_de)
      AND (p_ate IS NULL OR c.criado_em::date <= p_ate)
      AND (
        p_produto IS NULL OR p_produto = '' OR EXISTS (
          SELECT 1 FROM public.receitas r
          WHERE (r.cliente_id = c.id OR lower(coalesce(r.cliente_nome, '')) = lower(c.nome))
            AND coalesce(r.produto_nome, '') ILIKE '%' || p_produto || '%'
        )
      )
  )
  SELECT b.id, b.nome, b.email, b.telefone, b.whatsapp, b.instagram,
         b.observacao, b.tags, b.criado_em, count(*) OVER()::bigint AS total_count
  FROM base b
  ORDER BY b.nome
  LIMIT greatest(coalesce(p_limit, 50), 1)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

GRANT EXECUTE ON FUNCTION public.buscar_clientes(text, text[], text, date, date, integer, integer) TO authenticated;