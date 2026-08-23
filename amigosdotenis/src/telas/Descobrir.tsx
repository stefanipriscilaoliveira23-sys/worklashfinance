import { useCallback, useEffect, useRef, useState } from 'react'
import { rpcAuth } from '../lib/api'
import { nivelNome, dataAmigavel, horaAmigavel, hojeISO, somarDias, HORARIOS, TURNOS, primeiroNome } from '../lib/util'
import type { Eu, Jogador } from '../lib/tipos'
import { Avatar, Botao, Campo, Chip, Folha, Girando, Vazio, Aviso, useRecado } from '../ui'

type Filtros = { so_hoje?: boolean; turno?: string; modalidade?: string; busca?: string; escopo?: string }

export default function Descobrir({ eu, recarregar, irParaChat }: {
  eu: Eu; recarregar: () => void; irParaChat: (id: string) => void
}) {
  const [jogadores, setJogadores] = useState<Jogador[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtros, setFiltros] = useState<Filtros>({})
  const [vista, setVista] = useState<'cards' | 'lista'>('cards')
  const [topo, setTopo] = useState(0)
  const [alvo, setAlvo] = useState<Jogador | null>(null)
  const [abrirLivre, setAbrirLivre] = useState(false)
  const { recado, erro, ok } = useRecado()

  const buscar = useCallback(async (f: Filtros) => {
    setCarregando(true)
    try {
      const r = await rpcAuth<{ jogadores: Jogador[] }>('tenis_descobrir', { f })
      setJogadores(r.jogadores || [])
      setTopo(0)
    } catch (e) { erro((e as Error).message) } finally { setCarregando(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { buscar(filtros) }, [filtros, buscar])

  const mexer = (k: keyof Filtros, v: unknown) =>
    setFiltros(f => ({ ...f, [k]: f[k] === v ? undefined : v }))

  const restantes = jogadores.slice(topo)
  const livreHoje = eu.livre_hoje?.data === hojeISO() ? eu.livre_hoje : null

  return (
    <div className="tela">
      <div className="topo">
        <div className="cresce">
          <div className="logo" style={{ fontSize: 23 }}>
            <span className="bola">🎾</span><b>Amigos do Tênis</b>
          </div>
          <p>{eu.perfil.cidade || 'Brasil'} · {jogadores.length} {jogadores.length === 1 ? 'jogador' : 'jogadores'}</p>
        </div>
        <button className="redondo" onClick={() => setVista(v => v === 'cards' ? 'lista' : 'cards')}
                title="Mudar visualização">
          {vista === 'cards' ? '☰' : '🃏'}
        </button>
      </div>

      <Aviso ok={recado?.ok}>{recado?.texto}</Aviso>

      {/* mural da organizadora */}
      {eu.avisos?.map(a => (
        <div key={a.id} className="cartao cartao--apertado" style={{
          marginBottom: 12,
          borderColor: a.tipo === 'alerta' ? 'rgba(255,77,157,.45)'
                     : a.tipo === 'festa'  ? 'rgba(53,228,240,.45)'
                                           : 'rgba(123,92,255,.45)',
          background: a.tipo === 'alerta' ? 'rgba(255,77,157,.09)'
                    : a.tipo === 'festa'  ? 'rgba(53,228,240,.09)'
                                          : 'rgba(123,92,255,.09)',
        }}>
          <div className="linha">
            <div style={{ fontSize: 21 }}>
              {a.tipo === 'alerta' ? '⚠️' : a.tipo === 'festa' ? '🎉' : '📣'}
            </div>
            <div className="cresce">
              <div className="linha__nome">{a.titulo}</div>
              {a.texto && <div className="linha__sub">{a.texto}</div>}
            </div>
          </div>
        </div>
      ))}

      {/* botão de ação principal: bora jogar hoje */}
      <button className={`cartao cartao--clicavel${livreHoje ? '' : ' brilho'}`}
              onClick={() => setAbrirLivre(true)}
              style={{ marginBottom: 14, borderColor: livreHoje ? 'var(--lima)' : undefined }}>
        <div className="linha">
          <div style={{ fontSize: 30 }}>{livreHoje ? '🔥' : '⚡'}</div>
          <div className="cresce">
            <div className="linha__nome">
              {livreHoje ? 'Você está livre hoje!' : 'Bora jogar hoje?'}
            </div>
            <div className="linha__sub">
              {livreHoje
                ? `Das ${horaAmigavel(livreHoje.hora_ini)} às ${horaAmigavel(livreHoje.hora_fim)} · toque pra mudar`
                : 'Avise a galera que você tá disponível'}
            </div>
          </div>
          <span style={{ color: 'var(--txt-3)', fontSize: 22 }}>›</span>
        </div>
      </button>

      {/* filtros */}
      <div className="chips" style={{ marginBottom: 12 }}>
        <Chip on={!!filtros.so_hoje} onClick={() => mexer('so_hoje', true)}>🔥 Livres hoje</Chip>
        {TURNOS.map(t => (
          <Chip key={t.t} on={filtros.turno === t.t} onClick={() => mexer('turno', t.t)}>{t.emoji} {t.nome}</Chip>
        ))}
        <Chip on={filtros.modalidade === 'simples'} onClick={() => mexer('modalidade', 'simples')}>Simples</Chip>
        <Chip on={filtros.modalidade === 'duplas'} onClick={() => mexer('modalidade', 'duplas')}>Duplas</Chip>
        <Chip on={filtros.escopo === 'brasil'} onClick={() => mexer('escopo', 'brasil')} roxo>🇧🇷 Brasil todo</Chip>
      </div>

      {carregando ? <Girando />
        : restantes.length === 0 ? (
          <Vazio
            emoji={jogadores.length ? '🎉' : '🔍'}
            titulo={jogadores.length ? 'Você viu todo mundo!' : 'Ninguém por aqui ainda'}
            texto={jogadores.length
              ? 'Volte mais tarde ou aumente sua distância nas configurações do perfil.'
              : 'Tente tirar os filtros, aumentar a distância ou buscar no Brasil todo.'}
            acao={<Botao tipo="vidro" onClick={() => { setFiltros({}); buscar({}) }}>Limpar filtros</Botao>}
          />
        ) : vista === 'cards' ? (
          <>
            <div className="deck">
              {restantes.slice(0, 3).reverse().map((j, i, arr) => {
                const idx = arr.length - 1 - i
                return (
                  <CardJogador
                    key={j.id} j={j} fundo={idx > 0} profundidade={idx}
                    aoPular={() => setTopo(t => t + 1)}
                    aoDesafiar={() => setAlvo(j)}
                  />
                )
              })}
            </div>
            <div className="deck-acoes">
              <button className="redondo redondo--g redondo--nao" onClick={() => setTopo(t => t + 1)}>✕</button>
              <button className="redondo" onClick={() => setAlvo(restantes[0])} title="Ver perfil">👁</button>
              <button className="redondo redondo--g redondo--sim" onClick={() => setAlvo(restantes[0])}>🎾</button>
            </div>
            <p className="mini centro" style={{ marginTop: 14 }}>
              Arraste o card pro lado ou use os botões
            </p>
          </>
        ) : (
          <div className="pilha stagger">
            {jogadores.map(j => (
              <button key={j.id} className="cartao cartao--apertado cartao--clicavel" onClick={() => setAlvo(j)}>
                <div className="linha">
                  <Avatar nome={j.nome} url={j.foto_url} tam={54} />
                  <div className="cresce">
                    <div className="linha__nome">{j.nome}</div>
                    <div className="linha__sub">
                      {nivelNome(j.nivel)}
                      {j.distancia != null && ` · ${j.distancia} km`}
                      {j.bairro && ` · ${j.bairro}`}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                      {j.livre_hoje && (
                        <span className="selo selo--vivo"><i className="ponto" />Livre hoje</span>
                      )}
                      {j.tem_quadra !== 'nao' && <span className="selo selo--ciano">🎾 Tem quadra</span>}
                      {j.convite_pendente && <span className="selo selo--roxo">Convite em aberto</span>}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

      {alvo && (
        <FolhaConvite
          j={alvo} eu={eu} fechar={() => setAlvo(null)}
          irParaChat={irParaChat}
          aoEnviar={() => { setAlvo(null); setTopo(t => t + 1); ok('Convite enviado! 🎾'); recarregar() }}
          aoErro={erro}
        />
      )}

      <FolhaLivre
        aberta={abrirLivre} fechar={() => setAbrirLivre(false)} atual={livreHoje}
        aoSalvar={() => { setAbrirLivre(false); ok('Avisamos a galera! 🔥'); recarregar(); buscar(filtros) }}
        aoErro={erro}
      />
    </div>
  )
}

/* ---------------- card arrastável ---------------- */
function CardJogador({ j, fundo, profundidade, aoPular, aoDesafiar }: {
  j: Jogador; fundo: boolean; profundidade: number; aoPular: () => void; aoDesafiar: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inicio = useRef<{ x: number; y: number } | null>(null)
  const [dx, setDx] = useState(0)
  const [saindo, setSaindo] = useState<'sim' | 'nao' | null>(null)

  function baixou(e: React.PointerEvent) {
    if (fundo || saindo) return
    inicio.current = { x: e.clientX, y: e.clientY }
    ref.current?.setPointerCapture(e.pointerId)
  }
  function moveu(e: React.PointerEvent) {
    if (!inicio.current) return
    setDx(e.clientX - inicio.current.x)
  }
  function soltou() {
    if (!inicio.current) return
    inicio.current = null
    if (dx > 105) { setSaindo('sim'); setTimeout(aoDesafiar, 180); setTimeout(() => setDx(0), 400) }
    else if (dx < -105) { setSaindo('nao'); setTimeout(aoPular, 240) }
    else setDx(0)
  }

  const giro = dx / 17
  const estilo: React.CSSProperties = fundo
    ? { transform: `scale(${1 - profundidade * 0.045}) translateY(${profundidade * 13}px)`, opacity: 1 - profundidade * 0.28, transition: 'transform .3s, opacity .3s' }
    : saindo
      ? { transform: `translateX(${saindo === 'sim' ? 620 : -620}px) rotate(${saindo === 'sim' ? 26 : -26}deg)`, opacity: 0, transition: 'transform .34s ease-out, opacity .34s' }
      : { transform: `translateX(${dx}px) rotate(${giro}deg)`, transition: inicio.current ? 'none' : 'transform .3s cubic-bezier(.2,.9,.3,1.4)' }

  return (
    <div ref={ref} className="jogador-card" style={estilo}
         onPointerDown={baixou} onPointerMove={moveu} onPointerUp={soltou} onPointerCancel={soltou}>
      {j.foto_url
        ? <img className="jogador-card__foto" src={j.foto_url} alt={j.nome} draggable={false} />
        : <div className="jogador-card__vazio">🎾</div>}
      <div className="jogador-card__sombra" />

      <div className="carimbo carimbo--sim" style={{ opacity: Math.max(0, Math.min(1, dx / 105)) }}>DESAFIAR</div>
      <div className="carimbo carimbo--nao" style={{ opacity: Math.max(0, Math.min(1, -dx / 105)) }}>PASSAR</div>

      <div className="jogador-card__info">
        <div style={{ display: 'flex', gap: 6, marginBottom: 11, flexWrap: 'wrap' }}>
          {j.livre_hoje && <span className="selo selo--vivo"><i className="ponto" />Livre hoje</span>}
          <span className="selo selo--lima">{nivelNome(j.nivel)}</span>
          {j.distancia != null && <span className="selo">📍 {j.distancia} km</span>}
        </div>
        <h2 className="jogador-card__nome">{j.nome}</h2>
        <p className="jogador-card__sub">
          {[j.bairro, j.cidade].filter(Boolean).join(', ')}
          {j.jogos > 0 && ` · ${j.jogos} ${j.jogos === 1 ? 'jogo' : 'jogos'}`}
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {j.joga_simples && <span className="selo">Simples</span>}
          {j.joga_duplas && <span className="selo">Duplas</span>}
          {j.mao === 'canhoto' && <span className="selo">Canhoto</span>}
          {j.tem_quadra !== 'nao' && <span className="selo selo--ciano">🎾 Tem quadra</span>}
        </div>
        {j.livre_hoje && (
          <p className="mini lima" style={{ marginTop: 11, marginBottom: 0 }}>
            🔥 Livre hoje das {horaAmigavel(j.livre_hoje.hora_ini)} às {horaAmigavel(j.livre_hoje.hora_fim)}
            {j.livre_hoje.obs && ` — ${j.livre_hoje.obs}`}
          </p>
        )}
      </div>
    </div>
  )
}

/* ---------------- folha de convite ---------------- */
function FolhaConvite({ j, eu, fechar, aoEnviar, aoErro, irParaChat }: {
  j: Jogador; eu: Eu; fechar: () => void; aoEnviar: () => void
  aoErro: (m: string) => void; irParaChat: (id: string) => void
}) {
  const [data, setData] = useState(j.livre_hoje ? hojeISO() : somarDias(hojeISO(), 1))
  const [hora, setHora] = useState(j.livre_hoje ? j.livre_hoje.hora_ini.slice(0, 5) : '19:00')
  const [local, setLocal] = useState(j.tem_quadra !== 'nao' && j.clube ? j.clube : eu.perfil.clube)
  const [tipo, setTipo] = useState<'amistoso' | 'desafio'>('amistoso')
  const [modalidade, setModalidade] = useState<'simples' | 'duplas'>(j.joga_simples ? 'simples' : 'duplas')
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    setEnviando(true)
    try {
      await rpcAuth('tenis_convidar', {
        p: { para_id: j.id, tipo, modalidade, data, hora, local_texto: local.trim(), mensagem: msg.trim() },
      })
      aoEnviar()
    } catch (e) { aoErro((e as Error).message); setEnviando(false) }
  }

  const dias = Array.from({ length: 8 }, (_, i) => somarDias(hojeISO(), i))

  return (
    <Folha aberta titulo={`Desafiar ${primeiroNome(j.nome)}`}
           sub={`${nivelNome(j.nivel)}${j.distancia != null ? ` · a ${j.distancia} km de você` : ''}`}
           fechar={fechar}>
      <div className="linha" style={{ marginBottom: 20 }}>
        <Avatar nome={j.nome} url={j.foto_url} tam={62} />
        <div className="cresce">
          <div className="linha__nome">{j.nome}</div>
          <div className="linha__sub">
            {j.jogos > 0 ? `${j.vitorias}V · ${j.derrotas}D` : 'Ainda sem jogos por aqui'}
            {j.avaliacoes > 0 && ` · ${j.confiabilidade}% de presença`}
          </div>
        </div>
      </div>

      {j.bio && <p style={{ color: 'var(--txt-2)', fontSize: 14.5, marginTop: 0, marginBottom: 18 }}>{j.bio}</p>}

      {j.convite_pendente ? (
        <>
          <div className="aviso">Já existe um convite em aberto com esse jogador. Veja na aba Jogos.</div>
          <Botao bloco tipo="vidro" onClick={fechar}>Fechar</Botao>
        </>
      ) : (
        <>
          <div className="secao-tit">Tipo</div>
          <div className="chips">
            <Chip on={tipo === 'amistoso'} onClick={() => setTipo('amistoso')}>🤝 Amistoso</Chip>
            <Chip on={tipo === 'desafio'} onClick={() => setTipo('desafio')} roxo>⚔️ Desafio (vale ranking)</Chip>
          </div>

          {(j.joga_simples && j.joga_duplas) && (
            <>
              <div className="secao-tit">Modalidade</div>
              <div className="chips">
                <Chip on={modalidade === 'simples'} onClick={() => setModalidade('simples')}>Simples</Chip>
                <Chip on={modalidade === 'duplas'} onClick={() => setModalidade('duplas')}>Duplas</Chip>
              </div>
            </>
          )}

          <div className="secao-tit">Que dia?</div>
          <div className="chips">
            {dias.map(d => (
              <Chip key={d} on={data === d} onClick={() => setData(d)}>{dataAmigavel(d)}</Chip>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="dupla">
              <Campo label="Horário">
                <select value={hora} onChange={e => setHora(e.target.value)}>
                  {HORARIOS.map(h => <option key={h} value={h}>{horaAmigavel(h)}</option>)}
                </select>
              </Campo>
              <Campo label="Onde">
                <input value={local} onChange={e => setLocal(e.target.value)} placeholder="Nome da quadra" />
              </Campo>
            </div>
            <Campo label="Mensagem (opcional)">
              <textarea value={msg} onChange={e => setMsg(e.target.value)}
                        placeholder="Bora trocar umas bolas? Levo as bolinhas." maxLength={280} />
            </Campo>
          </div>

          <Botao bloco tam="g" onClick={enviar} carregando={enviando}>
            {tipo === 'desafio' ? '⚔️ Mandar desafio' : '🎾 Mandar convite'}
          </Botao>
          {j.conversa_id && (
            <div style={{ marginTop: 10 }}>
              <Botao bloco tipo="fantasma" onClick={() => irParaChat(j.conversa_id!)}>Abrir conversa</Botao>
            </div>
          )}
          <p className="mini centro" style={{ marginTop: 14 }}>
            O chat abre assim que {primeiroNome(j.nome)} aceitar.
          </p>
        </>
      )}
    </Folha>
  )
}

/* ---------------- folha "livre hoje" ---------------- */
function FolhaLivre({ aberta, fechar, atual, aoSalvar, aoErro }: {
  aberta: boolean; fechar: () => void
  atual: { data: string; hora_ini: string; hora_fim: string; obs: string } | null
  aoSalvar: () => void; aoErro: (m: string) => void
}) {
  const [data, setData] = useState(hojeISO())
  const [ini, setIni] = useState('18:00')
  const [fim, setFim] = useState('21:00')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberta) return
    setData(atual?.data ?? hojeISO())
    setIni(atual?.hora_ini?.slice(0, 5) ?? '18:00')
    setFim(atual?.hora_fim?.slice(0, 5) ?? '21:00')
    setObs(atual?.obs ?? '')
  }, [aberta, atual])

  async function salvar(remover = false) {
    setSalvando(true)
    try {
      if (remover) await rpcAuth('tenis_remover_livre', { p_data: data })
      else await rpcAuth('tenis_publicar_livre', { p_data: data, p_ini: ini, p_fim: fim, p_obs: obs.trim() })
      aoSalvar()
    } catch (e) { aoErro((e as Error).message) } finally { setSalvando(false) }
  }

  return (
    <Folha aberta={aberta} fechar={fechar} titulo="Bora jogar! ⚡"
           sub="Avise que você tá livre e apareça no topo pra quem tá procurando jogo.">
      <div className="secao-tit">Que dia</div>
      <div className="chips">
        {Array.from({ length: 5 }, (_, i) => somarDias(hojeISO(), i)).map(d => (
          <Chip key={d} on={data === d} onClick={() => setData(d)}>{dataAmigavel(d)}</Chip>
        ))}
      </div>
      <div className="dupla" style={{ marginTop: 18 }}>
        <Campo label="A partir das">
          <select value={ini} onChange={e => setIni(e.target.value)}>
            {HORARIOS.map(h => <option key={h} value={h}>{horaAmigavel(h)}</option>)}
          </select>
        </Campo>
        <Campo label="Até">
          <select value={fim} onChange={e => setFim(e.target.value)}>
            {HORARIOS.map(h => <option key={h} value={h}>{horaAmigavel(h)}</option>)}
          </select>
        </Campo>
      </div>
      <Campo label="Recado (opcional)">
        <input value={obs} onChange={e => setObs(e.target.value)}
               placeholder="Tenho quadra reservada, falta parceiro" maxLength={120} />
      </Campo>
      <Botao bloco tam="g" onClick={() => salvar()} carregando={salvando}>Tô livre! 🔥</Botao>
      {atual && (
        <div style={{ marginTop: 10 }}>
          <Botao bloco tipo="fantasma" onClick={() => salvar(true)}>Não estou mais livre</Botao>
        </div>
      )}
    </Folha>
  )
}
