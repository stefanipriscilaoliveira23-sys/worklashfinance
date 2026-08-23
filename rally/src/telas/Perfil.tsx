import { useRef, useState } from 'react'
import { rpcAuth, sair, subirFoto } from '../lib/api'
import { NIVEIS, nivelNome, DIAS, TURNOS, UFS, formatarTel } from '../lib/util'
import type { Eu } from '../lib/tipos'
import { Avatar, Botao, Campo, Chip, Folha, Aviso, useRecado } from '../ui'

export default function Perfil({ eu, atualizar, deslogar }: {
  eu: Eu; atualizar: (e: Eu) => void; deslogar: () => void
}) {
  const [editando, setEditando] = useState(false)
  const [horarios, setHorarios] = useState(false)
  const { recado, erro, ok } = useRecado()
  const arquivo = useRef<HTMLInputElement>(null)
  const p = eu.perfil

  async function trocarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 6_000_000) return erro('Foto muito grande. Use uma de até 6 MB.')
    try {
      const url = await subirFoto(f, eu.atleta.id)
      atualizar(await rpcAuth<Eu>('tenis_salvar_foto', { p_url: url }))
      ok('Foto atualizada!')
    } catch (err) { erro((err as Error).message) }
  }

  const aproveitamento = p.jogos > 0 ? Math.round((p.vitorias / p.jogos) * 100) : 0

  return (
    <div className="tela">
      <div className="topo">
        <div className="cresce"><h1>Meu perfil</h1><p>{eu.atleta.telefone && formatarTel(eu.atleta.telefone)}</p></div>
      </div>

      <Aviso ok={recado?.ok}>{recado?.texto}</Aviso>

      <div className="cartao centro stagger" style={{ marginBottom: 14 }}>
        <button onClick={() => arquivo.current?.click()}>
          <Avatar nome={eu.atleta.nome} url={eu.atleta.foto_url} tam={104} />
        </button>
        <input ref={arquivo} type="file" accept="image/*" hidden onChange={trocarFoto} />
        <h2 style={{ fontSize: 23, fontWeight: 900, margin: '13px 0 3px', letterSpacing: '-.5px' }}>
          {eu.atleta.nome}
        </h2>
        <p className="mini" style={{ margin: 0 }}>
          {[p.bairro, p.cidade, p.uf].filter(Boolean).join(', ') || 'Sem cidade definida'}
        </p>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginTop: 13 }}>
          <span className="selo selo--lima">{nivelNome(p.nivel)}</span>
          <span className="selo selo--ciano">{p.rating} pts</span>
          {p.avaliacoes > 0 && (
            <span className={`selo ${p.confiabilidade >= 80 ? 'selo--lima' : 'selo--rosa'}`}>
              {p.confiabilidade}% presença
            </span>
          )}
        </div>
        {p.bio && <p style={{ color: 'var(--txt-2)', fontSize: 14.5, marginTop: 14, marginBottom: 0 }}>{p.bio}</p>}
      </div>

      <div className="cartao grade-3" style={{ marginBottom: 14, padding: 4 }}>
        <div className="stat"><b>{p.jogos}</b><span>Jogos</span></div>
        <div className="stat"><b className="lima">{p.vitorias}</b><span>Vitórias</span></div>
        <div className="stat"><b>{aproveitamento}%</b><span>Aproveit.</span></div>
      </div>

      <button className="cartao cartao--clicavel" onClick={() => setHorarios(true)} style={{ marginBottom: 12 }}>
        <div className="linha">
          <div style={{ fontSize: 24 }}>🗓️</div>
          <div className="cresce">
            <div className="linha__nome">Meus horários</div>
            <div className="linha__sub">
              {eu.disponibilidade.length
                ? `${eu.disponibilidade.length} ${eu.disponibilidade.length === 1 ? 'horário' : 'horários'} na semana`
                : 'Nenhum horário marcado ainda'}
            </div>
          </div>
          <span style={{ color: 'var(--txt-3)', fontSize: 22 }}>›</span>
        </div>
      </button>

      <button className="cartao cartao--clicavel" onClick={() => setEditando(true)} style={{ marginBottom: 12 }}>
        <div className="linha">
          <div style={{ fontSize: 24 }}>⚙️</div>
          <div className="cresce">
            <div className="linha__nome">Editar perfil e preferências</div>
            <div className="linha__sub">
              Nível, cidade, distância ({p.raio_km} km) e quem pode te convidar
            </div>
          </div>
          <span style={{ color: 'var(--txt-3)', fontSize: 22 }}>›</span>
        </div>
      </button>

      <div style={{ marginTop: 26 }}>
        <Botao bloco tipo="perigo" onClick={async () => { await sair(); deslogar() }}>Sair da conta</Botao>
      </div>

      <p className="mini centro" style={{ marginTop: 26, lineHeight: 1.7 }}>
        🎾 Rally · encontro de tenistas<br />
        Combine sempre em quadra pública ou clube.<br />
        Denuncie qualquer comportamento estranho.
      </p>

      {editando && (
        <FolhaEditar eu={eu} fechar={() => setEditando(false)}
          aoSalvar={n => { atualizar(n); setEditando(false); ok('Perfil salvo!') }} aoErro={erro} />
      )}
      {horarios && (
        <FolhaHorarios eu={eu} fechar={() => setHorarios(false)}
          aoSalvar={n => { atualizar(n); setHorarios(false); ok('Horários salvos!') }} aoErro={erro} />
      )}
    </div>
  )
}

function FolhaEditar({ eu, fechar, aoSalvar, aoErro }: {
  eu: Eu; fechar: () => void; aoSalvar: (e: Eu) => void; aoErro: (m: string) => void
}) {
  const p = eu.perfil
  const [nome, setNome] = useState(eu.atleta.nome)
  const [cidade, setCidade] = useState(p.cidade)
  const [uf, setUf] = useState(p.uf || 'SP')
  const [bairro, setBairro] = useState(p.bairro)
  const [nivel, setNivel] = useState(p.nivel)
  const [bio, setBio] = useState(p.bio)
  const [mao, setMao] = useState(p.mao)
  const [simples, setSimples] = useState(p.joga_simples)
  const [duplas, setDuplas] = useState(p.joga_duplas)
  const [quadra, setQuadra] = useState(p.tem_quadra)
  const [clube, setClube] = useState(p.clube)
  const [raio, setRaio] = useState(p.raio_km)
  const [nMin, setNMin] = useState(p.nivel_min)
  const [nMax, setNMax] = useState(p.nivel_max)
  const [aceita, setAceita] = useState(p.aceita_genero)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!simples && !duplas) return aoErro('Escolha simples, duplas ou os dois.')
    setSalvando(true)
    try {
      aoSalvar(await rpcAuth<Eu>('tenis_salvar_perfil', {
        p: {
          nome: nome.trim(), cidade: cidade.trim(), uf, bairro: bairro.trim(),
          nivel, bio: bio.trim(), mao, joga_simples: simples, joga_duplas: duplas,
          tem_quadra: quadra, clube: clube.trim(), raio_km: raio,
          nivel_min: Math.min(nMin, nMax), nivel_max: Math.max(nMin, nMax), aceita_genero: aceita,
        },
      }))
    } catch (e) { aoErro((e as Error).message); setSalvando(false) }
  }

  return (
    <Folha aberta titulo="Editar perfil" fechar={fechar}>
      <Campo label="Nome"><input value={nome} onChange={e => setNome(e.target.value)} /></Campo>
      <div className="dupla">
        <Campo label="Cidade"><input value={cidade} onChange={e => setCidade(e.target.value)} /></Campo>
        <Campo label="Estado">
          <select value={uf} onChange={e => setUf(e.target.value)}>
            {UFS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </Campo>
      </div>
      <Campo label="Bairro"><input value={bairro} onChange={e => setBairro(e.target.value)} /></Campo>
      <Campo label="Sobre você">
        <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={240}
                  placeholder="Jogo de fundo de quadra, prefiro saibro, tô voltando depois de uma pausa..." />
      </Campo>

      <div className="secao-tit">Meu nível</div>
      <Campo>
        <select value={nivel} onChange={e => setNivel(Number(e.target.value))}>
          {NIVEIS.map(n => <option key={n.n} value={n.n}>{n.curto} — {n.desc}</option>)}
        </select>
      </Campo>

      <div className="secao-tit">Como eu jogo</div>
      <div className="chips chips--quebra">
        <Chip on={simples} onClick={() => setSimples(v => !v)}>Simples</Chip>
        <Chip on={duplas} onClick={() => setDuplas(v => !v)}>Duplas</Chip>
        <Chip on={mao === 'destro'} onClick={() => setMao('destro')}>Destro</Chip>
        <Chip on={mao === 'canhoto'} onClick={() => setMao('canhoto')}>Canhoto</Chip>
      </div>

      <div className="secao-tit">Quadra</div>
      <div className="chips chips--quebra">
        <Chip on={quadra === 'nao'} onClick={() => setQuadra('nao')}>Não tenho</Chip>
        <Chip on={quadra === 'clube'} onClick={() => setQuadra('clube')}>Sou sócio</Chip>
        <Chip on={quadra === 'alugo'} onClick={() => setQuadra('alugo')}>Alugo</Chip>
      </div>
      {quadra !== 'nao' && (
        <div style={{ marginTop: 13 }}>
          <Campo label="Clube ou quadra"><input value={clube} onChange={e => setClube(e.target.value)} /></Campo>
        </div>
      )}

      <div className="secao-tit">Distância máxima</div>
      <div className="chips">
        {[5, 10, 25, 50, 100, 500].map(r => (
          <Chip key={r} on={raio === r} onClick={() => setRaio(r)}>{r} km</Chip>
        ))}
      </div>

      <div className="secao-tit">Faixa de nível dos adversários</div>
      <div className="dupla">
        <Campo label="De">
          <select value={nMin} onChange={e => setNMin(Number(e.target.value))}>
            {NIVEIS.map(n => <option key={n.n} value={n.n}>{n.curto}</option>)}
          </select>
        </Campo>
        <Campo label="Até">
          <select value={nMax} onChange={e => setNMax(Number(e.target.value))}>
            {NIVEIS.map(n => <option key={n.n} value={n.n}>{n.curto}</option>)}
          </select>
        </Campo>
      </div>

      <div className="secao-tit">Quem pode me convidar</div>
      <div className="chips chips--quebra">
        <Chip on={aceita === 'todos'} onClick={() => setAceita('todos')}>Todo mundo</Chip>
        <Chip on={aceita === 'F'} onClick={() => setAceita('F')}>Só mulheres</Chip>
        <Chip on={aceita === 'M'} onClick={() => setAceita('M')}>Só homens</Chip>
      </div>

      <div style={{ marginTop: 22 }}>
        <Botao bloco tam="g" onClick={salvar} carregando={salvando}>Salvar</Botao>
      </div>
    </Folha>
  )
}

function FolhaHorarios({ eu, fechar, aoSalvar, aoErro }: {
  eu: Eu; fechar: () => void; aoSalvar: (e: Eu) => void; aoErro: (m: string) => void
}) {
  const [slots, setSlots] = useState(eu.disponibilidade)
  const [salvando, setSalvando] = useState(false)
  const tem = (d: number, t: string) => slots.some(s => s.dia === d && s.turno === t)
  const troca = (d: number, t: string) =>
    setSlots(s => tem(d, t) ? s.filter(x => !(x.dia === d && x.turno === t)) : [...s, { dia: d, turno: t }])

  async function salvar() {
    setSalvando(true)
    try { aoSalvar(await rpcAuth<Eu>('tenis_salvar_disponibilidade', { p_slots: slots })) }
    catch (e) { aoErro((e as Error).message); setSalvando(false) }
  }

  return (
    <Folha aberta titulo="Meus horários" fechar={fechar}
           sub="Quando você costuma jogar. Isso te faz aparecer nos filtros certos.">
      <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(3, 1fr)', gap: 7, alignItems: 'center' }}>
        <div />
        {TURNOS.map(t => <div key={t.t} className="mini centro forte" style={{ fontSize: 11.5 }}>{t.emoji} {t.nome}</div>)}
        {DIAS.map(d => (
          <div key={d.d} style={{ display: 'contents' }}>
            <div className="mini forte" style={{ paddingRight: 6 }}>{d.curto}</div>
            {TURNOS.map(t => (
              <button key={`${d.d}-${t.t}`} className="chip" data-on={tem(d.d, t.t) ? '1' : '0'}
                      onClick={() => troca(d.d, t.t)}
                      style={{ width: '100%', padding: '11px 0', justifyContent: 'center' }}>
                {tem(d.d, t.t) ? '✓' : '·'}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 22 }}>
        <Botao bloco tam="g" onClick={salvar} carregando={salvando}>Salvar horários</Botao>
      </div>
    </Folha>
  )
}
