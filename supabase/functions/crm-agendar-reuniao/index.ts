// Ponte CRM -> Escritório, lado da AGENDA.
//
// O CRM (e a IA, que trabalha por dentro dele) marca reunião na agenda do
// Escritório sem ter a chave-mestra do Supabase: esta função só sabe ler os
// tipos de call e gravar agendamento. Se o servidor do CRM cair em mãos
// erradas, o invasor não lê o financeiro nem toca nos outros apps do projeto.
// Mesma decisão e mesmo segredo de `crm-registrar-venda`.
//
// Quatro ações, todas por POST:
//   opcoes  -> tipos de call (com o roteiro de perguntas), anfitriões e a
//              base dos links públicos. É o que monta a janela do CRM.
//   listar  -> as reuniões dessa pessoa, achadas pelo telefone.
//   agendar -> grava a reunião com tudo preenchido.
//   link    -> devolve o link público pra pessoa escolher o horário sozinha,
//              já assinado com quem mandou.
//
// A regra que atravessa tudo: SEMPRE fica registrado QUEM marcou. Reunião
// marcada pela IA nasce com origem 'IA'; link mandado pela IA volta como
// 'Auto-agendamento' com o nome de quem mandou. Sem isso, na hora da call
// ninguém sabe de onde aquela pessoa apareceu.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-crm-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BASE_PUBLICA = 'https://escritorio-worklash.vercel.app';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

async function sha256(texto: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Só os dígitos, e sem o 55 do país, pra achar a mesma pessoa nos dois lados. */
function fone(bruto: unknown) {
  const d = String(bruto ?? '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) return d.slice(2);
  return d;
}

const hhmm = (t: unknown) => String(t ?? '').slice(0, 5);

function somarMinutos(hora: string, minutos: number) {
  const [h, m] = hhmm(hora).split(':').map(Number);
  const total = h * 60 + m + minutos;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'use POST' }, 405);

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const enviado = req.headers.get('x-crm-secret') ?? '';
  const { data: cfg } = await db
    .from('crm_ponte_config')
    .select('segredo_sha')
    .eq('id', 'unico')
    .maybeSingle();

  if (!cfg?.segredo_sha || (await sha256(enviado)) !== cfg.segredo_sha) {
    return json({ erro: 'não autorizado' }, 401);
  }

  let v: Record<string, any>;
  try {
    v = await req.json();
  } catch {
    return json({ erro: 'corpo inválido' }, 400);
  }

  const acao = String(v.acao ?? 'agendar');

  // ── opcoes ───────────────────────────────────────────────────────
  // O CRM não guarda cópia nenhuma disso. Ele pergunta toda vez que abre a
  // janela, então tipo de call novo (ou pergunta nova no roteiro) aparece lá
  // sozinho, sem precisar mexer no CRM.
  if (acao === 'opcoes') {
    const { data: tipos } = await db
      .from('agenda_tipos')
      .select('id, nome, slug, duracao_minutos, roteiro, sobre, ativo')
      .eq('ativo', true)
      .order('nome');
    const { data: anfitrioes } = await db
      .from('anfitrioes')
      .select('id, nome, ativo')
      .eq('ativo', true)
      .order('nome');
    return json({
      ok: true,
      tipos: tipos ?? [],
      anfitrioes: anfitrioes ?? [],
      basePublica: BASE_PUBLICA,
    });
  }

  // ── listar ───────────────────────────────────────────────────────
  if (acao === 'listar') {
    const digitos = fone(v.whatsapp);
    if (digitos.length < 8) return json({ ok: true, reunioes: [] });

    // Sem índice por telefone normalizado aqui: a agenda é pequena (dezenas
    // por mês), então filtrar pelo fim do número no próprio banco resolve.
    const { data } = await db
      .from('agendamentos')
      .select('id, nome, whatsapp, data, hora_inicio, hora_fim, status, origem, agendado_por_nome, link_reuniao, observacoes, respostas, tipo_id, anfitriao_id')
      .ilike('whatsapp', `%${digitos.slice(-8)}%`)
      .order('data', { ascending: false })
      .limit(20);

    const { data: tipos } = await db.from('agenda_tipos').select('id, nome, slug');
    const { data: anfitrioes } = await db.from('anfitrioes').select('id, nome');

    const reunioes = (data ?? []).map((r) => ({
      ...r,
      hora_inicio: hhmm(r.hora_inicio),
      hora_fim: hhmm(r.hora_fim),
      tipoNome: (tipos ?? []).find((t) => t.id === r.tipo_id)?.nome ?? null,
      anfitriaoNome: (anfitrioes ?? []).find((a) => a.id === r.anfitriao_id)?.nome ?? null,
    }));
    return json({ ok: true, reunioes });
  }

  // ── link ─────────────────────────────────────────────────────────
  if (acao === 'link') {
    const { data: tipo } = await db
      .from('agenda_tipos')
      .select('slug, nome, duracao_minutos')
      .eq(v.tipoId ? 'id' : 'slug', v.tipoId ?? v.tipoSlug)
      .maybeSingle();
    if (!tipo?.slug) return json({ erro: 'tipo de call não encontrado' }, 400);

    const por = String(v.agendadoPorNome ?? '').trim();
    const url = `${BASE_PUBLICA}/agendar/${tipo.slug}${por ? `?por=${encodeURIComponent(por)}` : ''}`;
    return json({ ok: true, url, tipoNome: tipo.nome, duracao: tipo.duracao_minutos });
  }

  // ── agendar ──────────────────────────────────────────────────────
  if (acao !== 'agendar') return json({ erro: `ação desconhecida: ${acao}` }, 400);

  if (!String(v.nome ?? '').trim()) return json({ erro: 'informe o nome de quem vem na reunião' }, 400);
  if (!v.data) return json({ erro: 'informe a data' }, 400);
  if (!v.horaInicio) return json({ erro: 'informe o horário' }, 400);

  const { data: tipo } = v.tipoId || v.tipoSlug
    ? await db
        .from('agenda_tipos')
        .select('id, nome, slug, duracao_minutos')
        .eq(v.tipoId ? 'id' : 'slug', v.tipoId ?? v.tipoSlug)
        .maybeSingle()
    : { data: null };

  let anfitriaoId: string | null = v.anfitriaoId ?? null;
  if (!anfitriaoId && v.anfitriaoNome) {
    const { data: a } = await db
      .from('anfitrioes')
      .select('id')
      .ilike('nome', String(v.anfitriaoNome).trim())
      .maybeSingle();
    anfitriaoId = a?.id ?? null;
  }
  if (!anfitriaoId) return json({ erro: 'escolha quem vai conduzir a reunião' }, 400);

  const horaInicio = hhmm(v.horaInicio);
  const horaFim = v.horaFim
    ? hhmm(v.horaFim)
    : somarMinutos(horaInicio, Number(tipo?.duracao_minutos) || 60);

  if (horaFim <= horaInicio) return json({ erro: 'o fim precisa ser depois do início' }, 400);

  // Choque de horário NÃO bloqueia: quem está marcando sabe se as duas calls
  // são com pessoas diferentes. Mas volta na resposta pra tela avisar, senão
  // a agenda dobra sem ninguém perceber (foi o que quase aconteceu no
  // primeiro agendamento feito por aqui).
  const { data: mesmoDia } = await db
    .from('agendamentos')
    .select('id, nome, hora_inicio, hora_fim, anfitriao_id, status')
    .eq('data', v.data)
    .neq('status', 'Cancelado');

  const conflitos = (mesmoDia ?? [])
    .filter((a) => hhmm(a.hora_inicio) < horaFim && hhmm(a.hora_fim) > horaInicio)
    .map((a) => ({
      nome: a.nome,
      hora: `${hhmm(a.hora_inicio)} às ${hhmm(a.hora_fim)}`,
      mesmoAnfitriao: a.anfitriao_id === anfitriaoId,
    }));

  const quem = String(v.agendadoPorNome ?? '').trim() || null;
  const origem = String(v.origem ?? 'CRM').trim() || 'CRM';

  const { data: criado, error } = await db
    .from('agendamentos')
    .insert({
      nome: String(v.nome).trim(),
      whatsapp: v.whatsapp ? String(v.whatsapp) : null,
      instagram: v.instagram ? String(v.instagram).replace(/^@/, '') : null,
      tipo_id: tipo?.id ?? null,
      anfitriao_id: anfitriaoId,
      data: v.data,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      link_reuniao: v.linkReuniao || null,
      observacoes: String(v.observacoes ?? '').trim() || null,
      respostas: v.respostas && typeof v.respostas === 'object' ? v.respostas : {},
      status: v.status ?? 'Confirmado',
      origem,
      agendado_por_nome: quem,
    })
    .select('id')
    .single();

  if (error) return json({ erro: error.message }, 500);

  // As mesmas duas tarefas que a janela do Escritório cria. Sem responsável:
  // quem marcou pelo CRM não tem login aqui, e tarefa com dono errado é pior
  // que tarefa sem dono — ela aparece na lista da pessoa errada.
  await db.from('agendamento_tarefas').insert([
    { agendamento_id: criado.id, titulo: 'Enviar lembrete ao anfitrião' },
    { agendamento_id: criado.id, titulo: 'Enviar confirmação ao convidado' },
  ]);

  // Aviso pra quem é admin. Vira sininho e push pelo gatilho da tabela.
  try {
    const { data: admins } = await db
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');
    const quando = `${String(v.data).split('-').reverse().join('/')} às ${horaInicio}`;
    for (const a of admins ?? []) {
      await db.from('notificacoes').insert({
        destinatario_id: a.user_id,
        titulo: `Reunião marcada${quem ? ` por ${quem}` : ''}: ${String(v.nome).trim()} em ${quando}`,
        tipo: 'agenda',
        link_interno: '/agenda',
        chave: `reuniao-crm:${criado.id}`,
      });
    }
  } catch {
    // Aviso é bônus. Reunião marcada e ninguém avisado é bem melhor que
    // reunião não marcada porque o aviso falhou.
  }

  return json({
    ok: true,
    agendamentoId: criado.id,
    horaFim,
    tipoNome: tipo?.nome ?? null,
    conflitos,
  });
});
