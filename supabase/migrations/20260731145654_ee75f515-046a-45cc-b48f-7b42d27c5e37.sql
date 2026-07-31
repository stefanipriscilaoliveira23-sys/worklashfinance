
CREATE OR REPLACE FUNCTION public.norm_txt(t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(btrim(regexp_replace(coalesce(t,''), '\s+', ' ', 'g')))
$$;

CREATE OR REPLACE FUNCTION public.norm_fone(t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT nullif(regexp_replace(coalesce(t,''), '\D', '', 'g'), '')
$$;

CREATE TABLE public._merge_map (dup uuid PRIMARY KEY, keep uuid NOT NULL);

-- PASSO 1: mesmo nome + mesmo email
WITH base AS (
  SELECT id, public.norm_txt(nome) nm, nullif(lower(btrim(email)),'') em, criado_em,
    (CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN coalesce(whatsapp, telefone) IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN instagram IS NOT NULL THEN 1 ELSE 0 END) score
  FROM public.clientes
), ranked AS (
  SELECT id, first_value(id) OVER (PARTITION BY nm, em ORDER BY score DESC, criado_em ASC, id) keep
  FROM base WHERE em IS NOT NULL AND nm <> ''
)
INSERT INTO public._merge_map (dup, keep)
SELECT id, keep FROM ranked WHERE id <> keep;

-- PASSO 2: mesmo nome + mesmo telefone (apenas registros ainda nao mesclados)
WITH base AS (
  SELECT c.id, public.norm_txt(c.nome) nm, public.norm_fone(coalesce(c.whatsapp, c.telefone)) tel, c.criado_em,
    (CASE WHEN c.email IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN coalesce(c.whatsapp, c.telefone) IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN c.instagram IS NOT NULL THEN 1 ELSE 0 END) score
  FROM public.clientes c
  WHERE NOT EXISTS (SELECT 1 FROM public._merge_map m WHERE m.dup = c.id)
), ranked AS (
  SELECT id, first_value(id) OVER (PARTITION BY nm, tel ORDER BY score DESC, criado_em ASC, id) keep
  FROM base WHERE tel IS NOT NULL AND nm <> ''
)
INSERT INTO public._merge_map (dup, keep)
SELECT id, keep FROM ranked WHERE id <> keep
ON CONFLICT (dup) DO NOTHING;

-- PASSO 3: registro sem contato cujo nome casa (prefixo) com exatamente um cliente com contato
WITH restantes AS (
  SELECT c.id, public.norm_txt(c.nome) nm,
    (c.email IS NULL AND c.whatsapp IS NULL AND c.telefone IS NULL) sem_contato
  FROM public.clientes c
  WHERE NOT EXISTS (SELECT 1 FROM public._merge_map m WHERE m.dup = c.id)
), orfas AS (
  SELECT id, nm FROM restantes WHERE sem_contato AND nm <> ''
), comContato AS (
  SELECT id, nm FROM restantes WHERE NOT sem_contato
), pares AS (
  SELECT o.id dup, min(k.id::text)::uuid keep, count(DISTINCT k.id) qtd
  FROM orfas o
  JOIN comContato k ON (k.nm = o.nm OR k.nm LIKE o.nm || ' (%' OR o.nm LIKE k.nm || ' (%')
  GROUP BY o.id
)
INSERT INTO public._merge_map (dup, keep)
SELECT dup, keep FROM pares WHERE qtd = 1
ON CONFLICT (dup) DO NOTHING;

-- Evita cadeias: dup que tambem eh keeper
DELETE FROM public._merge_map m WHERE EXISTS (SELECT 1 FROM public._merge_map x WHERE x.dup = m.keep);

-- Transfere historico
UPDATE public.receitas r SET cliente_id = m.keep FROM public._merge_map m WHERE r.cliente_id = m.dup;
UPDATE public.parcelas_mentoria p SET cliente_id = m.keep FROM public._merge_map m WHERE p.cliente_id = m.dup;
UPDATE public.mentoradas mt SET cliente_id = m.keep FROM public._merge_map m WHERE mt.cliente_id = m.dup;
UPDATE public.cliente_interacoes i SET cliente_id = m.keep FROM public._merge_map m WHERE i.cliente_id = m.dup;
UPDATE public.cliente_documentos d SET cliente_id = m.keep FROM public._merge_map m WHERE d.cliente_id = m.dup;

-- Consolida dados no registro que fica
WITH agg AS (
  SELECT m.keep,
    max(c.email) email, max(c.telefone) telefone, max(c.whatsapp) whatsapp, max(c.instagram) instagram,
    string_agg(nullif(c.observacao,''), E'\n') observacao,
    (SELECT array_agg(DISTINCT t) FROM public.clientes c2, unnest(coalesce(c2.tags, '{}')) t
      WHERE c2.id = m.keep OR c2.id IN (SELECT dup FROM public._merge_map WHERE keep = m.keep)) tags
  FROM public._merge_map m JOIN public.clientes c ON c.id = m.dup
  GROUP BY m.keep
)
UPDATE public.clientes k SET
  email = coalesce(k.email, a.email),
  telefone = coalesce(k.telefone, a.telefone),
  whatsapp = coalesce(k.whatsapp, a.whatsapp),
  instagram = coalesce(k.instagram, a.instagram),
  observacao = coalesce(nullif(k.observacao,''), a.observacao),
  tags = coalesce(a.tags, k.tags)
FROM agg a WHERE k.id = a.keep;

DELETE FROM public.clientes c WHERE EXISTS (SELECT 1 FROM public._merge_map m WHERE m.dup = c.id);
DROP TABLE public._merge_map;

-- Remove clientes sem contato e sem historico
DELETE FROM public.clientes c
WHERE c.email IS NULL AND c.telefone IS NULL AND c.whatsapp IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.receitas x WHERE x.cliente_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.parcelas_mentoria x WHERE x.cliente_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.mentoradas x WHERE x.cliente_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.cliente_interacoes x WHERE x.cliente_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.cliente_documentos x WHERE x.cliente_id = c.id);

-- Protecao contra novos duplicados
CREATE UNIQUE INDEX IF NOT EXISTS clientes_nome_email_uniq
  ON public.clientes (public.norm_txt(nome), lower(btrim(email))) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clientes_nome_fone_uniq
  ON public.clientes (public.norm_txt(nome), public.norm_fone(coalesce(whatsapp, telefone)))
  WHERE coalesce(whatsapp, telefone) IS NOT NULL;

-- Catalogo de tags
CREATE TABLE public.tags_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX tags_catalogo_nome_uniq ON public.tags_catalogo (upper(btrim(nome)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags_catalogo TO authenticated;
GRANT ALL ON public.tags_catalogo TO service_role;
ALTER TABLE public.tags_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read tags" ON public.tags_catalogo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert tags" ON public.tags_catalogo FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update tags" ON public.tags_catalogo FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete tags" ON public.tags_catalogo FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER tags_catalogo_updated_at BEFORE UPDATE ON public.tags_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.tags_catalogo (nome)
SELECT DISTINCT btrim(t) FROM public.clientes c, unnest(coalesce(c.tags,'{}')) t WHERE btrim(t) <> ''
ON CONFLICT DO NOTHING;
