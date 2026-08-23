import { chromium } from 'playwright'

/* Testa a interface inteira com o banco simulado.
   O banco de verdade já foi testado direto no SQL. */

const hoje = new Date().toISOString().slice(0, 10)
const jogadorB = {
  id: 'b-2222', nome: 'Marina Prado', foto_url: null, nivel: 4, rating: 1010,
  cidade: 'Araçatuba', uf: 'SP', bairro: 'Vila Mendonça', mao: 'canhoto', estilo: '',
  bio: 'Jogo de fundo de quadra, prefiro saibro.', joga_simples: true, joga_duplas: true,
  tem_quadra: 'clube', clube: 'Tênis Clube', jogos: 12, vitorias: 7, derrotas: 5,
  confiabilidade: 92, avaliacoes: 8, visto_em: new Date().toISOString(), distancia: 1.2,
  livre_hoje: { hora_ini: '19:00:00', hora_fim: '21:00:00', obs: 'Quadra reservada' },
  disponibilidade: [{ dia: 2, turno: 'noite' }], convite_pendente: false, conversa_id: 'cv-1',
}
const eu = {
  usuario: { id: 'a-1111', nome: 'Stéfani Oliveira', telefone: '18999998888', foto_url: null, nascimento: null },
  perfil: {
    cidade: 'Araçatuba', uf: 'SP', bairro: 'Centro', lat: -21.2, lng: -50.4, nivel: 5, rating: 1024,
    mao: 'destro', joga_simples: true, joga_duplas: true, genero: 'F', estilo: '', bio: 'Voltando a jogar depois de uma pausa.',
    tem_quadra: 'clube', clube: 'Tênis Clube', raio_km: 25, nivel_min: 4, nivel_max: 6,
    aceita_genero: 'todos', jogos: 12, vitorias: 8, derrotas: 4, faltas: 0, avaliacoes: 9,
    confiabilidade: 100, onboarding_ok: true, ativo: true,
  },
  disponibilidade: [{ dia: 2, turno: 'noite' }, { dia: 4, turno: 'noite' }],
  livre_hoje: null, convites_novos: 1, msgs_novas: 2, jogos_pendentes: 1,
}
const respostas = {
  tenis_login: { token: 'tok-teste', usuario: eu.usuario },
  tenis_criar_conta: { token: 'tok-teste', usuario: eu.usuario },
  tenis_eu: eu,
  tenis_descobrir: { jogadores: [jogadorB] },
  tenis_convidar: { ok: true, convite_id: 'c-1' },
  tenis_publicar_livre: { ...eu, livre_hoje: { data: hoje, hora_ini: '18:00:00', hora_fim: '21:00:00', obs: '' } },
  tenis_lista_convites: {
    recebidos: [{ id: 'c-9', tipo: 'desafio', modalidade: 'simples', data: hoje, hora: '19:00:00',
      local_texto: 'Quadra 3', mensagem: 'Bora um set?', status: 'pendente',
      criado_em: new Date().toISOString(), de: jogadorB }],
    enviados: [],
  },
  tenis_lista_jogos: {
    jogos: [{ id: 'j-1', data: hoje, hora: '20:30:00', local_texto: 'Quadra 3', modalidade: 'simples',
      tipo: 'desafio', status: 'confirmado', placar: '', vencedor_id: null, passou: false,
      avaliei: false, adversario: jogadorB, conversa_id: 'cv-1' }],
  },
  tenis_lista_conversas: {
    conversas: [{ id: 'cv-1', ultima_em: new Date().toISOString(), com: jogadorB,
      ultima_msg: 'Fechado! Levo as bolas.', nao_lidas: 2 }],
  },
  tenis_msgs: {
    com: jogadorB,
    mensagens: [
      { id: 'm1', texto: 'Desafio aceito! Jogo marcado para 23/08 as 20:30 - Quadra 3.', meu: true, criado_em: new Date().toISOString() },
      { id: 'm2', texto: 'Fechado! Levo as bolas.', meu: false, criado_em: new Date().toISOString() },
    ],
    jogo: { id: 'j-1', data: hoje, hora: '20:30:00', local_texto: 'Quadra 3', status: 'confirmado' },
  },
  tenis_enviar_msg: { ok: true },
  tenis_ranking: {
    escopo: 'cidade', cidade: 'Araçatuba', uf: 'SP',
    lista: [
      { pos: 1, id: 'a-1111', nome: 'Stéfani Oliveira', foto_url: null, nivel: 5, rating: 1024, jogos: 12, vitorias: 8, derrotas: 4, cidade: 'Araçatuba', uf: 'SP', eu: true },
      { pos: 2, id: 'b-2222', nome: 'Marina Prado', foto_url: null, nivel: 4, rating: 1010, jogos: 12, vitorias: 7, derrotas: 5, cidade: 'Araçatuba', uf: 'SP', eu: false },
      { pos: 3, id: 'c-3333', nome: 'Rafael Bueno', foto_url: null, nivel: 6, rating: 988, jogos: 9, vitorias: 4, derrotas: 5, cidade: 'Araçatuba', uf: 'SP', eu: false },
    ],
  },
  tenis_responder: { ok: true, conversa_id: 'cv-1', jogo_id: 'j-1' },
  tenis_salvar_perfil: eu,
  tenis_salvar_disponibilidade: eu,
}

const erros = []
const nav = await chromium.launch({ executablePath: process.env.CHROME || undefined })
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const p = await ctx.newPage()
p.on('console', m => { if (m.type() === 'error') erros.push(m.text()) })
p.on('pageerror', e => erros.push('ERRO DE TELA: ' + e.message))

// ordem importa: no Playwright a ultima rota registrada tem prioridade,
// entao o curinga vem primeiro e o especifico depois.
await p.route('**://*.supabase.co/**', r =>
  r.fulfill({ status: 200, contentType: 'application/json',
              headers: { 'access-control-allow-origin': '*' }, body: '{}' }))

await p.route('**/rest/v1/rpc/**', async rota => {
  const fn = rota.request().url().split('/rpc/')[1].split('?')[0]
  await rota.fulfill({
    status: 200, contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(respostas[fn] ?? { ok: true }),
  })
})

let falhas = 0
const passo = async (nome, fn) => {
  try { await fn(); console.log('  ✓ ' + nome) }
  catch (e) { falhas++; console.log('  ✗ ' + nome + ' :: ' + e.message.split('\n')[0]) }
}
const foto = n => p.screenshot({ path: `${process.env.SP}/${n}.png` })

await p.goto('http://127.0.0.1:4321/', { waitUntil: 'domcontentloaded' })

await passo('tela de login carrega', async () => {
  await p.waitForSelector('text=Ache com quem jogar', { timeout: 10000 })
})
await foto('01-login')

await passo('faz login e cai no Descobrir', async () => {
  await p.getByPlaceholder('(18) 99999-9999').fill('18999998888')
  await p.getByPlaceholder('Mínimo 4 caracteres').fill('teste1234')
  await p.getByRole('button', { name: /Entrar/ }).click()
  await p.waitForSelector('.tabs', { timeout: 12000 })
  await p.waitForSelector('text=Marina Prado', { timeout: 8000 })
})
await p.waitForTimeout(900)
await foto('02-descobrir')

await passo('card mostra "livre hoje" e distância', async () => {
  await p.waitForSelector('text=Livre hoje')
  await p.waitForSelector('text=1.2 km')
})

await passo('badges das abas aparecem', async () => {
  const b = await p.locator('.tab__bolha').count()
  if (b < 2) throw new Error('esperava 2 badges, achei ' + b)
})

await passo('arrastar o card pra direita abre o convite', async () => {
  const card = p.locator('.jogador-card').last()
  const cx = await card.boundingBox()
  await p.mouse.move(cx.x + cx.width / 2, cx.y + cx.height / 2)
  await p.mouse.down()
  await p.mouse.move(cx.x + cx.width / 2 + 170, cx.y + cx.height / 2, { steps: 12 })
  await p.mouse.up()
  await p.waitForSelector('text=/Mandar (convite|desafio)/', { timeout: 6000 })
})
await p.waitForTimeout(500)
await foto('03-convite')

await passo('convite tem dias, horário e tipo', async () => {
  await p.waitForSelector('text=Hoje')
  await p.waitForSelector('text=Amanhã')
  await p.waitForSelector('text=Desafio (vale ranking)')
})

await passo('envia o convite', async () => {
  await p.getByRole('button', { name: /Mandar (convite|desafio)/ }).click()
  await p.waitForSelector('text=Convite enviado', { timeout: 6000 })
})
await foto('04-convite-enviado')

await passo('abre "Bora jogar hoje"', async () => {
  await p.getByText('Bora jogar hoje?').click()
  await p.waitForSelector('text=Tô livre!', { timeout: 6000 })
})
await p.waitForTimeout(400)
await foto('05-livre-hoje')
await p.locator('.folha-fundo').click({ position: { x: 8, y: 8 } })
await p.waitForTimeout(400)

await passo('aba Jogos mostra o desafio recebido', async () => {
  await p.locator('.tab').nth(1).click()
  await p.waitForSelector('h1:has-text("Jogos")', { timeout: 6000 })
  await p.waitForSelector('text=Te desafiaram', { timeout: 6000 })
  await p.waitForSelector('text=Bora um set?')
})
await p.waitForTimeout(700)
await foto('06-jogos')

await passo('botão "outro horário" abre a contraproposta', async () => {
  await p.getByRole('button', { name: 'Outro horário' }).click()
  await p.waitForSelector('text=Propor outro horário', { timeout: 6000 })
})
await foto('07-contraproposta')
await p.locator('.folha-fundo').click({ position: { x: 8, y: 8 } })
await p.waitForTimeout(400)

await passo('aba Chat lista a conversa', async () => {
  await p.locator('.tab').nth(2).click()
  await p.waitForSelector('h1:has-text("Conversas")', { timeout: 6000 })
  await p.waitForSelector('text=Fechado! Levo as bolas.', { timeout: 6000 })
})
await p.waitForTimeout(600)
await foto('08-chat-lista')

await passo('abre a conversa e envia mensagem', async () => {
  await p.locator('.cartao--clicavel').first().click()
  await p.waitForSelector('.conversa__baixo input', { timeout: 6000 })
  await p.waitForSelector('text=JOGO MARCADO')
  await p.locator('.conversa__baixo input').fill('Bora! Confirmo sim')
  await p.locator('.conversa__baixo .redondo--sim').click()
  await p.waitForSelector('.balao:has-text("Bora! Confirmo sim")', { timeout: 6000 })
})
await p.waitForTimeout(600)
await foto('09-conversa')

await passo('volta e abre o Ranking', async () => {
  await p.locator('.conversa__topo .redondo').click()
  await p.waitForTimeout(400)
  await p.locator('.tab').nth(3).click()
  await p.waitForSelector('h1:has-text("Ranking")', { timeout: 6000 })
  await p.waitForSelector('.pos--1', { timeout: 6000 })
  await p.waitForSelector('text=· você')
})
await p.waitForTimeout(600)
await foto('10-ranking')

await passo('abre o Perfil com as estatísticas', async () => {
  await p.locator('.tab').nth(4).click()
  await p.waitForSelector('h1:has-text("Meu perfil")', { timeout: 6000 })
  await p.waitForSelector('text=Aproveit.')
  await p.waitForSelector('text=3ª classe')
})
await p.waitForTimeout(600)
await foto('11-perfil')

await passo('abre a edição de perfil', async () => {
  await p.getByText('Editar perfil e preferências').click()
  await p.waitForSelector('text=Distância máxima', { timeout: 6000 })
})
await p.waitForTimeout(400)
await foto('12-editar')
await p.locator('.folha-fundo').click({ position: { x: 8, y: 8 } })
await p.waitForTimeout(300)

await passo('abre a grade de horários', async () => {
  await p.getByText('Meus horários').click()
  await p.waitForSelector('text=Salvar horários', { timeout: 6000 })
})
await p.waitForTimeout(400)
await foto('13-horarios')

// onboarding: simula perfil novo
await p.locator('.folha-fundo').click({ position: { x: 8, y: 8 } })
await passo('onboarding aparece pra quem é novo', async () => {
  await p.route('**/rest/v1/rpc/tenis_eu', r => r.fulfill({
    status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ ...eu, perfil: { ...eu.perfil, onboarding_ok: false, cidade: '', bio: '' } }),
  }))
  await p.reload({ waitUntil: 'domcontentloaded' })
  await p.waitForSelector('text=Vamos montar seu perfil', { timeout: 10000 })
})
await p.waitForTimeout(700)
await foto('14-onboarding')

await passo('onboarding avança até o nível', async () => {
  await p.getByRole('button', { name: 'Continuar' }).click()
  await p.waitForSelector('text=Onde você joga?', { timeout: 6000 })
  await p.getByPlaceholder('Araçatuba').fill('Araçatuba')
  await p.getByRole('button', { name: 'Continuar' }).click()
  await p.waitForSelector('text=Qual seu nível?', { timeout: 6000 })
})
await p.waitForTimeout(600)
await foto('15-onboarding-nivel')

console.log('\n' + (falhas ? `${falhas} passo(s) falharam` : 'Todos os passos passaram'))
console.log('Erros de console: ' + (erros.length ? '\n  - ' + erros.join('\n  - ') : 'nenhum'))
await nav.close()
process.exit(falhas ? 1 : 0)
