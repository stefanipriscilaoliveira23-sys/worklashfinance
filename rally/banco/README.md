# Banco do Rally

Projeto Supabase: **saque-barragem** (`neernbcttnluwjjchsss`, região `sa-east-1`).

O Rally divide o projeto com o app do torneio Saque na Barragem. Nada do torneio
foi alterado — todo objeto novo usa o prefixo `tenis_`.

## Login compartilhado

O Rally **não usa o Supabase Auth**. Ele reaproveita o login que o app do torneio
já tinha:

- `atletas` — nome, telefone, senha (bcrypt via pgcrypto), foto
- `sessoes` — token de sessão por login
- `criar_conta()`, `fazer_login()`, `logout()` — funções que já existiam

Ou seja: os 166 atletas do torneio entram no Rally com o mesmo celular e senha.

## Modelo de segurança

Todas as tabelas `tenis_*` têm **RLS ligado e nenhuma policy**. Isso é
intencional: ninguém lê nem escreve tabela direto pela API. Todo acesso passa
por funções `SECURITY DEFINER` que recebem o token da sessão, descobrem quem é o
usuário e só devolvem o que é dele.

As funções auxiliares (prefixo `_tenis_`) tiveram o `EXECUTE` revogado de
`anon` e `authenticated` — elas só rodam de dentro das funções públicas.

Os avisos `rls_enabled_no_policy` do painel do Supabase são esperados neste
desenho, e não indicam tabela aberta.

## Migrações

As migrações estão versionadas dentro do próprio Supabase, na ordem em que foram
aplicadas:

1. `tenis_rally_tabelas` — todas as tabelas, índices e RLS
2. `tenis_rally_perfil_descoberta` — perfil, disponibilidade, "livre hoje", busca
3. `tenis_rally_convites_jogos_chat` — convites, jogos, chat, ranking, segurança
4. `tenis_rally_fix_ranking` — corrige janela dentro de agregação
5. `tenis_rally_fix_contraproposta` — só `pendente` conta como convite em aberto
6. `tenis_rally_fix_descobrir_pendente` — mesma regra na tela de descoberta
7. `tenis_rally_fechar_funcoes_internas` — revoga EXECUTE das auxiliares

Para baixar o SQL completo para esta pasta:

```bash
npx supabase link --project-ref neernbcttnluwjjchsss
npx supabase db pull
```

## Tabelas

| Tabela | Para quê |
|---|---|
| `tenis_perfis` | Nível, cidade, coordenadas, preferências, rating, reputação |
| `tenis_disponibilidade` | Grade semanal: dia (0–6) × turno (manhã/tarde/noite) |
| `tenis_livre` | "Estou livre hoje das 19h às 21h" |
| `tenis_locais` | Quadras e clubes cadastrados pelos jogadores |
| `tenis_convites` | Convites, desafios e contrapropostas |
| `tenis_jogos` | Jogo confirmado, placar, vencedor |
| `tenis_conversas` / `tenis_mensagens` | Chat (só abre após o aceite) |
| `tenis_avaliacoes` | Presença, nível condizente e convivência |
| `tenis_bloqueios` / `tenis_denuncias` | Segurança |

## Como o nível e o ranking funcionam

- **Nível** (1 a 7): declarado pelo jogador — Iniciante até 1ª classe.
- **Rating**: começa em 1000 e se ajusta por Elo (K=24) a cada placar lançado.
  Ganhar de quem tem rating maior vale mais.
- **Confiabilidade**: percentual de jogos em que a pessoa apareceu, calculado a
  partir das avaliações recebidas. Começa em 100%.
