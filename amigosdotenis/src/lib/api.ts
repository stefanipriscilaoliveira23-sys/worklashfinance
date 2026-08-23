import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL as string
const CHAVE = import.meta.env.VITE_SUPABASE_KEY as string

export const sb = createClient(URL, CHAVE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/* ---- sessão (token próprio do Amigos do Tênis) ---- */
const CHAVE_TOKEN = 'amigosdotenis.token'

export const pegarToken = () => localStorage.getItem(CHAVE_TOKEN)
export const guardarToken = (t: string) => localStorage.setItem(CHAVE_TOKEN, t)
export const limparToken = () => localStorage.removeItem(CHAVE_TOKEN)

/** Chama uma função do banco. Devolve os dados ou lança o erro em português. */
export async function rpc<T = any>(nome: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await sb.rpc(nome, args)
  if (error) throw new Error(traduzir(error.message))
  if (data && typeof data === 'object' && 'erro' in (data as any)) {
    throw new Error(String((data as any).erro))
  }
  return data as T
}

/** Chamada autenticada: injeta o token da sessão. */
export async function rpcAuth<T = any>(nome: string, args: Record<string, unknown> = {}): Promise<T> {
  const token = pegarToken()
  if (!token) throw new Error('SEM_SESSAO')
  return rpc<T>(nome, { p_token: token, ...args })
}

function traduzir(msg: string) {
  if (/fetch|network|Failed to fetch/i.test(msg)) return 'Sem conexão. Verifique sua internet.'
  return msg
}

/* ---- entrar / criar conta ---- */
export type Sessao = { token: string; usuario: { id: string; nome: string; telefone: string } }

export async function entrar(telefone: string, senha: string) {
  const r = await rpc<Sessao>('tenis_login', { p_telefone: telefone, p_senha: senha })
  guardarToken(r.token)
  return r
}

export async function criarConta(nome: string, telefone: string, senha: string, nascimento: string | null) {
  const r = await rpc<Sessao>('tenis_criar_conta', {
    p_nome: nome, p_telefone: telefone, p_senha: senha,
    p_nascimento: nascimento || null,
  })
  guardarToken(r.token)
  return r
}

export async function sair() {
  const token = pegarToken()
  if (token) { try { await rpc('tenis_logout', { p_token: token }) } catch { /* ignora */ } }
  limparToken()
}

/* ---- foto ---- */
export async function subirFoto(arquivo: File, usuarioId: string) {
  const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase()
  const caminho = `amigosdotenis/${usuarioId}-${Date.now()}.${ext}`
  const { error } = await sb.storage.from('fotos').upload(caminho, arquivo, { upsert: true })
  if (error) throw new Error('Não consegui enviar a foto. Tente outra.')
  const { data } = sb.storage.from('fotos').getPublicUrl(caminho)
  return data.publicUrl
}
