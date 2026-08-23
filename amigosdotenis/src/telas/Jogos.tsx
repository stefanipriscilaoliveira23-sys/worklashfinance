import { useCallback, useEffect, useState } from 'react'
import { rpcAuth } from '../lib/api'
import { nivelNome, dataAmigavel, horaAmigavel, quandoFoi, HORARIOS, primeiroNome, somarDias, hojeISO } from '../lib/util'
import type { Convite, Jogo } from '../lib/tipos'
import { Avatar, Botao, Campo, Chip, Folha, Girando, Vazio, Aviso, useRecado } from '../ui'

export default function Jogos({ meuId, recarregar, irParaChat }: {
  meuId: string; recarregar: () => void; irParaChat: (id: string) => void
}) {
  const [recebidos, setRecebidos] = useState<Convite[]>([])
  const [enviados, setEnviados] = useState<Convite[]>([])
  const [jogos, setJogos] = useState<Jogo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [contra, setContra] = useState<Convite | null>(null)
  const [resultado, setResultado] = useState<Jogo | null>(null)
  const [avaliar, setAvaliar] = useState<Jogo | null>(null)
  const { recado, erro, ok } = useRecado()

  const carregar = useCallback(async () => {
    try {
      const [c, j] = await Promise.all([
        rpcAuth<{ recebidos: Convite[]; enviados: Convite[] }>('tenis_lista_convites'),
        rpcAuth<{ jogos: Jogo[] }>('tenis_lista_jogos'),
      ])
      setRecebidos(c.recebidos || [])
      setEnviados(c.enviados || [])
      setJogos(j.jogos || [])
    } catch (e) { erro((e as Error).message) } finally { setCarregando(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function responder(c: Convite, acao: string) {
    try {
      const r = await rpcAuth<{ conversa_id?: string }>('tenis_responder', { p_convite: c.id, p_acao: acao })
      if (acao === 'aceitar') {
        ok('Jogo marcado! Chat liberado 🎾')
        recarregar()
        await carregar()
        if (r.conversa_id) setTimeout(() => irParaChat(r.conversa_id!), 700)
        return
      }
      ok(acao === 'recusar' ? 'Convite recusado.' : 'Convite cancelado.')
      recarregar(); carregar()
    } catch (e) { erro((e as Error).message) }
  }

  const proximos = jogos.filter(j => j.status === 'confirmado' && !j.passou)
  const aResolver = jogos.filter(j => j.status === 'confirmado' && j.passou)
  const passados = jogos.filter(j => j.status !== 'confirmado')

  if (carregando) return <div className="tela"><Girando /></div>

  const vazio = !recebidos.length && !enviados.length && !jogos.length

  return (
    <div className="tela">
      <div className="topo">
        <div className="cresce">
          <h1>Jogos</h1>
          <p>Convites, próximos jogos e histórico</p>
        </div>
      </div>

      <Aviso ok={recado?.ok}>{recado?.texto}</Aviso>

      {vazio && (
        <Vazio emoji="🎾" titulo="Nenhum jogo ainda"
               texto="Vá em Descobrir, ache alguém do seu nível e mande o primeiro convite." />
      )}

      {recebidos.length > 0 && (
        <>
          <div className="secao-tit">⚔️ Te desafiaram ({recebidos.length})</div>
          <div className="pilha stagger">
            {recebidos.map(c => (
              <div key={c.id} className="cartao">
                <div className="linha" style={{ marginBottom: 13 }}>
                  <Avatar nome={c.de!.nome} url={c.de!.foto_url} tam={52} />
                  <div className="cresce">
                    <div className="linha__nome">{c.de!.nome}</div>
                    <div className="linha__sub">
                      {nivelNome(c.de!.nivel)}
                      {c.de!.distancia != null && ` · ${c.de!.distancia} km`}
                      {` · ${quandoFoi(c.criado_em)}`}
                    </div>
                  </div>
                  {c.tipo === 'desafio' && <span className="selo selo--roxo">⚔️ Desafio</span>}
                </div>

                <div className="cartao cartao--apertado" style={{ marginBottom: 13, background: 'rgba(0,0,0,.24)' }}>
                  <div className="forte" style={{ fontSize: 16 }}>
                    {dataAmigavel(c.data)} às {horaAmigavel(c.hora)}
                  </div>
                  <div className="mini" style={{ marginTop: 3 }}>
                    {c.modalidade === 'duplas' ? 'Duplas' : 'Simples'}
                    {c.local_texto && ` · ${c.local_texto}`}
                  </div>
                  {c.mensagem && (
                    <p style={{ margin: '10px 0 0', fontSize: 14.5, color: 'var(--txt-2)', fontStyle: 'italic' }}>
                      “{c.mensagem}”
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <Botao bloco onClick={() => responder(c, 'aceitar')}>Aceitar 🎾</Botao>
                  <Botao tipo="vidro" onClick={() => setContra(c)}>Outro horário</Botao>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Botao bloco tipo="fantasma" tam="p" onClick={() => responder(c, 'recusar')}>Recusar</Botao>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {aResolver.length > 0 && (
        <>
          <div className="secao-tit">📝 Como foi o jogo?</div>
          <div className="pilha stagger">
            {aResolver.map(j => (
              <div key={j.id} className="cartao" style={{ borderColor: 'rgba(217,255,61,.34)' }}>
                <div className="linha" style={{ marginBottom: 12 }}>
                  <Avatar nome={j.adversario.nome} url={j.adversario.foto_url} tam={48} />
                  <div className="cresce">
                    <div className="linha__nome">{j.adversario.nome}</div>
                    <div className="linha__sub">{dataAmigavel(j.data)} às {horaAmigavel(j.hora)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Botao bloco onClick={() => setResultado(j)}>Lançar placar</Botao>
                  <Botao tipo="vidro" onClick={() => setAvaliar(j)}>Não rolou</Botao>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {proximos.length > 0 && (
        <>
          <div className="secao-tit">📅 Próximos jogos</div>
          <div className="pilha stagger">
            {proximos.map(j => (
              <div key={j.id} className="cartao">
                <div className="linha">
                  <Avatar nome={j.adversario.nome} url={j.adversario.foto_url} tam={50} />
                  <div className="cresce">
                    <div className="linha__nome">{j.adversario.nome}</div>
                    <div className="linha__sub">
                      {dataAmigavel(j.data)} às {horaAmigavel(j.hora)}
                      {j.local_texto && ` · ${j.local_texto}`}
                    </div>
                  </div>
                  {j.tipo === 'desafio' && <span className="selo selo--roxo">⚔️</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 13 }}>
                  {j.conversa_id && (
                    <Botao bloco tipo="vidro" tam="p" onClick={() => irParaChat(j.conversa_id!)}>💬 Conversar</Botao>
                  )}
                  <Botao tipo="fantasma" tam="p" onClick={async () => {
                    try { await rpcAuth('tenis_cancelar_jogo', { p_jogo: j.id }); ok('Jogo cancelado.'); carregar() }
                    catch (e) { erro((e as Error).message) }
                  }}>Cancelar</Botao>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {enviados.filter(c => c.status === 'pendente').length > 0 && (
        <>
          <div className="secao-tit">⏳ Aguardando resposta</div>
          <div className="pilha stagger">
            {enviados.filter(c => c.status === 'pendente').map(c => (
              <div key={c.id} className="cartao cartao--apertado">
                <div className="linha">
                  <Avatar nome={c.para!.nome} url={c.para!.foto_url} tam={44} />
                  <div className="cresce">
                    <div className="linha__nome">{c.para!.nome}</div>
                    <div className="linha__sub">{dataAmigavel(c.data)} às {horaAmigavel(c.hora)}</div>
                  </div>
                  <Botao tipo="fantasma" tam="p" onClick={() => responder(c, 'cancelar')}>Cancelar</Botao>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {passados.length > 0 && (
        <>
          <div className="secao-tit">🏆 Histórico</div>
          <div className="pilha stagger">
            {passados.map(j => (
              <div key={j.id} className="cartao cartao--apertado">
                <div className="linha">
                  <Avatar nome={j.adversario.nome} url={j.adversario.foto_url} tam={42} />
                  <div className="cresce">
                    <div className="linha__nome">{j.adversario.nome}</div>
                    <div className="linha__sub">
                      {dataAmigavel(j.data)}
                      {j.placar && ` · ${j.placar}`}
                      {j.status === 'cancelado' && ' · cancelado'}
                      {j.status === 'nao_ocorreu' && ' · não rolou'}
                    </div>
                  </div>
                  {j.status === 'realizado' && !j.avaliei && (
                    <Botao tipo="vidro" tam="p" onClick={() => setAvaliar(j)}>Avaliar</Botao>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {contra && (
        <FolhaContraproposta c={contra} fechar={() => setContra(null)}
          aoEnviar={() => { setContra(null); ok('Contraproposta enviada!'); carregar(); recarregar() }}
          aoErro={erro} />
      )}
      {resultado && (
        <FolhaPlacar j={resultado} meuId={meuId} fechar={() => setResultado(null)}
          aoSalvar={() => { const j = resultado; setResultado(null); ok('Placar registrado! 🏆'); carregar(); setTimeout(() => setAvaliar(j), 450) }}
          aoErro={erro} />
      )}
      {avaliar && (
        <FolhaAvaliacao j={avaliar} fechar={() => setAvaliar(null)}
          aoSalvar={() => { setAvaliar(null); ok('Obrigado! Isso ajuda todo mundo.'); carregar() }}
          aoErro={erro} />
      )}
    </div>
  )
}

/* ---------------- contraproposta ---------------- */
function FolhaContraproposta({ c, fechar, aoEnviar, aoErro }: {
  c: Convite; fechar: () => void; aoEnviar: () => void; aoErro: (m: string) => void
}) {
  const [data, setData] = useState(c.data)
  const [hora, setHora] = useState(c.hora.slice(0, 5))
  const [local, setLocal] = useState(c.local_texto)
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    setEnviando(true)
    try {
      await rpcAuth('tenis_responder', {
        p_convite: c.id, p_acao: 'contrapropor',
        p: { data, hora, local_texto: local.trim(), mensagem: msg.trim() },
      })
      aoEnviar()
    } catch (e) { aoErro((e as Error).message); setEnviando(false) }
  }

  return (
    <Folha aberta titulo="Propor outro horário" fechar={fechar}
           sub={`${primeiroNome(c.de!.nome)} recebe sua proposta e pode aceitar.`}>
      <div className="chips">
        {Array.from({ length: 8 }, (_, i) => somarDias(hojeISO(), i)).map(d => (
          <Chip key={d} on={data === d} onClick={() => setData(d)}>{dataAmigavel(d)}</Chip>
        ))}
      </div>
      <div className="dupla" style={{ marginTop: 18 }}>
        <Campo label="Horário">
          <select value={hora} onChange={e => setHora(e.target.value)}>
            {HORARIOS.map(h => <option key={h} value={h}>{horaAmigavel(h)}</option>)}
          </select>
        </Campo>
        <Campo label="Onde">
          <input value={local} onChange={e => setLocal(e.target.value)} placeholder="Nome da quadra" />
        </Campo>
      </div>
      <Campo label="Recado (opcional)">
        <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Nesse horário fica melhor pra mim" />
      </Campo>
      <Botao bloco tam="g" onClick={enviar} carregando={enviando}>Enviar proposta</Botao>
    </Folha>
  )
}

/* ---------------- placar ---------------- */
function FolhaPlacar({ j, meuId, fechar, aoSalvar, aoErro }: {
  j: Jogo; meuId: string; fechar: () => void; aoSalvar: () => void; aoErro: (m: string) => void
}) {
  const [placar, setPlacar] = useState('')
  const [venceu, setVenceu] = useState<'eu' | 'ele' | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!venceu) return aoErro('Diga quem venceu.')
    setSalvando(true)
    try {
      await rpcAuth('tenis_registrar_placar', {
        p_jogo: j.id, p_placar: placar.trim(),
        p_vencedor: venceu === 'ele' ? j.adversario.id : meuId,
      })
      aoSalvar()
    } catch (e) { aoErro((e as Error).message); setSalvando(false) }
  }

  return (
    <Folha aberta titulo="Como terminou? 🏆" fechar={fechar}
           sub="O resultado alimenta seu ranking e ajusta seu nível com o tempo.">
      <div className="secao-tit">Quem venceu</div>
      <div className="grade-2">
        <button className="cartao cartao--clicavel centro" onClick={() => setVenceu('eu')}
                style={venceu === 'eu' ? { borderColor: 'var(--lima)', background: 'rgba(217,255,61,.1)' } : undefined}>
          <div style={{ fontSize: 30 }}>🙋</div>
          <div className="forte" style={{ marginTop: 5 }}>Eu venci</div>
        </button>
        <button className="cartao cartao--clicavel centro" onClick={() => setVenceu('ele')}
                style={venceu === 'ele' ? { borderColor: 'var(--lima)', background: 'rgba(217,255,61,.1)' } : undefined}>
          <div style={{ fontSize: 30 }}>🎾</div>
          <div className="forte" style={{ marginTop: 5 }}>{primeiroNome(j.adversario.nome)}</div>
        </button>
      </div>
      <div style={{ marginTop: 18 }}>
        <Campo label="Placar (opcional)">
          <input value={placar} onChange={e => setPlacar(e.target.value)} placeholder="6/4 3/6 7/5" />
        </Campo>
      </div>
      <Botao bloco tam="g" onClick={salvar} carregando={salvando} desativado={!venceu}>Salvar resultado</Botao>
    </Folha>
  )
}

/* ---------------- avaliação ---------------- */
function FolhaAvaliacao({ j, fechar, aoSalvar, aoErro }: {
  j: Jogo; fechar: () => void; aoSalvar: () => void; aoErro: (m: string) => void
}) {
  const [compareceu, setCompareceu] = useState(true)
  const [nivelOk, setNivelOk] = useState(3)
  const [convivencia, setConvivencia] = useState(5)
  const [comentario, setComentario] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    try {
      await rpcAuth('tenis_avaliar', {
        p_jogo: j.id, p_compareceu: compareceu,
        p_nivel_ok: nivelOk, p_convivencia: convivencia, p_comentario: comentario.trim(),
      })
      aoSalvar()
    } catch (e) { aoErro((e as Error).message); setSalvando(false) }
  }

  return (
    <Folha aberta titulo={`Como foi com ${primeiroNome(j.adversario.nome)}?`} fechar={fechar}
           sub="Só vocês dois sabem. Isso mantém o app confiável pra todo mundo.">
      <div className="secao-tit">A pessoa apareceu?</div>
      <div className="chips">
        <Chip on={compareceu} onClick={() => setCompareceu(true)}>✅ Apareceu</Chip>
        <Chip on={!compareceu} onClick={() => setCompareceu(false)}>❌ Deu bolo</Chip>
      </div>

      {compareceu && (
        <>
          <div className="secao-tit">O nível batia com o do perfil?</div>
          <div className="chips">
            {[[1, 'Bem abaixo'], [2, 'Um pouco abaixo'], [3, 'Bateu certinho'], [4, 'Um pouco acima'], [5, 'Bem acima']].map(([v, t]) => (
              <Chip key={v as number} on={nivelOk === v} onClick={() => setNivelOk(v as number)}>{t as string}</Chip>
            ))}
          </div>

          <div className="secao-tit">Foi legal jogar?</div>
          <div className="chips">
            {[1, 2, 3, 4, 5].map(v => (
              <Chip key={v} on={convivencia >= v} onClick={() => setConvivencia(v)}>⭐</Chip>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <Campo label="Comentário (aparece no perfil dele)">
              <input value={comentario} onChange={e => setComentario(e.target.value)}
                     placeholder="Jogo duro, cara gente boa" maxLength={140} />
            </Campo>
          </div>
        </>
      )}

      <Botao bloco tam="g" onClick={salvar} carregando={salvando}>Enviar avaliação</Botao>
    </Folha>
  )
}
