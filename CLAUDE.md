# Escritório Worklash

Sistema de gestão do negócio da Stéfani: financeiro (receitas, despesas, DRE, projeção,
cofrinho, dívidas), mentoria (mentoradas, parcelas, pipeline, POPs), comercial
(scripts, produtos, formulários), clientes e agenda.

Era feito no Lovable. Saiu de lá em 09/08/2026 e agora vive aqui.

## Onde está no ar

- **Produção (Vercel):** https://escritorio-worklash.vercel.app
- **Antigo (Lovable):** https://worklashfinance.lovable.app, **não é mais usado** (06/10/2026)
- **Repositório:** https://github.com/stefanipriscilaoliveira23-sys/worklashfinance (branch `main`)

## Stack

Vite + React 18 + TypeScript + Tailwind + shadcn/ui + React Router + TanStack Query.
Banco e login em Supabase (`@supabase/supabase-js`).

## Como publicar uma alteração

```bash
npm run build && vercel --prod --yes
```

O deploy é pela CLI, não pelo GitHub. A conta do Vercel não tem "login connection"
com o GitHub, então a integração automática não foi possível. Se ela conectar o
GitHub no Vercel depois, dá pra trocar por deploy automático a cada push.

**O Lovable não é mais usado** (confirmado por ela em 06/10/2026). Toda alteração
nasce aqui, vai pro GitHub e é publicada pelo Vercel. Não citar o Lovable como
parte do fluxo. Se o projeto antigo de lá ainda estiver ligado a este repositório,
ele só recebe os commits; ninguém edita por lá.

## Banco de dados

Migrado em 10/08/2026 para o Supabase **dela**, dentro do projeto `apps-ste`
(`qqindzwxxhntmvtpetqr`), que também hospeda os outros apps. O banco antigo do
Lovable (`juwbmteuwckicdzhqjpa`) continua existindo mas o app não usa mais.

O app não depende mais da conta do Lovable pra funcionar.

Como o `apps-ste` hospeda outros apps com cadastro aberto, o acesso ao Escritório
NÃO pode ser "qualquer usuário logado". Quem manda é `public.tem_acesso_escritorio(uid)`,
que exige cargo em `user_roles`. E o gatilho `on_auth_user_created` do Lovable
(que dava cargo automático a todo usuário novo do projeto) foi deixado de fora
de propósito, junto com a função `handle_new_user`. Não religar nenhum dos dois.

Tamanho da migração, já levantado:
- 45 tabelas, ~28 mil linhas (`clientes` sozinha tem 25.946)
- 4 usuários de login
- 3 buckets de arquivos (`documentos`, `contratos-mentoria`, `mentoria-imports`)
- 3 edge functions, todas scripts de importação pontual, **nenhuma usada pelo app
  em runtime**. Só usam `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, que o próprio
  Supabase fornece. Nenhuma dependência de chave externa.
- 1 secret (`LOVABLE_API_KEY`), não usado por nenhuma function
- 51 migrations em `supabase/migrations/`, que recriam o schema inteiro

Ou seja: a migração é viável e sem pegadinha. Falta só a vaga no Supabase.

## Variáveis de ambiente

`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.
Estão configuradas no Vercel (production, preview e development) e também no `.env`
do repositório. Quando o banco mudar, tem que trocar **nos dois
lugares**, senão o build local pega o valor antigo do `.env`.

## Segurança

Ver `CORRIGIR-SEGURANCA.sql`. Oito permissões do banco foram criadas com nome
"Authenticated can ..." mas concedidas ao papel `public`, que inclui visitante não
logado. Enquanto não rodar aquele script, a lista de clientes é legível por qualquer
um e receitas/parcelas/pagamentos podem ser apagados por qualquer um.

O repositório é **público** e tem o `.env` commitado. A chave `anon` do Supabase não
é secreta por natureza (ela vai no bundle do navegador de qualquer jeito), então o
problema real não é a chave estar exposta, é a permissão frouxa acima. Ainda assim,
vale deixar o repositório privado.

A página pública de agendamento (`/agendar/:slug`) é a única rota fora do login.
Ela só lê `agenda_tipos`, `agenda_disponibilidade`, `agenda_bloqueios` e `anfitrioes`,
e grava por RPC (`criar_agendamento_publico`, `agenda_slots_ocupados`). **Não mexer
nas permissões públicas dessas quatro tabelas**, senão o agendamento quebra.

## Senha e e-mail (adicionado em 10/08/2026)

O app ganhou "Esqueci minha senha" na tela de login (`/auth`) e a tela
`/redefinir-senha`. Não existia nada disso antes.

Dois detalhes que custaram caro e não podem ser esquecidos:

1. **A URL de redirecionamento precisa estar liberada no Supabase.** O projeto
   vinha com Site URL `http://localhost:3000` de fábrica, então o link do e-mail
   ia parar num endereço morto. Foi corrigido em Authentication > URL
   Configuration: Site URL `https://escritorio-worklash.vercel.app` e Redirect
   URL `https://escritorio-worklash.vercel.app/**`. Se o domínio mudar, tem que
   atualizar lá, senão o link do e-mail quebra de novo e sem aviso.

2. **Não confie no `detectSessionInUrl` da biblioteca.** A primeira versão
   dependia dele e dava "Auth session missing" na hora de salvar. A versão atual
   captura `access_token`/`refresh_token` do hash no carregamento do módulo
   (antes do supabase-js limpar a URL), chama `setSession` explicitamente, e
   ainda tenta de novo caso a sessão se perca entre abrir a tela e salvar.

**Limite de e-mail:** o Supabase grátis só manda **2 e-mails por hora** pelo
serviço embutido, que é só pra teste. Com 4 pessoas pra cadastrar isso trava.
A solução é ligar um SMTP próprio (Resend tem 3.000/mês grátis) em
Authentication > Emails > SMTP Settings.

## Notificações no celular / app instalável (23/08/2026)

O app virou instalável (PWA) e ganhou notificação push.

**Arquivos:** `public/manifest.webmanifest`, `public/sw.js` e os ícones
`icone-192/512`, `icone-maskable-512`, `apple-touch-icon`. Os links ficam no
`index.html`. O service worker é registrado em `src/main.tsx`, mas **não pede
permissão nenhuma sozinho**: isso só acontece pelo botão em Configurações >
Minha conta.

**O service worker não guarda nada em cache, de propósito.** Só trata `push` e
`notificationclick`. Cache de app já causou confusão aqui (Safari servindo
versão velha por horas). Se um dia precisar funcionar offline, é decisão
separada.

**Como o push funciona:**
1. A pessoa toca em "Ativar neste aparelho" → o navegador pede permissão →
   nasce uma inscrição, guardada em `push_inscricoes` (uma por aparelho).
2. Qualquer linha nova em `notificacoes` dispara o gatilho
   `trg_push_notificacao`, que chama a edge function `push` via `pg_net`.
3. A function busca as inscrições da pessoa e envia.

Ou seja: **tudo que aparece no sininho vira push automaticamente**, sem precisar
duplicar regra em lugar nenhum.

**Segurança do disparo.** A function só aceita `enviar` de duas origens: o papel
de serviço, ou o gatilho do banco, que se identifica pelo cabeçalho `x-gatilho`
com o segredo de `push_config.gatilho_segredo`. Esse segredo foi **gerado pelo
próprio banco** (`gen_random_uuid()`), nunca passou por chat. As chaves VAPID
também são geradas dentro da edge function na primeira chamada. `push_config`
está com RLS ligada e **sem policy nenhuma**: só o service role lê.

**Duas armadilhas, ambas custaram tempo:**

1. **Importar supabase-js por `jsr:` junto com `npm:web-push` derruba a função
   com 500 mudo.** Trocar para `npm:@supabase/supabase-js@2` resolveu. A função
   `mnq-push` (do app Mulheres nas Quadras, no mesmo projeto) já usava `npm:` e
   funcionava, o que serviu de comparação. `setVapidDetails` em si funciona,
   isso foi confirmado com uma função de diagnóstico.

2. **Toda edge function precisa de try/catch que devolva a mensagem.** O 500 do
   Supabase vem como "Internal Server Error" puro e esconde a causa.

**No iPhone só funciona com o app instalado na tela de início.** Não é limitação
nossa, é da Apple. A tela em Minha conta detecta isso e mostra o passo a passo em
vez de um botão que não funcionaria.

**Pendência:** existe uma edge function `push-diagnostico` que foi usada só para
o teste acima. Ela só devolve o tamanho das chaves, nunca o valor, e exige
token. Pode ser apagada no painel do Supabase.

## Quais avisos existem e de onde saem (23/08/2026)

Tudo que entra em `notificacoes` vira sininho **e** push, pelo gatilho
`trg_push_notificacao`. Então basta criar a linha; o resto é automático.

**A geração NÃO acontece mais no navegador.** Era assim antes e só existia se
alguém abrisse o app, o que torna impossível avisar de reunião com o celular no
bolso. Hoje quem gera é o banco, por `pg_cron`.

| Aviso | Quem gera | Quando |
|---|---|---|
| Uma linha por conta vencendo hoje | `gerar_notificacoes_do_dia()` | 07:00 |
| Mentoria vencendo em 7 dias | `gerar_notificacoes_do_dia()` | 07:00 |
| Resumo de reuniões do dia | `gerar_notificacoes_do_dia()` | 07:00 |
| Tarefas do dia de cada pessoa | `gerar_notificacoes_do_dia()` | 07:00 |
| Compromisso daqui 1 hora | `gerar_lembretes_de_reuniao()` | a cada 5 min |
| Venda registrada | gatilho `trg_aviso_venda` em `receitas` | na hora |

Jobs: `escritorio-avisos-do-dia` (`0 10 * * *`) e `escritorio-lembrete-reuniao`
(`*/5 * * * *`). **O relógio do pg_cron é UTC**: 10:00 UTC = 07:00 em São Paulo.
Se o horário de verão voltar, isso precisa ser revisto.

**Nada repete, por causa da coluna `notificacoes.chave`**, com índice único por
(destinatário, chave). Cada aviso tem identidade própria: `conta-emp:<id>:<data>`,
`reuniao-1h:<id>`, `venda:<id>`, `mentoria-vence:<id>:<data>`. Aviso avulso pode
deixar `chave` nula e aí repete à vontade.

**A janela do lembrete de reunião precisa ser maior que o intervalo do cron.**
Roda de 5 em 5 minutos e pega reuniões entre 55 e 70 minutos à frente. Se a
janela ficar menor que o intervalo, reunião escapa entre duas passadas.

**Venda importada em massa não vira aviso** (`if NEW.importado then return`),
senão uma importação de planilha dispara centenas de push.

**Quem recebe:** avisos de dinheiro, agenda e mentoria vão para quem tem cargo
`admin` (hoje só a Stéfani). Tarefas do dia vão para cada pessoa da equipe. Para
incluir a equipe nos avisos de venda, trocar o filtro `role = 'admin'` em
`avisar_venda_registrada()`.

## Perdoar multa e juros de uma parcela (23/08/2026)

Multa (10%) e juros (1%/mês) **não são gravados**, são calculados na hora em
`src/lib/parcelaCalc.ts`. Por isso a isenção precisou virar coluna: sem marca no
banco, no dia seguinte a cobrança voltaria sozinha.

Colunas novas em `parcelas_mentoria_detalhe`: `encargos_isentos`,
`isencao_motivo`, `isentado_por`, `isentado_em`.

**O botão fica dentro de "Registrar Pagamento"** (`PagamentoDialog`), e só
aparece quando a parcela está atrasada ou já isenta. Mostra na hora quanto está
sendo perdoado, separando multa e juros.

**Uma decisão que vale registrar: o botão perdoa multa E juros, não só juros.**
Na prática os juros são irrisórios em atraso curto. Caso real de 23/08: parcela
de R$ 167 com 2 dias de atraso dá **R$ 16,70 de multa e R$ 0,11 de juros**.
Perdoar só os juros seria perdoar onze centavos, ou seja, não resolveria o
problema que a Stéfani descreveu (aluna que pagou no fim de semana, ou atrasou
um ou dois dias).

**A isenção vale em todo lugar**, porque tudo passa por `computeParcela`:
o cartão da parcela, o total atualizado e **a mensagem de cobrança**
(`mensagensTemplates.ts` recebe `encargos_isentos` pelo `TemplateContext`).
Esse último era o ponto mais fácil de esquecer: sem ele, a aluna isenta ainda
receberia no WhatsApp uma cobrança com juros.

No cartão, parcela perdoada mostra um aviso próprio em vez da caixa vermelha com
valores zerados, senão parece erro de cálculo.

## Desfazer pagamento de despesa (23/08/2026)

`src/components/despesas/SituacaoPagamentoCard.tsx`, usado no diálogo de editar
de `DespesasEmpresa` e `DespesasPessoal`. Mostra status, valor, pago, saldo e o
histórico dos pagamentos, com botão de **voltar para não paga** (com confirmação,
porque mexe em relatório) e de **marcar como paga**.

**Por que funciona sem tocar em relatório nenhum:** DRE, Dashboard, P&L Diário,
Início e Projeção leem `status`, `valor_pago_total` e `saldo_pendente` da
**própria despesa**. Ninguém lê `pagamentos_parciais` para despesas: ali é só
log de escrita. Então corrigir a despesa corrige tudo.

Ao desfazer, os registros em `pagamentos_parciais` daquela despesa são apagados
junto, senão fica histórico afirmando um pagamento que não aconteceu. O status
volta para `A Vencer` ou `Em Atraso`, conforme a data de vencimento.

**Isso NÃO foi feito para receitas, de propósito.** Receita não tem conceito de
paga/não paga (`status` é sempre `ativo`), e — o mais importante — **nenhum
relatório filtra receita por status**. Criar um status "cancelado" sem alterar
as 5+ consultas faria a receita cancelada continuar somando em tudo, calada.
Se for fazer, tem que mexer nas consultas junto.

## O Raio-X do Negócio (antiga Dashboard) e as regras de número

`/dashboard` virou **Raio-X do Negócio** (nome escolhido por ela em 28/09/2026), com seis abas: Visão geral, Faturamento, Vendas,
Recebimentos, Despesas e resultado e Renovações. A rota `/bi` redireciona para
`/dashboard`.

Todo o cálculo mora num lugar só: `src/hooks/usePainel.ts`. As abas são só
desenho, em `src/components/painel/`. Quem for mexer em número mexe no hook.

**A aba Mentoria (`src/pages/Mentoria.tsx`) não faz parte disso.** Ela é a
gestão das alunas, com a pipeline e a fase de cada uma, e continua intacta.

### As quatro definições que a Stéfani usa

| O que ela pergunta | Como se calcula |
| --- | --- |
| Vendas novas do mês | `sum(receitas.valor_bruto)` das receitas com `data` no mês |
| Parcelas recebidas no mês | parcelas com `status = 'Quitado'` **e** `data_pagamento` no mês |
| Total vendido no mês | contrato fechado: `valorVendido()` de cada receita do mês |
| Total recebido no mês | vendas novas + parcelas recebidas |

Vendido e recebido são coisas diferentes de propósito: numa mentoria parcelada
o contrato inteiro é vendido hoje, mas o dinheiro pinga por meses.

### Os três campos furados da tabela `receitas`

Descobertos em 28/09/2026 investigando por que o líquido aparecia **maior** que
o bruto em algumas categorias, o que é impossível.

**1. `valor_em_brl` não serve para nada. Nunca use.** É cópia de `valor_bruto`,
e seis lançamentos manuais antigos vieram com **zero** (R$ 8.197 no total). O
`DRE.tsx` lia esse campo e por isso mostrava R$ 8.197 a menos que a realidade.
As seis linhas foram corrigidas pela migração
`receitas_corrigir_valor_em_brl_zerado` e o DRE passou a ler `valor_bruto`.

**2. `valor_bruto` já está em real, inclusive nas vendas em dólar.** As 270
linhas com `moeda_original = 'USD'` vieram da importação da Hotmart já
convertidas pela PTAX. Não multiplique por `taxa_cambio` de novo.

**3. `valor_contrato` vem ZERADO em 1.383 linhas.** A importação das
plataformas grava `0` em vez de deixar vazio, e uma linha antiga ficou com
contrato menor que a própria entrada. Um `coalesce(valor_contrato, valor_bruto)`
faz essas 1.383 vendas (R$ 78.175) sumirem do total vendido. Por isso existe:

```ts
valorVendido(r) => Math.max(r.valor_contrato ?? 0, r.valor_bruto ?? 0)
```

O contrato nunca pode ser menor que o que já foi pago dele, então pegar o maior
dos dois resolve os dois defeitos. `src/pages/Receitas.tsx` já usava a mesma
defesa antes; agora o padrão está num lugar só.

**`valor_liquido` é confiável**, mas não tente derivá-lo de
`bruto - taxa_plataforma_valor`: em 278 linhas importadas a taxa não foi
preenchida e o líquido veio direto do relatório da plataforma.

### A armadilha das 1.000 linhas

`receitas` já passou de 1.000 registros, que é o teto que o Supabase devolve
por consulta. A função `buscarTudo()` no hook pagina com `.range()`. Qualquer
consulta nova que some a tabela inteira sem paginar vai dar número errado sem
avisar.

### Comparação com o mês passado

Comparar um mês pela metade com um mês inteiro assusta à toa. O painel compara
**até o mesmo dia**: no dia 28 de setembro, compara com 1 a 28 de agosto.

### O Business Intelligence foi desmontado (28/09/2026)

A Stéfani revisou aba por aba e o veredito foi que só **Origens** era coerente.
O resto ou mentia, ou repetia coisa que já existia, ou não explicava a conta.
`src/pages/BusinessIntelligence.tsx` foi apagado (está no histórico do git) e o
conteúdo que valia foi para onde faz sentido:

- **Origens** → aba Vendas, agora com ticket médio e % por origem. Atenção: uma
  venda pode ter várias origens marcadas, então o % é sobre a soma das origens.
- **Funil** → era mentira de nome: mostrava *categoria de produto*, não funil.
  Funil para ela é o caminho que traz a venda, que é a Origem. Removido.
- **Inadimplência** → aba Recebimentos, reescrita (ver abaixo).
- **Retenção e Renovações** → aba Renovações, reescrita (ver abaixo).
- **CPA** → removido. A aba Tráfego pago do CRM já faz isso com dado real.

### Pró-labore é despesa fixa de verdade (28/09/2026)

A dúvida dela era "sobrou 46 mil, mas eu não tenho esse dinheiro". Estava certo:
o painel só descontava os custos da empresa.

A decisão dela: **o pró-labore é lançado como despesa FIXA da empresa, e vale o
TOTAL das despesas pessoais do mês, fixas mais variáveis.** O motivo é direto:
pró-labore é quanto ela tirou da empresa, e ela tirou tudo que gastou.

> A primeira versão usou só as contas FIXAS e ela corrigiu no mesmo dia: "o pró
> labore é o valor total de fixas + variáveis". Em setembro a diferença era
> grande, R$ 20.241,43 contra R$ 32.785,43. A divisão fixo/variável continua
> existindo, mas como detalhe de **para onde** a retirada foi, não como limite
> dela.

**A linha nasce PAGA** nos meses que já começaram, e "A Vencer" nos futuros.
Antes ela espelhava o pago/não pago das contas pessoais, e com isso entrava na
lista de contas **atrasadas da empresa** mostrando "faltam R$ 10.102,43". Isso
é enganoso: conta pessoal em aberto não é dívida da empresa com ninguém. Quem
controla o que foi pago é a tela de despesas pessoais.

- Categoria nova `Pró-labore` no enum `despesa_categoria_empresa`.
- Função `sincronizar_pro_labore(date)` cria ou atualiza a despesa do mês. É
  idempotente: rodar de novo só atualiza o valor.
- Gatilho `trg_pro_labore_acompanhar` em `despesas_pessoal` chama a função a
  cada insert/update/delete, então o valor nunca fica velho. Escreve em
  `despesas_empresa`, nunca em `despesas_pessoal`, então não há recursão.
- Rodado para os 11 meses que já tinham conta fixa pessoal (fev a dez/2026).

**A armadilha do dinheiro contado duas vezes.** Com o pró-labore dentro de
`despesas_empresa`, descontar também os gastos pessoais do mesmo resultado faria
o mesmo dinheiro sair duas vezes. Por isso o hook tem dois totais:

| Campo | O que é |
| --- | --- |
| `custosEmpresa` | tudo, **com** pró-labore |
| `custosOperacionais` | tudo, **sem** pró-labore |

E três leituras:

```
EMPRESA  entrou − (operacional + pró-labore)   = resultadoEmpresa
VOCÊ     pró-labore − gastos pessoais          = sobraPessoal
OS DOIS  entrou − operacional − gastos pessoais = sobrouDeVerdade
```

Setembro/2026, conferido no banco:

```
pró-labore do mês      R$ 32.785,43
  contas fixas         R$ 20.241,43   62%
  gasto do dia a dia   R$ 12.544,00   38%
```

Como o pró-labore passou a ser igual ao gasto pessoal, `sobraPessoal` virou zero
por construção e **não serve mais de leitura**. Ela só tem sentido em mês antigo
sem pró-labore lançado. No lugar dela, a aba mostra a divisão acima: quanto da
retirada foi para compromisso que repete e quanto para o dia a dia. Foi isso que
ela pediu: "o que foi retirado para despesas fixas e o que foi para despesas
pessoais".

O histórico de 12 meses no gráfico usa a mesma separação: a barra de custo da
empresa é a **operacional**, senão o pró-labore apareceria junto com a barra do
gasto pessoal.

### Categoria tem que contar a parcela

Perguntar "quanto entrou de consultoria" olhando só `receitas` dá resposta
errada. A consultoria da Alana foi R$ 10.000: R$ 1.000 de entrada na receita e
R$ 9.000 que caíram em 16/09 como **parcela**. A parcela sabe a categoria pelo
`tipo_mentoria` do contrato, que usa os mesmos nomes de `produto_categoria`.

Por isso cada categoria tem dois números, e eles quase nunca são iguais:
- **vendido** = contrato fechado no mês (só venda nova)
- **entrou** = dinheiro que caiu, incluindo parcela de contrato antigo

Setembro: Consultorias vendeu R$ 22.086,28 e recebeu R$ 22.711,28, sendo
R$ 9.625 de parcela.

### Inadimplência: o comportamento, não o saldo

O saldo em atraso já estava nos cartões. O que faltava era **como as alunas
pagam**. Olha 12 meses de parcelas que já venceram (478 em set/2026):

- 45% pagam em dia, 49% atrasam e pagam, 5% não pagaram
- atraso típico de 3 dias (mediana), média 5,2, pior 108
- 88% das atrasadas entram em até 7 dias
- por aluna: 64 no período, 51 já atrasaram, 7 pararam de pagar

"Parou de pagar" = parcela vencida há mais de 30 dias e ainda aberta.

### Renovação: a esteira, com regra explicável

Para cada aluna os contratos entram em ordem de início. Um contrato conta como
**renovado** quando existe, para a mesma aluna, um contrato posterior com
`is_renovacao = true`. Esse contrato posterior é a renovação dele.

- **dias para renovar** = do fim do contrato antigo até o início da renovação.
  Negativo é bom: renovou antes de terminar.
- **elegível** = já terminou ou termina em até 60 dias e ainda não tem renovação.
  Nada a ver com estar devendo.

### Comparação de contagem não é dinheiro

O componente `Comparacao` tem `formato="numero"`. Sem isso, "33 vendas contra
37" saía escrito como "R$ 37,00". Só a contagem de vendas usa esse formato.

## Venda duplicada: plataforma x lançamento à mão

**O que acontecia.** A plataforma (Kiwify, Hotmart) manda a venda sozinha pelo
CRM e ela chega com o valor e a taxa certos. Só que ela chega sem saber **com
quem a equipe conversou**: o campo `crm_card_id` fica com o PEDIDO
(`kiwify:<uuid>`), não com a conversa. Para amarrar a conversa, o Lyncoln
relançava a mesma venda à mão no CRM, e aí ela entrava **duas vezes**.

Aconteceu duas vezes com o Lash Educadora:

| Pessoa | Automática | À mão | Diferença |
| --- | --- | --- | --- |
| Ariana / arydesigner.sb, 28/09 | R$ 107,39 com taxa R$ 11,50 | R$ 97,00 sem taxa | inflava R$ 97 |
| Thamires, 23/09 | R$ 95,56 com taxa R$ 9,64 | R$ 77,00 sem taxa | inflava R$ 77 |

**A regra da Stéfani: vale a automática, porque ela já vem com as taxas.** Mas
a manual tinha o que a automática não tinha: produto certo (a Kiwify mandou
"WorkLash" em vez de "Lash Educadora"), vendedor, origens e a conversa.

**O conserto (migração `juntar_vendas_duplicadas_kiwify_set2026`)** foi uma
fusão, não um descarte: a automática recebeu produto, vendedor, origens e
conversa da manual, e a manual foi arquivada e removida.

### As três peças novas

**1. `receitas.crm_conversa_id`.** A conversa do CRM ganhou coluna própria,
separada de `crm_card_id`. Agora `crm_card_id` é sempre "de onde o registro
veio" e `crm_conversa_id` é "qual conversa gerou". Abre em
`crm.worklash.com.br/inbox?conversationId=<id>`.

**2. `receitas_arquivadas`.** Guarda a linha inteira em JSON antes de remover
uma receita, com o motivo. Nada de receita apagada sem cópia. Para voltar
atrás, basta reinserir o JSON.

**3. `ConversaDoCrm.tsx`**, no modal de editar receita. Procura a pessoa pela
ponte `pessoas` (a mesma da tela Pessoas), abre a ficha dela, lista as
conversas e vincula. **Atenção:** a busca em lista NÃO traz `conversations` —
elas só vêm na ficha individual (`?id=`), então são duas chamadas.

**4. Marca "possível repetida"** na aba Receitas: quando a mesma pessoa
(mesmo e-mail) tem uma venda automática e uma manual em até 3 dias, as duas
linhas ganham a marca. É só aviso, não mexe em número.

### Parcela na aba Receitas

A parcela agora aparece como **"Parcela 3 de 12 · Mentoria Educadora Outsider"** na coluna
Produto, e **herda vendedor e origens da venda que a gerou** (pela
`parcelas_mentoria.receita_id`). Sem isso, o relatório por vendedor perdia todo
o parcelado, que é a maior parte do dinheiro.

O nome puro do produto fica em `produto_nome_base`, usado pelo filtro de
produto e pelo modal de detalhe do Faturado (senão o rótulo da parcela saía
escrito duas vezes).

### O arquivo de tipos estava velho

`src/integrations/supabase/types.ts` não tinha `crm_card_id` nem
`origem_registro`, que já existiam no banco há tempo. Por isso o código antigo
lê esses campos com `(r as any)`. Foram acrescentados junto com
`crm_conversa_id`. Se alguém regerar o arquivo, eles voltam sozinhos.

## O nome é Educadora Outsider, não Lash Outsider

Trocado em 28/09/2026 (migração `renomear_mentoria_para_educadora_outsider`).
Varredura feita em **todas as 1.032 colunas de texto** do schema, não só nas
óbvias. Trocado onde é nome que a gente exibe:

| Onde | Linhas |
| --- | --- |
| `produtos_catalogo.nome` | 2 (Mentoria e Renovação) |
| `receitas.produto_nome` | 79 |
| `notificacoes.descricao` | 24 |
| `base_conhecimento.conteudo` | 15 |
| `mentorada_tarefas.descricao` | 18 (as de grupo ficaram) |
| `processos_etapa.descricao` | 4 (as de grupo ficaram) |
| `mentoradas.observacao` | 3 |
| `eo_plano_acao.passo_a_passo` | 3 |

**Cuidado: "Lash Educadora" é outro produto** (digital, R$ 97, 58 vendas). Não
tem nada a ver com a mentoria e não foi tocado.

### O que NÃO se troca, e por quê

- **`venda_produto_mapa.nome_origem`** — é o nome do produto *dentro da Kiwify*.
  É por ele que o webhook reconhece a venda. Renomear quebra a entrada
  automática. A tabela é justamente o dicionário "nome da plataforma → produto
  do catálogo".
- **`crm_vendas_desfazer.etiqueta`** — registro de qual etiqueta foi criada no
  CRM. A etiqueta de verdade mora no CRM; mudar o registro quebra o desfazer.
- **Qualquer linha com `chat.whatsapp.com`** — é o nome real dos grupos no
  WhatsApp ("Grupo Lash Outsider", "Grupo Recados Lash Outsider"). Só trocar
  depois que os grupos forem renomeados lá.
- **`site_educadoras.headline`** — bio escrita pela própria educadora, sobre a
  formação dela. Não se reescreve texto de outra pessoa. (Estas são as únicas
  com grafia diferente de "Lash Outsider", em minúsculas.)
- **`criacao_mensagens.anexo`** — transcrição de evento, é registro do que foi
  dito.
- **`eo_conteudo.corpo`** — minuta de contrato: `por meio da mentoria "Lash
  Outsider"`. Mexer em texto de contrato precisa de decisão dela.
- **`eo_depoimentos.contexto`** — diz de qual grupo veio o depoimento.

As migrações antigas ainda têm o nome velho (ex.:
`20260729235808_*.sql`, que semeou `processos_etapa`). Migração é registro do
que foi rodado e não se edita; o estado certo é o do banco.

## Consultorias faltava no código

A categoria `Consultorias` foi criada no banco em 28/09/2026, mas as listas
**no código** ficaram sem ela, então não dava para escolher Consultorias ao
lançar venda nem ao cadastrar produto. Corrigido em seis lugares:

`NovaReceitaModal`, `ImportarPlanilhaModal`, `ProdutoSheet`, `ProdutosMargem`,
`Receitas` e `integrations/supabase/types.ts` (o union e o `Constants`).

A aba Receitas ganhou **Consultorias**, reaproveitando a tabela de Mentorias,
porque consultoria é vendida do mesmo jeito: contrato fechado mais parcelas.
`renderMentoriasTable(rotulo)` recebe o nome da coluna.

**Lição:** acrescentar valor num enum do Postgres não termina no banco. Procurar
por listas do enum escritas à mão antes de dizer que está pronto.

## O P&L Diário estava com quatro defeitos (28/09/2026)

Revisado a pedido dela. Os dois primeiros davam número errado calado.

**1. Categoria fora da lista virava NaN e contaminava o mês.** O código fazia:

```ts
const col = CATEGORY_COLS.find(c => c.cats.includes(cat));
if (col) rev[col.key] += valor;
else rev.outras += valor;      // <- "outras" nunca existiu em rev
```

`rev` só era inicializado com as chaves de `CATEGORY_COLS`, e `outras` não era
uma delas. `undefined += n` dá **NaN**, o total do dia virava NaN e o **saldo
acumulado ficava NaN dali até o fim do mês**. Enquanto só existiam as quatro
categorias antigas o `else` nunca rodava. **Quando a categoria Consultorias
nasceu, o P&L quebrou.** Agora `Consultorias` tem coluna e `Outras` existe de
verdade.

**2. O pró-labore era lido e jogado no lixo.** Havia um
`PRO_LABORE_DEFAULT = 30000` e uma consulta a `configuracoes` (valor gravado:
25.000), mas a variável **nunca era usada em conta nenhuma**. Um comentário
dizia "Pro-labore já incluso nas despesas da empresa", o que era falso: não
existia nenhuma linha de pró-labore em `despesas_empresa`. Resultado: o P&L
mostrava lucro sem descontar a maior saída fixa do negócio. Hoje o pró-labore é
despesa de verdade e tem coluna própria.

**3. A categoria `Outros` de despesa da empresa não estava em nenhum grupo
fixo.** Caía no `else` e ia para "Outros Fixos", o que por sorte era o destino
certo. Agora está declarada.

**4. O CSV exportado tinha cabeçalho escrito à mão**, que já não batia com as
colunas e referenciava `r.outras` (inexistente). Passou a ser gerado a partir de
`CATEGORY_COLS` e `FIXED_CATEGORIES`, então nunca mais sai fora de ordem.

**Conferência de fechamento.** O P&L e o Raio-X chegam ao mesmo número por
caminhos diferentes, o que é o teste que importa:

- P&L: `bruto + parcelas − taxa − variável − fixo`
- Raio-X: `líquido + parcelas − custos`, com `líquido = bruto − taxa`

São a mesma conta rearranjada. Se um dia divergirem, um dos dois está errado.

## Despesa pessoal parcelada (28/09/2026)

`despesas_pessoal` ganhou `total_parcelas`, `numero_parcela_atual` e
`despesa_pai_id`, iguais às da empresa.

No modal de nova despesa pessoal existe "Eu parcelei essa compra". O campo é
**quantas parcelas ainda faltam**, que é como ela pensa: já pagou algumas no
cartão e quer lançar só o que vai sair. O valor é o de **uma** parcela.

Cria uma linha por parcela, uma em cada mês, com o nome `Compra (3/10)`, todas
apontando para a parcela 1 por `despesa_pai_id`.

**Fica marcada como `Fixa` de propósito**: parcela de compra é compromisso que
sai todo mês, então tem que entrar na conta do pró-labore junto com aluguel e
financiamento. Como o gatilho recalcula o pró-labore, lançar um parcelado novo
aumenta o pró-labore do mês sozinho.

Dia 31 em mês de 30 cai para o último dia do mês (`d.setDate(0)`).

A página mostra **"Compras parceladas que ainda vão sair"**, agrupando pelo nome
sem o `(3/10)` e somando só as parcelas não pagas.

## Dependência de faturamento: por serviço e por cliente ativa

O painel mostrava as 5 maiores clientes dos últimos 12 meses. Ela apontou o
problema: cliente que já terminou não é risco de perder, ela já foi.

Agora são duas leituras:

- **Por serviço** (12 meses): qual produto sustenta o faturamento, somando venda
  e parcela, com quantidade de clientes de cada um.
- **Por cliente com entrega ativa**: só quem tem `data_fim_mentoria` ou
  `data_fim_prevista` em aberto. O peso de cada uma é `já recebido + ainda a
  receber`, porque é disso que os próximos meses dependem.

## Atraso de parcela: o mês escolhido x todos os meses

Parcela vencida em julho continua vencida hoje, então o total em atraso é de
todos os meses. Só que numa tela navegada por mês isso confunde, e ela apontou:
"no raio-x do negócio, ele tá puxando em atraso não só de setembro".

Agora existem os dois recortes no hook:

| Campo | O que é |
| --- | --- |
| `emAtrasoValor`, `vencidas` | tudo que está vencido hoje, qualquer mês |
| `emAtrasoDoMes`, `vencidasDoMes` | só o que venceu no mês escolhido |

- **Visão geral** usa o do mês, com o total aparecendo no detalhe. É coerente com
  os outros cartões, que são todos do mês.
- **Recebimentos** usa o total, porque ali a leitura é da carteira inteira, mas o
  título diz "todos os meses" e o detalhe mostra o do mês.

Setembro/2026: R$ 928,00 venceram no mês, R$ 4.809,00 somando tudo.

## O "já pago" tinha que ser por fatia, não do total

Na aba Despesas e resultado, o bloco "A conta da SUA VIDA" mostrava:

```
Para onde foi
  Contas fixas        R$ 20.241,43   62%
  Gasto do dia a dia  R$ 12.544,00   38%
  ---
  Já pago             R$ 22.683,00
  Ainda em aberto     R$ 10.102,43
```

O "já pago" era do **total**, mas por estar logo abaixo da linha das fixas ele
lia como se fosse das fixas, e R$ 22.683 é maior que R$ 20.241, o que é
impossível. Ela pegou isso sozinha: *"o já pago não seria já pago das contas
fixas porque a gente já tem gastos do dia a dia, né?"*. Exatamente.

Setembro/2026:

| | Total | Pago | Em aberto |
| --- | --- | --- | --- |
| Contas fixas | R$ 20.241,43 | R$ 10.139,00 | R$ 10.102,43 |
| Gasto do dia a dia | R$ 12.544,00 | R$ 12.544,00 | R$ 0,00 |
| **Total** | **R$ 32.785,43** | **R$ 22.683,00** | **R$ 10.102,43** |

O gasto do dia a dia é sempre 100% pago, porque é pago na hora. Todo o valor em
aberto é conta fixa que ainda não venceu ou não foi marcada.

Agora cada fatia carrega o próprio pago (`pessoalFixasPago`,
`pessoalVariaveisPago` no hook) e o total aparece embaixo de um rótulo
"Somando as duas". **Número de total nunca fica solto embaixo de uma linha de
detalhe**, senão é lido como pertencente a ela.
