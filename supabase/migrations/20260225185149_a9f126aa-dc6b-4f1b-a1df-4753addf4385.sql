-- Restrict admin-only tables: despesas_empresa
DROP POLICY IF EXISTS "Authenticated can read desp empresa" ON despesas_empresa;
CREATE POLICY "Admin can read desp empresa" ON despesas_empresa FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can insert desp empresa" ON despesas_empresa;
CREATE POLICY "Admin can insert desp empresa" ON despesas_empresa FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can update desp empresa" ON despesas_empresa;
CREATE POLICY "Admin can update desp empresa" ON despesas_empresa FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Restrict despesas_pessoal
DROP POLICY IF EXISTS "Authenticated can read desp pessoal" ON despesas_pessoal;
CREATE POLICY "Admin can read desp pessoal" ON despesas_pessoal FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can insert desp pessoal" ON despesas_pessoal;
CREATE POLICY "Admin can insert desp pessoal" ON despesas_pessoal FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can update desp pessoal" ON despesas_pessoal;
CREATE POLICY "Admin can update desp pessoal" ON despesas_pessoal FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Restrict eventos_especiais
DROP POLICY IF EXISTS "Authenticated can read eventos" ON eventos_especiais;
CREATE POLICY "Admin can read eventos" ON eventos_especiais FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can insert eventos" ON eventos_especiais;
CREATE POLICY "Admin can insert eventos" ON eventos_especiais FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can update eventos" ON eventos_especiais;
CREATE POLICY "Admin can update eventos" ON eventos_especiais FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Restrict eventos_despesas
DROP POLICY IF EXISTS "Authenticated can read ev despesas" ON eventos_despesas;
CREATE POLICY "Admin can read ev despesas" ON eventos_despesas FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can insert ev despesas" ON eventos_despesas;
CREATE POLICY "Admin can insert ev despesas" ON eventos_despesas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can update ev despesas" ON eventos_despesas;
CREATE POLICY "Admin can update ev despesas" ON eventos_despesas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Restrict cofrinho
DROP POLICY IF EXISTS "Authenticated can read cofrinho" ON cofrinho;
CREATE POLICY "Admin can read cofrinho" ON cofrinho FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can insert cofrinho" ON cofrinho;
CREATE POLICY "Admin can insert cofrinho" ON cofrinho FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can update cofrinho" ON cofrinho;
CREATE POLICY "Admin can update cofrinho" ON cofrinho FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can delete cofrinho" ON cofrinho;
CREATE POLICY "Admin can delete cofrinho" ON cofrinho FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Restrict metas (financial targets)
DROP POLICY IF EXISTS "Authenticated can read metas" ON metas;
CREATE POLICY "Admin can read metas" ON metas FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can insert metas" ON metas;
CREATE POLICY "Admin can insert metas" ON metas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can update metas" ON metas;
CREATE POLICY "Admin can update metas" ON metas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Restrict estoque_cmv
DROP POLICY IF EXISTS "Authenticated can read estoque" ON estoque_cmv;
CREATE POLICY "Admin can read estoque" ON estoque_cmv FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can insert estoque" ON estoque_cmv;
CREATE POLICY "Admin can insert estoque" ON estoque_cmv FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can update estoque" ON estoque_cmv;
CREATE POLICY "Admin can update estoque" ON estoque_cmv FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));