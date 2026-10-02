-- Aba Campanhas (02/10/2026). As tabelas campanhas, campanha_mensagens e
-- campanha_grupos vieram da migration campanhas_whatsapp, aplicada direto no apps-ste.

-- bucket público das mídias das mensagens: <campanha_id>/<arquivo>
insert into storage.buckets (id, name, public) values ('campanhas', 'campanhas', true)
on conflict (id) do update set public = true;

drop policy if exists campanhas_midias_escritorio on storage.objects;
create policy campanhas_midias_escritorio on storage.objects
  for all to authenticated
  using (bucket_id = 'campanhas' and public.tem_acesso_escritorio(auth.uid()))
  with check (bucket_id = 'campanhas' and public.tem_acesso_escritorio(auth.uid()));

-- marca as mensagens que estavam agendadas quando a campanha foi pausada,
-- pra o Retomar devolver só essas (e não os rascunhos de verdade)
alter table public.campanha_mensagens add column if not exists pausada boolean not null default false;
