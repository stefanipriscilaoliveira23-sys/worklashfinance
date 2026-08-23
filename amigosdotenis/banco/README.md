# Banco do Amigos do Tênis

Projeto Supabase: **outros-projetos** (`neernbcttnluwjjchsss`, região `sa-east-1`).

Esse projeto Supabase abriga **dois aplicativos separados**, que não compartilham
usuário, login nem dado nenhum:

| App | Tabelas |
|---|---|
| **Saque na Barragem** (torneio) | `atletas`, `sessoes`, `inscricoes`, `config`, `regras`, `novidades`, `patrocinadores` |
| **Amigos do Tênis** | tudo com prefixo `tenis_` |

Quem tem conta no torneio **não** entra no Amigos do Tênis com ela. Cada app tem
sua própria base — foi testado: telefone de atleta do torneio recebe "telefone ou
senha incorretos" aqui.

## Login próprio

- `tenis_usuarios` — nome, telefone (único), senha em bcrypt, foto, nascimento
- `tenis_sessoes` — um token por login
- `tenis_criar_conta()`, `tenis_login()`, `tenis_logout()`, `tenis_trocar_senha()`

## Modelo de segurança

Todas as tabelas `tenis_*` têm **RLS ligado e nenhuma policy**. Isso é
intencional: ninguém lê nem escreve tabela direto pela API. Todo acesso passa
por funções `SECURITY DEFINER` que recebem o token da sessão, descobrem quem é o
usuário e só devolvem o que é dele.

As funções auxiliares (prefixo `_tenis_`) tiveram o `EXECUTE` revogado de `anon`
e `authenticated` — elas só rodam de dentro das funções públicas. Sem isso,
qualquer pessoa poderia abrir uma conversa entre dois jogadores sem convite
aceito.

Os avisos `rls_enabled_no_policy` no painel do Supabase são esperados neste
desenho e não indicam tabela aberta.

## Migrações

Versionadas dentro do próprio Supabase, na ordem em que foram aplicadas:

1. `tenis_rally_tabelas` … `tenis_rally_fechar_funcoes_internas` — primeira
   versão, que ainda usava o login do torneio
2. `tenis_base_propria_tabelas` — base de usuários própria; recria todas as
   tabelas apontando para `tenis_usuarios`
3. `tenis_base_propria_auth_perfil` — cadastro, login, troca de senha, perfil,
   disponibilidade, "livre hoje" e descoberta
4. `tenis_base_propria_convites_jogos_chat` — convites, jogos, chat, ranking,
   segurança e locais

Para baixar o SQL completo para esta pasta:

```bash
npx supabase link --project-ref neernbcttnluwjjchsss
npx supabase db pull
```

## Tabelas

| Tabela | Para quê |
|---|---|
| `tenis_usuarios` / `tenis_sessoes` | Cadastro e login |
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
