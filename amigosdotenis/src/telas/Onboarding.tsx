import { useRef, useState } from 'react'
import { rpcAuth, subirFoto } from '../lib/api'
import { NIVEIS, nivelNome, DIAS, TURNOS, UFS } from '../lib/util'
import type { Eu } from '../lib/tipos'
import { Avatar, Botao, Campo, Chip, Aviso, useRecado } from '../ui'

const TOTAL = 6

export default function Onboarding({ eu, atualizar }: { eu: Eu; atualizar: (e: Eu) => void }) {
  const [passo, setPasso] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const { recado, erro } = useRecado()
  const arquivo = useRef<HTMLInputElement>(null)

  const [nome, setNome] = useState(eu.usuario.nome)
  const [foto, setFoto] = useState(eu.usuario.foto_url)
  const [cidade, setCidade] = useState(eu.perfil.cidade)
  const [uf, setUf] = useState(eu.perfil.uf || 'SP')
  const [bairro, setBairro] = useState(eu.perfil.bairro)
  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(
    eu.perfil.lat ? { lat: eu.perfil.lat, lng: eu.perfil.lng! } : null)
  const [nivel, setNivel] = useState(eu.perfil.nivel)
  const [mao, setMao] = useState(eu.perfil.mao)
  const [simples, setSimples] = useState(eu.perfil.joga_simples)
  const [duplas, setDuplas] = useState(eu.perfil.joga_duplas)
  const [genero, setGenero] = useState(eu.perfil.genero)
  const [quadra, setQuadra] = useState(eu.perfil.tem_quadra)
  const [clube, setClube] = useState(eu.perfil.clube)
  const [slots, setSlots] = useState<{ dia: number; turno: string }[]>(eu.disponibilidade)
  const [raio, setRaio] = useState(eu.perfil.raio_km)
  const [nMin, setNMin] = useState(Math.max(1, eu.perfil.nivel - 1))
  const [nMax, setNMax] = useState(Math.min(7, eu.perfil.nivel + 1))
  const [aceita, setAceita] = useState(eu.perfil.aceita_genero)

  const temSlot = (d: number, t: string) => slots.some(s => s.dia === d && s.turno === t)
  const trocaSlot = (d: number, t: string) =>
    setSlots(s => temSlot(d, t) ? s.filter(x => !(x.dia === d && x.turno === t)) : [...s, { dia: d, turno: t }])

  async function escolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 6_000_000) return erro('Foto muito grande. Use uma de até 6 MB.')
    try {
      const url = await subirFoto(f, eu.usuario.id)
      setFoto(url)
      await rpcAuth('tenis_salvar_foto', { p_url: url })
    } catch (err) { erro((err as Error).message) }
  }

  function localizar() {
    if (!navigator.geolocation) return erro('Seu aparelho não permite localização.')
    navigator.geolocation.getCurrentPosition(
      p => setCoord({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => erro('Não consegui pegar sua localização. Pode preencher a cidade na mão.'),
      { timeout: 8000 },
    )
  }

  async function finalizar() {
    setSalvando(true)
    try {
      await rpcAuth('tenis_salvar_perfil', {
        p: {
          nome: nome.trim(), cidade: cidade.trim(), uf, bairro: bairro.trim(),
          lat: coord?.lat ?? null, lng: coord?.lng ?? null,
          nivel, mao, joga_simples: simples, joga_duplas: duplas, genero,
          tem_quadra: quadra, clube: clube.trim(),
          raio_km: raio, nivel_min: Math.min(nMin, nMax), nivel_max: Math.max(nMin, nMax),
          aceita_genero: aceita,
        },
      })
      const novo = await rpcAuth<Eu>('tenis_salvar_disponibilidade', { p_slots: slots })
      atualizar(novo)
    } catch (e) {
      erro((e as Error).message)
      setSalvando(false)
    }
  }

  const podeAvancar = [
    nome.trim().length >= 2,
    cidade.trim().length >= 2 && !!uf,
    true,
    simples || duplas,
    true,
    true,
  ][passo]

  return (
    <div className="tela tela--limpa">
      <div className="passos">
        {Array.from({ length: TOTAL }, (_, i) => <div key={i} className="passo" data-on={i <= passo ? '1' : '0'} />)}
      </div>

      <Aviso>{recado?.texto}</Aviso>

      {passo === 0 && (
        <div className="stagger">
          <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.9px', margin: '0 0 6px' }}>
            Vamos montar seu perfil 🎾
          </h1>
          <p style={{ color: 'var(--txt-2)', margin: '0 0 26px', fontWeight: 500 }}>
            Leva 2 minutos. Quanto melhor o perfil, melhores os jogos.
          </p>
          <div className="centro" style={{ marginBottom: 22 }}>
            <button onClick={() => arquivo.current?.click()} style={{ display: 'inline-block' }}>
              <Avatar nome={nome} url={foto} tam={128} />
              <div className="selo selo--lima" style={{ marginTop: 12 }}>
                {foto ? '📷 Trocar foto' : '📷 Colocar foto'}
              </div>
            </button>
            <input ref={arquivo} type="file" accept="image/*" hidden onChange={escolherFoto} />
          </div>
          <Campo label="Seu nome">
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome e sobrenome" />
          </Campo>
          <p className="mini" style={{ margin: '0 4px' }}>
            Perfil com foto recebe muito mais convite. Mas dá pra colocar depois.
          </p>
        </div>
      )}

      {passo === 1 && (
        <div className="stagger">
          <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.9px', margin: '0 0 6px' }}>
            Onde você joga? 📍
          </h1>
          <p style={{ color: 'var(--txt-2)', margin: '0 0 26px', fontWeight: 500 }}>
            É como a gente acha gente perto de você.
          </p>
          <div style={{ marginBottom: 16 }}>
            <Botao bloco tipo={coord ? 'vidro' : 'roxo'} onClick={localizar}>
              {coord ? '✅ Localização ativada' : '📍 Usar minha localização'}
            </Botao>
          </div>
          <div className="dupla">
            <Campo label="Cidade">
              <input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Araçatuba" />
            </Campo>
            <Campo label="Estado">
              <select value={uf} onChange={e => setUf(e.target.value)}>
                {UFS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </Campo>
          </div>
          <Campo label="Bairro ou região (opcional)">
            <input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Centro" />
          </Campo>
          <p className="mini" style={{ margin: '0 4px' }}>
            Ninguém vê seu endereço — só a cidade, o bairro e a distância aproximada.
          </p>
        </div>
      )}

      {passo === 2 && (
        <div className="stagger">
          <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.9px', margin: '0 0 6px' }}>
            Qual seu nível? 🏆
          </h1>
          <p style={{ color: 'var(--txt-2)', margin: '0 0 22px', fontWeight: 500 }}>
            Seja sincero. Jogo desequilibrado é chato pros dois.
          </p>
          <div className="pilha">
            {NIVEIS.map(n => (
              <button key={n.n} className="cartao cartao--apertado cartao--clicavel"
                      onClick={() => setNivel(n.n)}
                      style={nivel === n.n ? { borderColor: 'var(--lima)', background: 'rgba(217,255,61,.09)' } : undefined}>
                <div className="entre">
                  <span className="forte" style={{ fontSize: 16 }}>{n.curto}</span>
                  {nivel === n.n && <span className="lima forte">✓</span>}
                </div>
                <div className="mini" style={{ marginTop: 3, lineHeight: 1.45 }}>{n.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {passo === 3 && (
        <div className="stagger">
          <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.9px', margin: '0 0 6px' }}>
            Como você joga? 🎯
          </h1>
          <p style={{ color: 'var(--txt-2)', margin: '0 0 24px', fontWeight: 500 }}>
            Isso ajuda a achar o jogo certo pra você.
          </p>

          <div className="secao-tit">Modalidade</div>
          <div className="chips chips--quebra">
            <Chip on={simples} onClick={() => setSimples(v => !v)}>Simples</Chip>
            <Chip on={duplas} onClick={() => setDuplas(v => !v)}>Duplas</Chip>
          </div>
          {!simples && !duplas && <p className="mini rosa" style={{ margin: '8px 4px 0' }}>Escolha pelo menos uma.</p>}

          <div className="secao-tit">Mão</div>
          <div className="chips">
            <Chip on={mao === 'destro'} onClick={() => setMao('destro')}>Destro</Chip>
            <Chip on={mao === 'canhoto'} onClick={() => setMao('canhoto')}>Canhoto</Chip>
          </div>

          <div className="secao-tit">Gênero</div>
          <div className="chips">
            <Chip on={genero === 'F'} onClick={() => setGenero('F')}>Feminino</Chip>
            <Chip on={genero === 'M'} onClick={() => setGenero('M')}>Masculino</Chip>
            <Chip on={genero === 'O'} onClick={() => setGenero('O')}>Outro</Chip>
          </div>

          <div className="secao-tit">Você tem quadra?</div>
          <div className="chips chips--quebra">
            <Chip on={quadra === 'nao'} onClick={() => setQuadra('nao')}>Não tenho</Chip>
            <Chip on={quadra === 'clube'} onClick={() => setQuadra('clube')}>Sou sócio de clube</Chip>
            <Chip on={quadra === 'alugo'} onClick={() => setQuadra('alugo')}>Costumo alugar</Chip>
          </div>
          {quadra !== 'nao' && (
            <div style={{ marginTop: 14 }}>
              <Campo label="Qual clube ou quadra?">
                <input value={clube} onChange={e => setClube(e.target.value)} placeholder="Tênis Clube de Araçatuba" />
              </Campo>
            </div>
          )}
        </div>
      )}

      {passo === 4 && (
        <div className="stagger">
          <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.9px', margin: '0 0 6px' }}>
            Quando você joga? 🗓️
          </h1>
          <p style={{ color: 'var(--txt-2)', margin: '0 0 24px', fontWeight: 500 }}>
            Toque nos horários da sua rotina. Dá pra mudar quando quiser.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(3, 1fr)', gap: 7, alignItems: 'center' }}>
            <div />
            {TURNOS.map(t => (
              <div key={t.t} className="mini centro forte" style={{ fontSize: 11.5 }}>{t.emoji} {t.nome}</div>
            ))}
            {DIAS.map(d => (
              <>
                <div key={`l-${d.d}`} className="mini forte" style={{ paddingRight: 6 }}>{d.curto}</div>
                {TURNOS.map(t => (
                  <button key={`${d.d}-${t.t}`} className="chip" data-on={temSlot(d.d, t.t) ? '1' : '0'}
                          onClick={() => trocaSlot(d.d, t.t)}
                          style={{ width: '100%', padding: '11px 0', justifyContent: 'center' }}>
                    {temSlot(d.d, t.t) ? '✓' : '·'}
                  </button>
                ))}
              </>
            ))}
          </div>
          <p className="mini" style={{ margin: '16px 4px 0' }}>
            {slots.length === 0 ? 'Nada marcado ainda — pode pular e definir depois.'
              : `${slots.length} ${slots.length === 1 ? 'horário marcado' : 'horários marcados'}.`}
          </p>
        </div>
      )}

      {passo === 5 && (
        <div className="stagger">
          <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.9px', margin: '0 0 6px' }}>
            Com quem você quer jogar? ⚙️
          </h1>
          <p style={{ color: 'var(--txt-2)', margin: '0 0 24px', fontWeight: 500 }}>
            Último passo. Isso filtra quem aparece pra você.
          </p>

          <div className="secao-tit">Distância máxima</div>
          <div className="chips">
            {[5, 10, 25, 50, 100].map(r => (
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
          <p className="mini" style={{ margin: '-6px 4px 0' }}>
            Seu nível é <span className="lima forte">{nivelNome(nivel)}</span>. Jogo equilibrado costuma ser
            no seu nível ou um acima/abaixo.
          </p>

          <div className="secao-tit">Quem pode te convidar</div>
          <div className="chips chips--quebra">
            <Chip on={aceita === 'todos'} onClick={() => setAceita('todos')}>Todo mundo</Chip>
            <Chip on={aceita === 'F'} onClick={() => setAceita('F')}>Só mulheres</Chip>
            <Chip on={aceita === 'M'} onClick={() => setAceita('M')}>Só homens</Chip>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 30 }}>
        {passo > 0 && (
          <Botao tipo="vidro" onClick={() => setPasso(p => p - 1)}>Voltar</Botao>
        )}
        {passo < TOTAL - 1 ? (
          <Botao bloco tam="g" onClick={() => setPasso(p => p + 1)} desativado={!podeAvancar}>
            Continuar
          </Botao>
        ) : (
          <Botao bloco tam="g" onClick={finalizar} carregando={salvando}>
            Tô pronto, bora jogar 🎾
          </Botao>
        )}
      </div>
    </div>
  )
}
