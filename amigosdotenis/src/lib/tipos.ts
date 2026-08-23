export type Jogador = {
  id: string
  nome: string
  foto_url: string | null
  nivel: number
  rating: number
  cidade: string
  uf: string
  bairro: string
  mao: 'destro' | 'canhoto'
  estilo: string
  bio: string
  joga_simples: boolean
  joga_duplas: boolean
  tem_quadra: 'nao' | 'clube' | 'alugo'
  clube: string
  jogos: number
  vitorias: number
  derrotas: number
  confiabilidade: number
  avaliacoes: number
  visto_em: string
  distancia: number | null
  livre_hoje: { hora_ini: string; hora_fim: string; obs: string } | null
  disponibilidade: { dia: number; turno: string }[]
  convite_pendente?: boolean
  conversa_id?: string | null
}

export type Perfil = {
  cidade: string; uf: string; bairro: string
  lat: number | null; lng: number | null
  nivel: number; rating: number
  mao: 'destro' | 'canhoto'
  joga_simples: boolean; joga_duplas: boolean
  genero: '' | 'F' | 'M' | 'O'
  estilo: string; bio: string
  tem_quadra: 'nao' | 'clube' | 'alugo'; clube: string
  raio_km: number; nivel_min: number; nivel_max: number
  aceita_genero: 'todos' | 'F' | 'M'
  jogos: number; vitorias: number; derrotas: number
  faltas: number; avaliacoes: number; confiabilidade: number
  onboarding_ok: boolean; ativo: boolean
}

export type Eu = {
  usuario: { id: string; nome: string; telefone: string; foto_url: string | null; nascimento: string | null }
  perfil: Perfil
  disponibilidade: { dia: number; turno: string }[]
  livre_hoje: { data: string; hora_ini: string; hora_fim: string; obs: string } | null
  convites_novos: number
  msgs_novas: number
  jogos_pendentes: number
}

export type Convite = {
  id: string
  tipo: 'amistoso' | 'desafio'
  modalidade: 'simples' | 'duplas'
  data: string; hora: string
  local_texto: string; mensagem: string
  status: string; criado_em: string
  de?: Jogador; para?: Jogador
}

export type Jogo = {
  id: string
  data: string; hora: string; local_texto: string
  modalidade: string; tipo: string; status: string
  placar: string; vencedor_id: string | null
  passou: boolean; avaliei: boolean
  adversario: Jogador
  conversa_id: string | null
}

export type ItemConversa = {
  id: string
  ultima_em: string
  com: Jogador
  ultima_msg: string | null
  nao_lidas: number
}

export type Mensagem = { id: string; texto: string; meu: boolean; criado_em: string }

export type LinhaRanking = {
  pos: number; id: string; nome: string; foto_url: string | null
  nivel: number; rating: number; jogos: number
  vitorias: number; derrotas: number; cidade: string; uf: string; eu: boolean
}
