-- =====================================================================
-- CORRECAO DE SEGURANCA - Escritorio Worklash
-- =====================================================================
-- PROBLEMA: 8 permissoes do banco foram criadas com o nome
-- "Authenticated can ..." mas foram concedidas ao papel "public",
-- que inclui visitantes NAO logados. Resultado: qualquer pessoa na
-- internet consegue ler 25.946 registros de clientes (nome, email,
-- telefone, whatsapp, instagram, observacao) e ainda apagar receitas,
-- parcelas e pagamentos.
--
-- ESTE SCRIPT: mantem exatamente a mesma regra, so troca o publico-alvo
-- de "public" (qualquer um) para "authenticated" (so quem fez login).
-- Nao apaga nada, nao muda dado nenhum, e e reversivel.
--
-- NAO MEXE na pagina publica de agendamento: as permissoes que ela usa
-- (agenda_tipos, agenda_disponibilidade, agenda_bloqueios, anfitrioes)
-- ficam intactas de proposito.
--
-- COMO RODAR: Lovable > Mais > Cloud > SQL editor > colar tudo > Run
-- =====================================================================
--
-- ATENCAO: este script sozinho NAO resolve tudo.
-- Ele fecha o acesso de quem NAO tem login. Mas o cadastro do sistema
-- esta ABERTO (qualquer pessoa clica em "Criar conta", entra na hora,
-- sem confirmar email) e as regras do banco liberam tudo pra qualquer
-- usuario logado, sem olhar cargo nem permissao. As permissoes que
-- aparecem na tela de Configuracoes sao so visuais, o banco nao as usa.
--
-- Entao falta tambem, em Lovable > Mais > Cloud > Users > Auth settings:
--   DESLIGAR o cadastro aberto ("Allow new users to sign up").
-- Sao 4 usuarios hoje, e novos podem ser criados por voce ali mesmo.
-- =====================================================================

-- Lista de clientes: leitura, cadastro e edicao so para quem esta logado
alter policy "Authenticated can read clientes"     on public.clientes to authenticated;
alter policy "Authenticated can insert clientes"   on public.clientes to authenticated;
alter policy "Authenticated can update clientes"   on public.clientes to authenticated;

-- Pagamentos: alterar e excluir so para quem esta logado
alter policy "Authenticated can update pagamentos" on public.pagamentos_parciais to authenticated;
alter policy "Authenticated can delete pagamentos" on public.pagamentos_parciais to authenticated;

-- Parcelas de mentoria: excluir so para quem esta logado
alter policy "Authenticated can delete parcelas"   on public.parcelas_mentoria to authenticated;
alter policy "Authenticated can delete detalhe"    on public.parcelas_mentoria_detalhe to authenticated;

-- Receitas: excluir so para quem esta logado
alter policy "Authenticated can delete receitas"   on public.receitas to authenticated;


-- =====================================================================
-- CONFERENCIA (rode depois, deve voltar SO as 4 linhas da agenda
-- publica: agenda_bloqueios, agenda_disponibilidade, agenda_tipos e
-- anfitrioes. Se aparecer clientes, receitas, parcelas ou pagamentos,
-- alguma linha acima nao passou.)
-- =====================================================================
-- select tablename, cmd, policyname
-- from pg_policies
-- where schemaname = 'public'
--   and ('public' = any(roles) or 'anon' = any(roles))
-- order by tablename, cmd;
