import { useCallback, useEffect, useState } from 'react'
import { rpcAuth, pegarToken, limparToken } from './lib/api'
import type { Eu } from './lib/tipos'
import Entrar from './telas/Entrar'
import Onboarding from './telas/Onboarding'
import Descobrir from './telas/Descobrir'
import Jogos from './telas/Jogos'
import Chat from './telas/Chat'
import Ranking from './telas/Ranking'
import Perfil from './telas/Perfil'

type Aba = 'descobrir' | 'jogos' | 'chat' | 'ranking' | 'perfil'

const ABAS: { id: Aba; icone: string; nome: string }[] = [
  { id: 'descobrir', icone: '🎾', nome: 'Descobrir' },
  { id: 'jogos', icone: '⚔️', nome: 'Jogos' },
  { id: 'chat', icone: '💬', nome: 'Chat' },
  { id: 'ranking', icone: '🏆', nome: 'Ranking' },
  { id: 'perfil', icone: '👤', nome: 'Perfil' },
]

export default function App() {
  const [eu, setEu] = useState<Eu | null>(null)
  const [estado, setEstado] = useState<'carregando' | 'fora' | 'dentro'>('carregando')
  const [aba, setAba] = useState<Aba>('descobrir')
  const [conversa, setConversa] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!pegarToken()) { setEstado('fora'); return }
    try {
      setEu(await rpcAuth<Eu>('tenis_eu'))
      setEstado('dentro')
    } catch {
      limparToken()
      setEstado('fora')
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // reconta convites/mensagens ao voltar pro app
  useEffect(() => {
    if (estado !== 'dentro') return
    const aoVoltar = () => { if (document.visibilityState === 'visible') carregar() }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [estado, carregar])

  function abrirChat(id: string | null) {
    setConversa(id)
    setAba('chat')
  }

  if (estado === 'carregando') {
    return (
      <div className="app">
        <div className="tela tela--limpa centro" style={{ display: 'grid', placeContent: 'center', minHeight: '100dvh' }}>
          <div className="logo logo--empilhado" style={{ fontSize: 32 }}>
            <span className="bola">🎾</span><b>Amigos do Tênis</b>
          </div>
        </div>
      </div>
    )
  }

  if (estado === 'fora') return <div className="app"><Entrar pronto={carregar} /></div>

  if (!eu) return null

  if (!eu.perfil.onboarding_ok) {
    return (
      <div className="app">
        <Onboarding eu={eu} atualizar={e => { setEu(e); setAba('descobrir') }} />
      </div>
    )
  }

  return (
    <div className="app">
      {aba === 'descobrir' && <Descobrir eu={eu} recarregar={carregar} irParaChat={abrirChat} />}
      {aba === 'jogos' && <Jogos meuId={eu.usuario.id} recarregar={carregar} irParaChat={abrirChat} />}
      {aba === 'chat' && <Chat conversaAberta={conversa} abrir={setConversa} recarregar={carregar} />}
      {aba === 'ranking' && <Ranking cidade={eu.perfil.cidade} />}
      {aba === 'perfil' && (
        <Perfil eu={eu} atualizar={setEu} deslogar={() => { setEu(null); setEstado('fora') }} />
      )}

      {!(aba === 'chat' && conversa) && (
        <nav className="tabs">
          <div className="tabs__interno">
            {ABAS.map(a => {
              const badge = a.id === 'jogos' ? eu.convites_novos + eu.jogos_pendentes
                : a.id === 'chat' ? eu.msgs_novas : 0
              return (
                <button key={a.id} className="tab" data-on={aba === a.id ? '1' : '0'}
                        onClick={() => { setAba(a.id); if (a.id !== 'chat') setConversa(null) }}>
                  <i>{a.icone}</i>
                  {a.nome}
                  {badge > 0 && <span className="tab__bolha">{badge > 9 ? '9+' : badge}</span>}
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
