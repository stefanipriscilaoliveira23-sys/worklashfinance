import { useCallback, useEffect, useState } from 'react'
import { rpcAuth } from '../lib/api'
import { NIVEIS, nivelNome, dataAmigavel, horaAmigavel, quandoFoi, formatarTel, UFS } from '../lib/util'
import type { Aviso, AtletaAdmin, Denuncia, Eu, JogoAdmin, Local, Resumo } from '../lib/tipos'
import { Avatar, Botao, Campo, Chip, Folha, Girando, Vazio, Aviso as Alerta, useRecado } from '../ui'

type Secao = 'resumo' | 'atletas' | 'moderacao' | 'jogos' | 'quadras' | 'mural'

const SECOES: { id: Secao; icone: string; nome: string }[] = [
  { id: 'resumo', icone: '📊', nome: 'Visão geral' },
  { id: 'atletas', icone: '👥', nome: 'Atletas' },
  { id: 'moderacao', icone: '🛡️', nome: 'Moderação' },
  { id: 'jogos', icone: '🎾', nome: 'Jogos' },
  { id: 'quadras', icone: '📍', nome: 'Quadras' },
  { id: 'mural', icone: '📣', nome: 'Mural' },
]

export default function Admin({ eu, sair, recarregar }: {
  eu: Eu; sair: () => void; recarregar: () => void
}) {
  const [secao, setSecao] = useState<Secao>('resumo')
  const { recado, erro, ok } = useRecado()

  return (
    <div className="tela tela--limpa">
      <div className="topo">
        <button className="redondo" style={{ width: 44, height: 44, fontSize: 21 }} onClick={sair}>‹</button>
        <div className="cresce">
          <h1 style={{ fontSize: 26 }}>Organizadora</h1>
          <p>Você também joga — isso aqui é só o painel</p>
        </div>
      </div>

      <Alerta ok={recado?.ok}>{recado?.texto}</Alerta>

      <div className="chips" style={{ marginBottom: 16 }}>
        {SECOES.map(s => (
          <Chip key={s.id} on={secao === s.id} onClick={() => setSecao(s.id)} roxo>
            {s.icone} {s.nome}
            {s.id === 'moderacao' && eu.denuncias_abertas > 0 ? ` (${eu.denuncias_abertas})` : ''}
          </Chip>
        ))}
      </div>

      {secao === 'resumo'    && <Visao aoErro={erro} />}
      {secao === 'atletas'   && <Atletas aoErro={erro} aoOk={ok} />}
      {secao === 'moderacao' && <Moderacao aoErro={erro} aoOk={ok} recarregar={recarregar} />}
      {secao === 'jogos'     && <Jogos aoErro={erro} />}
      {secao === 'quadras'   && <Quadras aoErro={erro} aoOk={ok} />}
      {secao === 'mural'     && <Mural aoErro={erro} aoOk={ok} recarregar={recarregar} />}
    </div>
  )
}

/* ---------------- visão geral ---------------- */
function Visao({ aoErro }: { aoErro: (m: string) => void }) {
  const [r, setR] = useState<Resumo | null>(null)
  useEffect(() => {
    rpcAuth<Resumo>('tenis_admin_resumo').then(setR).catch(e => aoErro((e as Error).message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (!r) return <Girando />

  const numeros: [string, number, string][] = [
    ['Atletas', r.atletas, 'lima'],
    ['Perfis prontos', r.perfis_prontos, ''],
    ['Ativos na semana', r.ativos_semana, ''],
    ['Livres hoje', r.livres_hoje, 'lima'],
    ['Convites abertos', r.convites_abertos, ''],
    ['Jogos marcados', r.jogos_marcados, ''],
    ['Jogos realizados', r.jogos_feitos, 'lima'],
    ['Denúncias', r.denuncias, r.denuncias > 0 ? 'rosa' : ''],
  ]

  return (
    <div className="stagger">
      <div className="grade-2" style={{ gap: 10 }}>
        {numeros.map(([nome, n, cor]) => (
          <div key={nome} className="cartao cartao--apertado centro">
            <b className={cor} style={{ display: 'block', fontSize: 30, fontWeight: 900, letterSpacing: '-1px' }}>{n}</b>
            <span className="mini">{nome}</span>
          </div>
        ))}
      </div>

      <div className="secao-tit">Onde estão os atletas</div>
      {r.cidades.length === 0 ? (
        <p className="mini" style={{ margin: '0 4px' }}>Ninguém completou o cadastro ainda.</p>
      ) : (
        <div className="pilha">
          {r.cidades.map(c => (
            <div key={c.cidade + c.uf} className="cartao cartao--apertado">
              <div className="linha">
                <div className="cresce"><span className="forte">{c.cidade}</span> <span className="mini">{c.uf}</span></div>
                <span className="selo selo--lima">{c.quantos}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mini centro" style={{ marginTop: 24, lineHeight: 1.6 }}>
        {r.mensagens} mensagens trocadas no chat até agora.
      </p>
    </div>
  )
}

/* ---------------- atletas ---------------- */
function Atletas({ aoErro, aoOk }: { aoErro: (m: string) => void; aoOk: (m: string) => void }) {
  const [lista, setLista] = useState<AtletaAdmin[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState<AtletaAdmin | null>(null)

  const carregar = useCallback(async (q: string) => {
    setCarregando(true)
    try {
      const r = await rpcAuth<{ atletas: AtletaAdmin[] }>('tenis_admin_atletas', { p_busca: q })
      setLista(r.atletas || [])
    } catch (e) { aoErro((e as Error).message) } finally { setCarregando(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { const t = setTimeout(() => carregar(busca), 300); return () => clearTimeout(t) }, [busca, carregar])

  return (
    <div>
      <Campo>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone" />
      </Campo>

      {carregando ? <Girando /> : lista.length === 0 ? (
        <Vazio emoji="👥" titulo="Nenhum atleta" texto="Quando alguém criar conta, aparece aqui." />
      ) : (
        <div className="pilha stagger">
          {lista.map(a => (
            <button key={a.id} className="cartao cartao--apertado cartao--clicavel" onClick={() => setEditando(a)}
                    style={!a.ativo ? { opacity: .55, borderColor: 'rgba(255,77,157,.4)' } : undefined}>
              <div className="linha">
                <Avatar nome={a.nome} url={a.foto_url} tam={46} />
                <div className="cresce">
                  <div className="linha__nome">
                    {a.nome}
                    {a.is_admin && <span className="lima"> · organizadora</span>}
                    {a.eu && <span className="mini"> (você)</span>}
                  </div>
                  <div className="linha__sub">
                    {formatarTel(a.telefone)}
                    {a.pronto ? ` · ${nivelNome(a.nivel)} · ${a.cidade || 'sem cidade'}` : ' · cadastro incompleto'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {!a.ativo && <span className="selo selo--rosa">Suspenso</span>}
                    {a.jogos > 0 && <span className="selo">{a.jogos} jogos</span>}
                    {a.avaliacoes > 0 && (
                      <span className={`selo ${a.confiabilidade >= 80 ? 'selo--lima' : 'selo--rosa'}`}>
                        {a.confiabilidade}% presença
                      </span>
                    )}
                    <span className="selo">visto {quandoFoi(a.visto_em)}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {editando && (
        <FolhaAtleta a={editando} fechar={() => setEditando(null)}
          aoSalvar={m => { setEditando(null); aoOk(m); carregar(busca) }} aoErro={aoErro} />
      )}
    </div>
  )
}

function FolhaAtleta({ a, fechar, aoSalvar, aoErro }: {
  a: AtletaAdmin; fechar: () => void; aoSalvar: (m: string) => void; aoErro: (m: string) => void
}) {
  const [nome, setNome] = useState(a.nome)
  const [cidade, setCidade] = useState(a.cidade)
  const [uf, setUf] = useState(a.uf || 'SP')
  const [nivel, setNivel] = useState(a.nivel)
  const [ativo, setAtivo] = useState(a.ativo)
  const [admin, setAdmin] = useState(a.is_admin)
  const [salvando, setSalvando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  async function salvar() {
    setSalvando(true)
    try {
      await rpcAuth('tenis_admin_editar_atleta', {
        p_alvo: a.id,
        p: { nome: nome.trim(), cidade: cidade.trim(), uf, nivel, ativo, is_admin: admin },
      })
      aoSalvar('Atleta atualizado.')
    } catch (e) { aoErro((e as Error).message); setSalvando(false) }
  }

  async function excluir() {
    try {
      await rpcAuth('tenis_admin_excluir_atleta', { p_alvo: a.id })
      aoSalvar('Atleta excluído.')
    } catch (e) { aoErro((e as Error).message) }
  }

  return (
    <Folha aberta titulo={a.nome} sub={formatarTel(a.telefone)} fechar={fechar}>
      <Campo label="Nome"><input value={nome} onChange={e => setNome(e.target.value)} /></Campo>
      <div className="dupla">
        <Campo label="Cidade"><input value={cidade} onChange={e => setCidade(e.target.value)} /></Campo>
        <Campo label="Estado">
          <select value={uf} onChange={e => setUf(e.target.value)}>
            {UFS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </Campo>
      </div>
      <Campo label="Nível">
        <select value={nivel} onChange={e => setNivel(Number(e.target.value))}>
          {NIVEIS.map(n => <option key={n.n} value={n.n}>{n.curto}</option>)}
        </select>
      </Campo>

      <div className="secao-tit">Situação</div>
      <div className="chips chips--quebra">
        <Chip on={ativo} onClick={() => setAtivo(true)}>✅ Ativo</Chip>
        <Chip on={!ativo} onClick={() => setAtivo(false)}>🚫 Suspenso</Chip>
      </div>
      <p className="mini" style={{ margin: '8px 4px 0' }}>
        Suspenso some da busca e não recebe convite, mas a conta continua existindo.
      </p>

      <div className="secao-tit">Acesso</div>
      <div className="chips chips--quebra">
        <Chip on={!admin} onClick={() => setAdmin(false)}>Atleta</Chip>
        <Chip on={admin} onClick={() => setAdmin(true)} roxo>👑 Organizadora</Chip>
      </div>

      <div style={{ marginTop: 22 }}>
        <Botao bloco tam="g" onClick={salvar} carregando={salvando}>Salvar</Botao>
      </div>

      {!a.eu && (
        <div style={{ marginTop: 12 }}>
          {confirmar ? (
            <>
              <p className="mini rosa centro" style={{ marginBottom: 8 }}>
                Isso apaga a conta, os jogos e as conversas dessa pessoa. Não dá pra desfazer.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <Botao bloco tipo="vidro" onClick={() => setConfirmar(false)}>Cancelar</Botao>
                <Botao bloco tipo="perigo" onClick={excluir}>Excluir mesmo</Botao>
              </div>
            </>
          ) : (
            <Botao bloco tipo="fantasma" tam="p" onClick={() => setConfirmar(true)}>Excluir atleta</Botao>
          )}
        </div>
      )}
    </Folha>
  )
}

/* ---------------- moderação ---------------- */
function Moderacao({ aoErro, aoOk, recarregar }: {
  aoErro: (m: string) => void; aoOk: (m: string) => void; recarregar: () => void
}) {
  const [lista, setLista] = useState<Denuncia[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const r = await rpcAuth<{ denuncias: Denuncia[] }>('tenis_admin_denuncias')
      setLista(r.denuncias || [])
    } catch (e) { aoErro((e as Error).message) } finally { setCarregando(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function resolver(id: string, acao: 'suspender' | 'arquivar') {
    try {
      await rpcAuth('tenis_admin_resolver_denuncia', { p_denuncia: id, p_acao: acao })
      aoOk(acao === 'suspender' ? 'Atleta suspenso.' : 'Denúncia arquivada.')
      carregar(); recarregar()
    } catch (e) { aoErro((e as Error).message) }
  }

  if (carregando) return <Girando />
  if (lista.length === 0) {
    return <Vazio emoji="🕊️" titulo="Nada pra moderar" texto="Nenhuma denúncia em aberto. Quando alguém denunciar, aparece aqui." />
  }

  return (
    <div className="pilha stagger">
      {lista.map(d => (
        <div key={d.id} className="cartao" style={{ borderColor: 'rgba(255,77,157,.36)' }}>
          <div className="entre" style={{ marginBottom: 10 }}>
            <span className="selo selo--rosa">Denúncia</span>
            <span className="mini">{quandoFoi(d.criado_em)}</span>
          </div>
          <div className="linha__nome">{d.alvo.nome}</div>
          <div className="linha__sub">
            {formatarTel(d.alvo.telefone)} · denunciado por {d.quem.nome}
            {!d.alvo.ativo && ' · já suspenso'}
          </div>
          {(d.motivo || d.descricao) && (
            <p style={{ margin: '11px 0 0', fontSize: 14.5, color: 'var(--txt-2)', fontStyle: 'italic' }}>
              “{[d.motivo, d.descricao].filter(Boolean).join(' — ')}”
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <Botao bloco tipo="perigo" tam="p" onClick={() => resolver(d.id, 'suspender')}>Suspender atleta</Botao>
            <Botao bloco tipo="vidro" tam="p" onClick={() => resolver(d.id, 'arquivar')}>Arquivar</Botao>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------------- jogos ---------------- */
function Jogos({ aoErro }: { aoErro: (m: string) => void }) {
  const [lista, setLista] = useState<JogoAdmin[]>([])
  const [carregando, setCarregando] = useState(true)
  useEffect(() => {
    rpcAuth<{ jogos: JogoAdmin[] }>('tenis_admin_jogos')
      .then(r => setLista(r.jogos || []))
      .catch(e => aoErro((e as Error).message))
      .finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (carregando) return <Girando />
  if (lista.length === 0) return <Vazio emoji="🎾" titulo="Nenhum jogo ainda" texto="Os jogos marcados pelos atletas aparecem aqui." />

  return (
    <div className="pilha stagger">
      {lista.map(j => (
        <div key={j.id} className="cartao cartao--apertado">
          <div className="entre">
            <span className="forte">{j.a} × {j.b}</span>
            <span className={`selo ${j.status === 'realizado' ? 'selo--lima' : j.status === 'confirmado' ? 'selo--ciano' : 'selo--rosa'}`}>
              {j.status === 'nao_ocorreu' ? 'não rolou' : j.status}
            </span>
          </div>
          <div className="linha__sub" style={{ marginTop: 4 }}>
            {dataAmigavel(j.data)} às {horaAmigavel(j.hora)}
            {j.local_texto && ` · ${j.local_texto}`}
            {j.placar && ` · ${j.placar}`}
            {j.vencedor && ` · venceu ${j.vencedor}`}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------------- quadras ---------------- */
const PISOS = ['', 'saibro', 'rapida', 'grama', 'sintetica']
const TIPOS = ['clube', 'publica', 'aluguel', 'condominio']

function Quadras({ aoErro, aoOk }: { aoErro: (m: string) => void; aoOk: (m: string) => void }) {
  const [lista, setLista] = useState<Local[]>([])
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState<Partial<Local> | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const r = await rpcAuth<{ locais: Local[] }>('tenis_admin_locais')
      setLista(r.locais || [])
    } catch (e) { aoErro((e as Error).message) } finally { setCarregando(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { carregar() }, [carregar])

  return (
    <div>
      <Botao bloco onClick={() => setEditando({})}>＋ Cadastrar quadra</Botao>

      {carregando ? <Girando /> : lista.length === 0 ? (
        <Vazio emoji="📍" titulo="Nenhuma quadra cadastrada"
               texto="Cadastre os clubes e quadras da cidade. Isso aparece pros atletas na hora de marcar o jogo." />
      ) : (
        <div className="pilha stagger" style={{ marginTop: 16 }}>
          {lista.map(l => (
            <button key={l.id} className="cartao cartao--apertado cartao--clicavel" onClick={() => setEditando(l)}>
              <div className="linha">
                <div style={{ fontSize: 22 }}>📍</div>
                <div className="cresce">
                  <div className="linha__nome">{l.nome}</div>
                  <div className="linha__sub">
                    {[l.bairro, l.cidade, l.uf].filter(Boolean).join(', ')}
                    {l.piso && ` · ${l.piso}`}
                    {l.valor_hora ? ` · R$ ${Number(l.valor_hora).toFixed(0)}/h` : ''}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {editando && (
        <FolhaQuadra l={editando} fechar={() => setEditando(null)}
          aoSalvar={m => { setEditando(null); aoOk(m); carregar() }} aoErro={aoErro} />
      )}
    </div>
  )
}

function FolhaQuadra({ l, fechar, aoSalvar, aoErro }: {
  l: Partial<Local>; fechar: () => void; aoSalvar: (m: string) => void; aoErro: (m: string) => void
}) {
  const [f, setF] = useState({
    nome: l.nome ?? '', tipo: l.tipo ?? 'clube', endereco: l.endereco ?? '',
    bairro: l.bairro ?? '', cidade: l.cidade ?? '', uf: l.uf || 'SP',
    piso: l.piso ?? '', valor_hora: l.valor_hora != null ? String(l.valor_hora) : '',
  })
  const [salvando, setSalvando] = useState(false)
  const muda = (k: keyof typeof f, v: string) => setF(x => ({ ...x, [k]: v }))

  async function salvar() {
    setSalvando(true)
    try {
      await rpcAuth('tenis_admin_salvar_local', { p: { id: l.id ?? '', ...f } })
      aoSalvar(l.id ? 'Quadra atualizada.' : 'Quadra cadastrada.')
    } catch (e) { aoErro((e as Error).message); setSalvando(false) }
  }

  async function excluir() {
    try { await rpcAuth('tenis_admin_excluir_local', { p_local: l.id }); aoSalvar('Quadra removida.') }
    catch (e) { aoErro((e as Error).message) }
  }

  return (
    <Folha aberta titulo={l.id ? 'Editar quadra' : 'Nova quadra'} fechar={fechar}>
      <Campo label="Nome"><input value={f.nome} onChange={e => muda('nome', e.target.value)}
                                 placeholder="Tênis Clube de Araçatuba" /></Campo>
      <div className="secao-tit">Tipo</div>
      <div className="chips chips--quebra">
        {TIPOS.map(t => <Chip key={t} on={f.tipo === t} onClick={() => muda('tipo', t)}>{t}</Chip>)}
      </div>
      <div className="secao-tit">Piso</div>
      <div className="chips chips--quebra">
        {PISOS.map(p => (
          <Chip key={p || 'nd'} on={f.piso === p} onClick={() => muda('piso', p)}>{p || 'não informado'}</Chip>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <Campo label="Endereço"><input value={f.endereco} onChange={e => muda('endereco', e.target.value)} /></Campo>
        <div className="dupla">
          <Campo label="Bairro"><input value={f.bairro} onChange={e => muda('bairro', e.target.value)} /></Campo>
          <Campo label="Cidade"><input value={f.cidade} onChange={e => muda('cidade', e.target.value)} /></Campo>
        </div>
        <div className="dupla">
          <Campo label="Estado">
            <select value={f.uf} onChange={e => muda('uf', e.target.value)}>
              {UFS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Campo>
          <Campo label="Valor por hora (R$)">
            <input value={f.valor_hora} onChange={e => muda('valor_hora', e.target.value)}
                   inputMode="decimal" placeholder="60" />
          </Campo>
        </div>
      </div>
      <Botao bloco tam="g" onClick={salvar} carregando={salvando}>Salvar</Botao>
      {l.id && (
        <div style={{ marginTop: 10 }}>
          <Botao bloco tipo="fantasma" tam="p" onClick={excluir}>Remover quadra</Botao>
        </div>
      )}
    </Folha>
  )
}

/* ---------------- mural ---------------- */
const TIPOS_AVISO: { t: Aviso['tipo']; nome: string; emoji: string }[] = [
  { t: 'info', nome: 'Recado', emoji: '💬' },
  { t: 'alerta', nome: 'Importante', emoji: '⚠️' },
  { t: 'festa', nome: 'Evento', emoji: '🎉' },
]

function Mural({ aoErro, aoOk, recarregar }: {
  aoErro: (m: string) => void; aoOk: (m: string) => void; recarregar: () => void
}) {
  const [lista, setLista] = useState<(Aviso & { publicado: boolean })[]>([])
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState<Partial<Aviso & { publicado: boolean }> | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const r = await rpcAuth<{ avisos: (Aviso & { publicado: boolean })[] }>('tenis_admin_avisos')
      setLista(r.avisos || [])
    } catch (e) { aoErro((e as Error).message) } finally { setCarregando(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { carregar() }, [carregar])

  return (
    <div>
      <Botao bloco onClick={() => setEditando({ tipo: 'info', publicado: true })}>＋ Escrever recado</Botao>
      <p className="mini centro" style={{ margin: '12px 4px 0' }}>
        O que você escrever aqui aparece na tela inicial de todos os atletas.
      </p>

      {carregando ? <Girando /> : lista.length === 0 ? (
        <Vazio emoji="📣" titulo="Mural vazio"
               texto="Use pra avisar de torneio, mudança de quadra, regra nova — o que a galera precisa saber." />
      ) : (
        <div className="pilha stagger" style={{ marginTop: 16 }}>
          {lista.map(a => (
            <button key={a.id} className="cartao cartao--apertado cartao--clicavel" onClick={() => setEditando(a)}
                    style={!a.publicado ? { opacity: .5 } : undefined}>
              <div className="entre">
                <span className="forte">
                  {TIPOS_AVISO.find(t => t.t === a.tipo)?.emoji} {a.titulo}
                </span>
                {!a.publicado && <span className="selo">rascunho</span>}
              </div>
              {a.texto && <div className="linha__sub" style={{ marginTop: 4 }}>{a.texto}</div>}
            </button>
          ))}
        </div>
      )}

      {editando && (
        <FolhaAviso a={editando} fechar={() => setEditando(null)}
          aoSalvar={m => { setEditando(null); aoOk(m); carregar(); recarregar() }} aoErro={aoErro} />
      )}
    </div>
  )
}

function FolhaAviso({ a, fechar, aoSalvar, aoErro }: {
  a: Partial<Aviso & { publicado: boolean }>
  fechar: () => void; aoSalvar: (m: string) => void; aoErro: (m: string) => void
}) {
  const [titulo, setTitulo] = useState(a.titulo ?? '')
  const [texto, setTexto] = useState(a.texto ?? '')
  const [tipo, setTipo] = useState<Aviso['tipo']>(a.tipo ?? 'info')
  const [publicado, setPublicado] = useState(a.publicado ?? true)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    try {
      await rpcAuth('tenis_admin_salvar_aviso', {
        p: { id: a.id ?? '', titulo: titulo.trim(), texto: texto.trim(), tipo, publicado },
      })
      aoSalvar(publicado ? 'Recado publicado.' : 'Rascunho salvo.')
    } catch (e) { aoErro((e as Error).message); setSalvando(false) }
  }

  async function excluir() {
    try { await rpcAuth('tenis_admin_excluir_aviso', { p_aviso: a.id }); aoSalvar('Recado apagado.') }
    catch (e) { aoErro((e as Error).message) }
  }

  return (
    <Folha aberta titulo={a.id ? 'Editar recado' : 'Novo recado'} fechar={fechar}
           sub="Aparece na tela inicial de todos os atletas.">
      <Campo label="Título"><input value={titulo} onChange={e => setTitulo(e.target.value)}
                                   placeholder="Torneio de setembro" maxLength={70} /></Campo>
      <Campo label="Mensagem">
        <textarea value={texto} onChange={e => setTexto(e.target.value)} maxLength={400}
                  placeholder="Inscrições abertas até dia 10. Fale comigo no chat." />
      </Campo>
      <div className="secao-tit">Tipo</div>
      <div className="chips chips--quebra">
        {TIPOS_AVISO.map(t => (
          <Chip key={t.t} on={tipo === t.t} onClick={() => setTipo(t.t)}>{t.emoji} {t.nome}</Chip>
        ))}
      </div>
      <div className="secao-tit">Situação</div>
      <div className="chips chips--quebra">
        <Chip on={publicado} onClick={() => setPublicado(true)}>Publicado</Chip>
        <Chip on={!publicado} onClick={() => setPublicado(false)}>Rascunho</Chip>
      </div>
      <div style={{ marginTop: 22 }}>
        <Botao bloco tam="g" onClick={salvar} carregando={salvando}>Salvar</Botao>
      </div>
      {a.id && (
        <div style={{ marginTop: 10 }}>
          <Botao bloco tipo="fantasma" tam="p" onClick={excluir}>Apagar recado</Botao>
        </div>
      )}
    </Folha>
  )
}
