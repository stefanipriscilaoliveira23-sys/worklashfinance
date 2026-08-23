import { useState } from 'react'
import { entrar, criarConta } from '../lib/api'
import { formatarTel } from '../lib/util'
import { Botao, Campo, Aviso, useRecado } from '../ui'

export default function Entrar({ pronto }: { pronto: () => void }) {
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar')
  const [nome, setNome] = useState('')
  const [tel, setTel] = useState('')
  const [senha, setSenha] = useState('')
  const [nasc, setNasc] = useState('')
  const [carregando, setCarregando] = useState(false)
  const { recado, erro } = useRecado()

  async function enviar() {
    setCarregando(true)
    try {
      if (modo === 'entrar') await entrar(tel, senha)
      else await criarConta(nome, tel, senha, nasc || null)
      pronto()
    } catch (e) {
      erro((e as Error).message)
    } finally {
      setCarregando(false)
    }
  }

  const podeEnviar = modo === 'entrar'
    ? tel.replace(/\D/g, '').length >= 10 && senha.length >= 4
    : nome.trim().length >= 2 && tel.replace(/\D/g, '').length >= 10 && senha.length >= 4

  return (
    <div className="tela tela--limpa" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100dvh' }}>
      <div className="centro" style={{ marginBottom: 34 }}>
        <div className="logo" style={{ fontSize: 46 }}>
          <span className="bola">🎾</span><b>Rally</b>
        </div>
        <p style={{ color: 'var(--txt-2)', fontSize: 16, marginTop: 10, fontWeight: 600 }}>
          Ache com quem jogar. Desafie. Joga hoje.
        </p>
      </div>

      <Aviso>{recado?.texto}</Aviso>

      <div className="cartao stagger">
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button className="chip" data-on={modo === 'entrar' ? '1' : '0'} onClick={() => setModo('entrar')}
                  style={{ flex: 1, padding: '12px' }}>
            Já tenho conta
          </button>
          <button className="chip" data-on={modo === 'criar' ? '1' : '0'} onClick={() => setModo('criar')}
                  style={{ flex: 1, padding: '12px' }}>
            Criar conta
          </button>
        </div>

        {modo === 'criar' && (
          <Campo label="Seu nome completo">
            <input value={nome} onChange={e => setNome(e.target.value)}
                   placeholder="Como te chamam na quadra" autoComplete="name" />
          </Campo>
        )}

        <Campo label="Celular com DDD">
          <input value={formatarTel(tel)} onChange={e => setTel(e.target.value)}
                 placeholder="(18) 99999-9999" inputMode="numeric" autoComplete="tel" />
        </Campo>

        <Campo label="Senha">
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
                 placeholder="Mínimo 4 caracteres"
                 autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} />
        </Campo>

        {modo === 'criar' && (
          <Campo label="Data de nascimento (opcional)">
            <input type="date" value={nasc} onChange={e => setNasc(e.target.value)} />
          </Campo>
        )}

        <div style={{ marginTop: 6 }}>
          <Botao bloco tam="g" onClick={enviar} desativado={!podeEnviar} carregando={carregando}>
            {modo === 'entrar' ? 'Entrar 🎾' : 'Bora começar 🎾'}
          </Botao>
        </div>
      </div>

      <p className="mini centro" style={{ marginTop: 20, lineHeight: 1.6 }}>
        Já joga o torneio Saque na Barragem?<br />
        <span className="lima forte">Entre com o mesmo celular e senha.</span>
      </p>
    </div>
  )
}
