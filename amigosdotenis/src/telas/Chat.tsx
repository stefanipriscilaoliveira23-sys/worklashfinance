import { useCallback, useEffect, useRef, useState } from 'react'
import { rpcAuth } from '../lib/api'
import { nivelNome, horaCurta, quandoFoi, dataAmigavel, horaAmigavel, primeiroNome } from '../lib/util'
import type { ItemConversa, Jogador, Mensagem } from '../lib/tipos'
import { Avatar, Girando, Vazio, Aviso, useRecado } from '../ui'

export default function Chat({ conversaAberta, abrir, recarregar }: {
  conversaAberta: string | null; abrir: (id: string | null) => void; recarregar: () => void
}) {
  if (conversaAberta) return <Conversa id={conversaAberta} voltar={() => { abrir(null); recarregar() }} />
  return <ListaConversas abrir={abrir} />
}

function ListaConversas({ abrir }: { abrir: (id: string) => void }) {
  const [itens, setItens] = useState<ItemConversa[]>([])
  const [carregando, setCarregando] = useState(true)
  const { recado, erro } = useRecado()

  useEffect(() => {
    rpcAuth<{ conversas: ItemConversa[] }>('tenis_lista_conversas')
      .then(r => setItens(r.conversas || []))
      .catch(e => erro((e as Error).message))
      .finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (carregando) return <div className="tela"><Girando /></div>

  return (
    <div className="tela">
      <div className="topo">
        <div className="cresce">
          <h1>Conversas</h1>
          <p>O chat abre quando o convite é aceito</p>
        </div>
      </div>

      <Aviso>{recado?.texto}</Aviso>

      {itens.length === 0 ? (
        <Vazio emoji="💬" titulo="Nenhuma conversa ainda"
               texto="Quando alguém aceitar seu convite (ou você aceitar um), a conversa aparece aqui." />
      ) : (
        <div className="pilha stagger">
          {itens.map(c => (
            <button key={c.id} className="cartao cartao--apertado cartao--clicavel" onClick={() => abrir(c.id)}>
              <div className="linha">
                <Avatar nome={c.com.nome} url={c.com.foto_url} tam={52} />
                <div className="cresce">
                  <div className="entre">
                    <span className="linha__nome">{c.com.nome}</span>
                    <span className="mini">{quandoFoi(c.ultima_em)}</span>
                  </div>
                  <div className="linha__sub">{c.ultima_msg || 'Diga oi 👋'}</div>
                </div>
                {c.nao_lidas > 0 && <span className="contador">{c.nao_lidas}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Conversa({ id, voltar }: { id: string; voltar: () => void }) {
  const [msgs, setMsgs] = useState<Mensagem[]>([])
  const [com, setCom] = useState<Jogador | null>(null)
  const [jogo, setJogo] = useState<{ data: string; hora: string; local_texto: string } | null>(null)
  const [texto, setTexto] = useState('')
  const [carregando, setCarregando] = useState(true)
  const fim = useRef<HTMLDivElement>(null)
  const { recado, erro } = useRecado()

  const carregar = useCallback(async (rolar: boolean) => {
    try {
      const r = await rpcAuth<{ com: Jogador; mensagens: Mensagem[]; jogo: typeof jogo }>('tenis_msgs', { p_conversa: id })
      setMsgs(r.mensagens || [])
      setCom(r.com)
      setJogo(r.jogo)
      if (rolar) setTimeout(() => fim.current?.scrollIntoView({ behavior: 'smooth' }), 60)
    } catch (e) { erro((e as Error).message) } finally { setCarregando(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    carregar(true)
    const t = setInterval(() => carregar(false), 6000)   // atualiza sozinho
    return () => clearInterval(t)
  }, [carregar])

  async function enviar() {
    const t = texto.trim()
    if (!t) return
    setTexto('')
    setMsgs(m => [...m, { id: `tmp-${Date.now()}`, texto: t, meu: true, criado_em: new Date().toISOString() }])
    setTimeout(() => fim.current?.scrollIntoView({ behavior: 'smooth' }), 40)
    try { await rpcAuth('tenis_enviar_msg', { p_conversa: id, p_texto: t }); carregar(true) }
    catch (e) { erro((e as Error).message) }
  }

  const atalhos = ['Bora! Confirmo sim 👍', 'Consegue reservar a quadra?', 'Levo as bolinhas 🎾', 'Vou me atrasar uns 10 min']

  return (
    <div className="conversa">
      <div className="conversa__topo">
        <button className="redondo" style={{ width: 42, height: 42, fontSize: 20 }} onClick={voltar}>‹</button>
        {com && <Avatar nome={com.nome} url={com.foto_url} tam={42} />}
        <div className="cresce">
          <div className="linha__nome">{com?.nome ?? '...'}</div>
          <div className="linha__sub">{com ? nivelNome(com.nivel) : ''}</div>
        </div>
      </div>

      {jogo && (
        <div style={{ padding: '11px 16px 0' }}>
          <div className="cartao cartao--apertado" style={{ borderColor: 'rgba(217,255,61,.34)' }}>
            <div className="mini forte lima">🎾 JOGO MARCADO</div>
            <div className="forte" style={{ marginTop: 3 }}>
              {dataAmigavel(jogo.data)} às {horaAmigavel(jogo.hora)}
              {jogo.local_texto && ` · ${jogo.local_texto}`}
            </div>
          </div>
        </div>
      )}

      <div className="conversa__corpo">
        {carregando ? <Girando /> : msgs.length === 0 ? (
          <p className="mini centro" style={{ marginTop: 34 }}>
            Combinem os detalhes por aqui 👇
          </p>
        ) : msgs.map(m => (
          <div key={m.id} className={`balao balao--${m.meu ? 'meu' : 'dele'}`}>
            {m.texto}
            <div className="balao__hora">{horaCurta(m.criado_em)}</div>
          </div>
        ))}
        <div ref={fim} />
      </div>

      <Aviso>{recado?.texto}</Aviso>

      {msgs.length < 4 && com && (
        <div className="chips" style={{ padding: '0 14px 8px' }}>
          {atalhos.map(a => (
            <button key={a} className="chip" onClick={() => setTexto(a)}>{a}</button>
          ))}
        </div>
      )}

      <div className="conversa__baixo">
        <input value={texto} onChange={e => setTexto(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && enviar()}
               placeholder={com ? `Mensagem para ${primeiroNome(com.nome)}` : 'Mensagem'} />
        <button className="redondo redondo--sim" style={{ width: 50, height: 50, fontSize: 21 }}
                onClick={enviar} disabled={!texto.trim()}>➤</button>
      </div>
    </div>
  )
}
