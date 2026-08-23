import { useEffect, useState } from 'react'
import { rpcAuth } from '../lib/api'
import { nivelNome } from '../lib/util'
import type { LinhaRanking } from '../lib/tipos'
import { Avatar, Chip, Girando, Vazio, Aviso, useRecado } from '../ui'

export default function Ranking({ cidade }: { cidade: string }) {
  const [escopo, setEscopo] = useState<'cidade' | 'uf' | 'brasil'>('cidade')
  const [lista, setLista] = useState<LinhaRanking[]>([])
  const [carregando, setCarregando] = useState(true)
  const { recado, erro } = useRecado()

  useEffect(() => {
    setCarregando(true)
    rpcAuth<{ lista: LinhaRanking[] }>('tenis_ranking', { p_escopo: escopo })
      .then(r => setLista(r.lista || []))
      .catch(e => erro((e as Error).message))
      .finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escopo])

  return (
    <div className="tela">
      <div className="topo">
        <div className="cresce">
          <h1>Ranking</h1>
          <p>Sobe quem joga e vence desafios</p>
        </div>
      </div>

      <Aviso>{recado?.texto}</Aviso>

      <div className="chips" style={{ marginBottom: 16 }}>
        <Chip on={escopo === 'cidade'} onClick={() => setEscopo('cidade')}>{cidade || 'Minha cidade'}</Chip>
        <Chip on={escopo === 'uf'} onClick={() => setEscopo('uf')}>Meu estado</Chip>
        <Chip on={escopo === 'brasil'} onClick={() => setEscopo('brasil')} roxo>🇧🇷 Brasil</Chip>
      </div>

      {carregando ? <Girando /> : lista.length === 0 ? (
        <Vazio emoji="🏆" titulo="Ranking ainda vazio"
               texto="O ranking começa quando os jogos têm resultado lançado. Jogue e registre o placar pra aparecer aqui." />
      ) : (
        <div className="pilha stagger">
          {lista.map(l => (
            <div key={l.id} className={`cartao cartao--apertado${l.eu ? ' linha--eu' : ''}`}>
              <div className="linha">
                <div className={`pos${l.pos <= 3 ? ` pos--${l.pos}` : ''}`}>{l.pos}</div>
                <Avatar nome={l.nome} url={l.foto_url} tam={44} />
                <div className="cresce">
                  <div className="linha__nome">{l.nome}{l.eu && <span className="lima"> · você</span>}</div>
                  <div className="linha__sub">
                    {nivelNome(l.nivel)} · {l.vitorias}V {l.derrotas}D
                    {escopo !== 'cidade' && ` · ${l.cidade}`}
                  </div>
                </div>
                <div className="centro">
                  <div className="forte lima" style={{ fontSize: 17 }}>{l.rating}</div>
                  <div className="mini" style={{ fontSize: 10 }}>pontos</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mini centro" style={{ marginTop: 22, lineHeight: 1.6 }}>
        Você começa com 1000 pontos. Ganhar de quem tem rating maior<br />vale mais. Só jogos com placar lançado contam.
      </p>
    </div>
  )
}
