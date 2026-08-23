/* ---- níveis de jogo (1 a 7) ---- */
export const NIVEIS = [
  { n: 1, curto: 'Iniciante', desc: 'Comecei agora, ainda estou pegando o jeito da raquete' },
  { n: 2, curto: '6ª classe', desc: 'Consigo trocar algumas bolas, mas erro bastante' },
  { n: 3, curto: '5ª classe', desc: 'Mantenho um rally de fundo e saco por cima' },
  { n: 4, curto: '4ª classe', desc: 'Jogo com direção, controlo o ponto e subo à rede' },
  { n: 5, curto: '3ª classe', desc: 'Tenho efeito, tático de jogo e segundo saque confiável' },
  { n: 6, curto: '2ª classe', desc: 'Jogo torneio, ritmo forte e poucos erros não forçados' },
  { n: 7, curto: '1ª classe', desc: 'Nível competitivo alto, disputo as chaves principais' },
] as const

export const nivelNome = (n: number) => NIVEIS.find(x => x.n === n)?.curto ?? '—'
export const nivelDesc = (n: number) => NIVEIS.find(x => x.n === n)?.desc ?? ''

export const DIAS = [
  { d: 0, curto: 'Dom', longo: 'Domingo' },
  { d: 1, curto: 'Seg', longo: 'Segunda' },
  { d: 2, curto: 'Ter', longo: 'Terça' },
  { d: 3, curto: 'Qua', longo: 'Quarta' },
  { d: 4, curto: 'Qui', longo: 'Quinta' },
  { d: 5, curto: 'Sex', longo: 'Sexta' },
  { d: 6, curto: 'Sáb', longo: 'Sábado' },
] as const

export const TURNOS = [
  { t: 'manha', nome: 'Manhã', emoji: '🌅' },
  { t: 'tarde', nome: 'Tarde', emoji: '☀️' },
  { t: 'noite', nome: 'Noite', emoji: '🌙' },
] as const

export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

/* ---- datas ---- */
export function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function somarDias(iso: string, n: number) {
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(a, m - 1, d + n)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

const pad = (n: number) => String(n).padStart(2, '0')

/** '2026-08-23' -> 'sáb, 23/08' (e 'Hoje' / 'Amanhã' quando for o caso) */
export function dataAmigavel(iso: string) {
  if (!iso) return ''
  const hoje = hojeISO()
  if (iso === hoje) return 'Hoje'
  if (iso === somarDias(hoje, 1)) return 'Amanhã'
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(a, m - 1, d)
  return `${DIAS[dt.getDay()].curto.toLowerCase()}, ${pad(d)}/${pad(m)}`
}

/** '19:00:00' -> '19h' | '19:30:00' -> '19h30' */
export function horaAmigavel(h: string) {
  if (!h) return ''
  const [hh, mm] = h.split(':')
  return mm && mm !== '00' ? `${Number(hh)}h${mm}` : `${Number(hh)}h`
}

export function horaCurta(iso: string) {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 'há 5 min', 'há 2 h', 'ontem'... */
export function quandoFoi(iso: string) {
  if (!iso) return ''
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 2) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ontem'
  if (d < 30) return `há ${d} dias`
  return `há ${Math.floor(d / 30)} ${Math.floor(d / 30) === 1 ? 'mês' : 'meses'}`
}

export const iniciais = (nome: string) =>
  nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0]

/** Telefone só com dígitos -> (18) 99999-9999 */
export function formatarTel(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Grade de horários de 30 em 30 minutos, das 6h às 23h30 */
export const HORARIOS = Array.from({ length: 36 }, (_, i) => {
  const h = 6 + Math.floor(i / 2)
  const m = i % 2 ? '30' : '00'
  return `${pad(h)}:${m}`
})
