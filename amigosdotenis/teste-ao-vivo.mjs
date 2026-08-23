/* Teste de ponta a ponta contra o site publicado e o banco REAL.
   Roda no GitHub Actions, que alcança o github.io e o Supabase.
   Uso: SITE=https://... TEL=00000000000 node teste-ao-vivo.mjs        */
import { chromium } from 'playwright'

const SITE = process.env.SITE
const TEL = process.env.TEL
if (!SITE || !TEL) { console.error('faltou SITE ou TEL'); process.exit(1) }

const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const p = await ctx.newPage()
const erros = []
p.on('pageerror', e => erros.push('ERRO DE TELA: ' + e.message))
p.on('response', r => { if (r.status() >= 400 && !r.url().includes('fonts.g')) erros.push(`HTTP ${r.status()} ${r.url()}`) })

let falhas = 0
const passo = async (nome, fn) => {
  try { await fn(); console.log('  ✓ ' + nome) }
  catch (e) { falhas++; console.log('  ✗ ' + nome + ' :: ' + e.message.split('\n')[0]) }
}

console.log(`\nTestando ${SITE} com o banco de verdade\n`)

await passo('site publicado abre', async () => {
  const r = await p.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 45000 })
  if (!r || r.status() !== 200) throw new Error('HTTP ' + (r && r.status()))
  await p.waitForSelector('text=Ache com quem jogar', { timeout: 20000 })
})

await passo('cria conta nova no banco real', async () => {
  await p.getByRole('button', { name: 'Criar conta' }).click()
  await p.getByPlaceholder('Como te chamam na quadra').fill('Teste Automatico')
  await p.getByPlaceholder('(18) 99999-9999').fill(TEL)
  await p.getByPlaceholder('Mínimo 4 caracteres').fill('teste1234')
  await p.getByRole('button', { name: /Bora começar/ }).click()
  await p.waitForSelector('text=Vamos montar seu perfil', { timeout: 30000 })
})

await passo('passo 1 — nome', async () => {
  await p.getByRole('button', { name: 'Continuar' }).click()
  await p.waitForSelector('text=Onde você joga?', { timeout: 15000 })
})

await passo('passo 2 — cidade', async () => {
  await p.getByPlaceholder('Araçatuba').fill('Araçatuba')
  await p.getByRole('button', { name: 'Continuar' }).click()
  await p.waitForSelector('text=Qual seu nível?', { timeout: 15000 })
})

await passo('passo 3 — nível', async () => {
  await p.getByText('4ª classe', { exact: false }).first().click()
  await p.getByRole('button', { name: 'Continuar' }).click()
  await p.waitForSelector('text=Como você joga?', { timeout: 15000 })
})

await passo('passo 4 — modalidade', async () => {
  await p.getByRole('button', { name: 'Continuar' }).click()
  await p.waitForSelector('text=Quando você joga?', { timeout: 15000 })
})

await passo('passo 5 — horários', async () => {
  await p.getByRole('button', { name: 'Continuar' }).click()
  await p.waitForSelector('text=Com quem você quer jogar?', { timeout: 15000 })
})

await passo('finaliza o cadastro e entra no app', async () => {
  await p.getByRole('button', { name: /Bora jogar/ }).click()
  await p.waitForSelector('.tabs', { timeout: 30000 })
})

await passo('grava "livre hoje" no banco', async () => {
  await p.getByText('Bora jogar hoje?').click()
  await p.waitForSelector('text=Tô livre!', { timeout: 15000 })
  await p.getByRole('button', { name: /Tô livre/ }).click()
  await p.waitForSelector('text=Você está livre hoje', { timeout: 20000 })
})

await passo('navega por todas as abas', async () => {
  for (const [i, titulo] of [[1,'Jogos'],[2,'Conversas'],[3,'Ranking'],[4,'Meu perfil']]) {
    await p.locator('.tab').nth(i).click()
    await p.waitForSelector(`h1:has-text("${titulo}")`, { timeout: 15000 })
  }
})

await passo('sai e faz login de novo', async () => {
  await p.getByRole('button', { name: 'Sair da conta' }).click()
  await p.waitForSelector('text=Ache com quem jogar', { timeout: 20000 })
  await p.getByPlaceholder('(18) 99999-9999').fill(TEL)
  await p.getByPlaceholder('Mínimo 4 caracteres').fill('teste1234')
  await p.getByRole('button', { name: /Entrar/ }).click()
  await p.waitForSelector('.tabs', { timeout: 30000 })
})

await p.screenshot({ path: 'tela-ao-vivo.png' })
console.log('\n' + (falhas ? `${falhas} passo(s) FALHARAM` : 'TODOS OS PASSOS PASSARAM — o app funciona ao vivo'))
console.log('Erros de console: ' + (erros.length ? '\n  - ' + erros.join('\n  - ') : 'nenhum'))
await nav.close()
process.exit(falhas ? 1 : 0)
