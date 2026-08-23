import { useEffect, useState, type ReactNode } from 'react'
import { iniciais } from './lib/util'

/* ---------- avatar ---------- */
export function Avatar({ nome, url, tam = 48 }: { nome: string; url?: string | null; tam?: number }) {
  return (
    <div className="avatar" style={{ width: tam, height: tam, fontSize: tam * 0.36 }}>
      {url ? <img src={url} alt={nome} loading="lazy" /> : iniciais(nome || '?')}
    </div>
  )
}

/* ---------- botão ---------- */
type BtnProps = {
  children: ReactNode
  onClick?: () => void
  tipo?: 'principal' | 'roxo' | 'vidro' | 'fantasma' | 'perigo'
  tam?: 'p' | 'm' | 'g'
  bloco?: boolean
  desativado?: boolean
  carregando?: boolean
}
export function Botao({ children, onClick, tipo = 'principal', tam = 'm', bloco, desativado, carregando }: BtnProps) {
  return (
    <button
      className={`btn btn--${tipo}${bloco ? ' btn--bloco' : ''}${tam !== 'm' ? ` btn--${tam}` : ''}`}
      onClick={onClick}
      disabled={desativado || carregando}
    >
      {carregando ? '···' : children}
    </button>
  )
}

/* ---------- chip ---------- */
export function Chip({ children, on, onClick, roxo }: {
  children: ReactNode; on?: boolean; onClick?: () => void; roxo?: boolean
}) {
  return (
    <button className={`chip${roxo ? ' chip--roxo' : ''}`} data-on={on ? '1' : '0'} onClick={onClick}>
      {children}
    </button>
  )
}

/* ---------- campo ---------- */
export function Campo({ label, children }: { label?: string; children: ReactNode }) {
  return <div className="campo">{label && <label>{label}</label>}{children}</div>
}

/* ---------- folha (modal de baixo) ---------- */
export function Folha({ titulo, sub, aberta, fechar, children }: {
  titulo: string; sub?: string; aberta: boolean; fechar: () => void; children: ReactNode
}) {
  useEffect(() => {
    if (!aberta) return
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = antes }
  }, [aberta])

  if (!aberta) return null
  return (
    <div className="folha-fundo" onClick={fechar}>
      <div className="folha" onClick={e => e.stopPropagation()}>
        <div className="folha__alca" />
        <h2 className="folha__titulo">{titulo}</h2>
        {sub && <p className="folha__sub">{sub}</p>}
        {children}
      </div>
    </div>
  )
}

/* ---------- estados ---------- */
export const Girando = () => <div className="girando" />

export function Vazio({ emoji, titulo, texto, acao }: {
  emoji: string; titulo: string; texto: string; acao?: ReactNode
}) {
  return (
    <div className="vazio">
      <span className="vazio__emoji">{emoji}</span>
      <h3>{titulo}</h3>
      <p>{texto}</p>
      {acao && <div style={{ marginTop: 20 }}>{acao}</div>}
    </div>
  )
}

export function Aviso({ children, ok }: { children: ReactNode; ok?: boolean }) {
  if (!children) return null
  return <div className={`aviso${ok ? ' aviso--ok' : ''}`}>{children}</div>
}

/* ---------- aviso que some sozinho ---------- */
export function useRecado() {
  const [recado, setRecado] = useState<{ texto: string; ok?: boolean } | null>(null)
  useEffect(() => {
    if (!recado) return
    const t = setTimeout(() => setRecado(null), 4200)
    return () => clearTimeout(t)
  }, [recado])
  return {
    recado,
    erro: (texto: string) => setRecado({ texto }),
    ok: (texto: string) => setRecado({ texto, ok: true }),
    limpar: () => setRecado(null),
  }
}
