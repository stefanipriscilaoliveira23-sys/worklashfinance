# 🎾 Amigos do Tênis

App para tenistas acharem com quem jogar perto de casa, mandarem um desafio e
combinarem o jogo pelo chat. Feito para funcionar no Brasil todo, começando por
Araçatuba/SP.

## Como funciona

```
Cadastro → Perfil de jogo → Descobrir (swipe ou lista)
  → Desafiar (dia, hora, local)
    → Aceitar / Recusar / Contrapropor
      → Chat liberado
        → Jogo confirmado
          → Placar + Avaliação
            → Ranking e reputação
```

O chat **só abre depois do aceite** — isso evita spam e assédio.

## O que já está pronto

| Área | Estado |
|---|---|
| Cadastro e login por celular + senha | ✅ base própria |
| Cadastro guiado em 6 passos | ✅ |
| Descobrir com swipe e lista | ✅ |
| Filtros (livres hoje, turno, modalidade, nível, distância, Brasil todo) | ✅ |
| "Bora jogar hoje" | ✅ |
| Convite, desafio e contraproposta | ✅ |
| Chat em tempo real (atualiza a cada 6s) | ✅ |
| Placar com rating Elo | ✅ |
| Avaliação pós-jogo e índice de presença | ✅ |
| Ranking por cidade / estado / Brasil | ✅ |
| Bloqueio e denúncia | ✅ no banco, ainda sem tela |
| Duplas, quadras no mapa, notificação push | ⏳ próximas fases |

## Rodando na sua máquina

```bash
cd amigosdotenis
npm install
npm run dev        # abre em http://localhost:5173
```

As chaves de conexão ficam em `.env` (veja `.env.example`). A chave usada é a
**publicável** do Supabase — ela é feita para ficar no navegador e não dá acesso
a nada além do que as regras do banco permitem.

## Testes

```bash
npm run build                       # compila e checa os tipos
npx vite preview --port 4321 &      # sobe o app
node teste-e2e.mjs                  # 18 passos de interface, com o banco simulado
```

O teste roda a jornada inteira: login, descoberta, swipe, convite, contraproposta,
chat, ranking, perfil e cadastro guiado. As telas ficam salvas como PNG.

Para apontar um Chrome específico: `CHROME=/caminho/do/chrome node teste-e2e.mjs`.

## Banco de dados

Projeto Supabase: **outros-projetos** (`neernbcttnluwjjchsss`).

Esse projeto guarda **dois apps independentes**, que não compartilham nada:

- **Saque na Barragem** (torneio) — tabelas `atletas`, `sessoes`, `inscricoes`,
  `config`, `regras`, `novidades`, `patrocinadores`
- **Amigos do Tênis** — tudo com o prefixo `tenis_`

Cada um tem sua própria base de usuários e seu próprio login. Quem joga o
torneio **não** entra aqui automaticamente: todo mundo se cadastra do zero.

- `tenis_usuarios` / `tenis_sessoes` — cadastro e login (senha em bcrypt)
- `tenis_perfis` — nível, cidade, coordenadas, preferências, rating, reputação
- `tenis_disponibilidade` — grade semanal (dia × turno)
- `tenis_livre` — "estou livre hoje das 19h às 21h"
- `tenis_locais` — quadras e clubes
- `tenis_convites` — convites, desafios e contrapropostas
- `tenis_jogos` — jogos confirmados, placar, vencedor
- `tenis_conversas` / `tenis_mensagens` — chat
- `tenis_avaliacoes` — presença, nível e convivência
- `tenis_bloqueios` / `tenis_denuncias` — segurança

### Segurança

Todas as tabelas têm RLS ligado **sem nenhuma policy** — ou seja, ninguém acessa
tabela direto pelo navegador. Todo acesso passa por funções `security definer`
que exigem o token da sessão e checam quem é o dono do dado. Foi testado: um
token inválido não lê conversa de ninguém.

## Publicando

O app é um PWA — o tenista abre o link, adiciona na tela inicial e vira um ícone
no celular, sem loja.

```bash
npm run build      # gera a pasta dist/
```

Suba o conteúdo de `dist/` no VPS da Hostinger (ou em qualquer hospedagem
estática). Depois dá para empacotar o mesmo código com Capacitor e publicar na
Play Store e na App Store, sem reescrever nada.

**Falta antes de ir pras lojas:** ícones `public/icone-192.png` e
`public/icone-512.png` (o manifest já aponta pra eles).
