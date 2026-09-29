// Lembretes de call, no WhatsApp.
//
// Roda de 5 em 5 minutos (pg_cron) e olha a agenda das proximas horas. Tres
// avisos, cada um com um trabalho diferente:
//
//   ficha    -> assim que a reuniao e marcada, vai pra quem VAI CONDUZIR ela
//               (Stefani ou Felipe, conforme o anfitriao) com tudo que se
//               sabe do lead. E o aviso mais importante: e o que evita
//               entrar na call no escuro.
//   lead_1h  -> 1 hora antes, pro lead, com o link. Confirma presenca.
//   host_1h  -> 1 hora antes, pra quem conduz. Sai junto com o do lead, de
//               proposito: assim os dois se preparam na mesma hora, e se a
//               lead responder a confirmacao quem conduz ja esta olhando.
//               (era 30 min ate 20/09/2026; ela pediu 1h)
//
// A trava contra aviso repetido e a chave unica (agendamento_id, tipo) em
// `agenda_lembretes`: a linha e gravada ANTES do envio. Se o envio falhar, a
// linha fica com ok=false e o erro, e nao se tenta de novo sozinho. Repetir
// sozinho e pior que nao mandar.
//
// A credencial da uazapi vem da tabela `agenda_lembretes_config`, nao de
// secret de funcao: os secrets so entram pela CLI, que exige login, e o
// projeto ja guarda segredo de ponte em tabela fechada (crm_ponte_config).
//
// Fuso: o banco guarda data+hora sem fuso, e a agenda e sempre em horario de
// Brasilia. Entao a conta e feita em UTC-3 explicitamente, e nao com o fuso
// do servidor (que e UTC e jogaria todo lembrete 3 horas fora).
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

/** Agora em horario de Brasilia, como Date em UTC deslocado. */
function agoraBR(): Date {
  return new Date(Date.now() - 3 * 60 * 60 * 1000);
}

/** Junta data (yyyy-mm-dd) e hora (hh:mm:ss) num Date comparavel com agoraBR. */
function quando(data: string, hora: string): Date {
  return new Date(`${data}T${(hora ?? "00:00:00").slice(0, 8)}Z`);
}

/**
 * Normaliza para o formato que a uazapi espera (55 + DDD + numero).
 * Devolve null quando o que veio nao e telefone (o campo aceita @ do
 * Instagram em alguns agendamentos vindos do CRM).
 */
function numeroWhats(bruto: string | null): string | null {
  let n = String(bruto ?? "").replace(/\D/g, "");
  if (!n) return null;
  if (n.length <= 11) n = "55" + n;
  if (n.length < 12 || n.length > 13) return null;
  return n;
}

const hhmm = (h: string) => String(h ?? "").slice(0, 5);
const dataBonita = (iso: string) => String(iso).slice(0, 10).split("-").reverse().join("/");

async function enviar(
  url: string,
  token: string,
  numero: string,
  texto: string,
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const r = await fetch(`${url}/send/text`, {
      method: "POST",
      headers: { "content-type": "application/json", token },
      body: JSON.stringify({ number: numero, text: texto }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return { ok: false, erro: `uazapi ${r.status}: ${(await r.text()).slice(0, 200)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: String((e as Error)?.message ?? e).slice(0, 200) };
  }
}

/** Grava a marca ANTES de enviar, para nao repetir se o envio demorar. */
async function marcar(agendamentoId: string, tipo: string, destino: string, numero: string | null) {
  const { error } = await db
    .from("agenda_lembretes")
    .insert({ agendamento_id: agendamentoId, tipo, destino, numero });
  return !error; // erro aqui = ja existe a linha = ja foi avisado
}

async function registrarFalha(agendamentoId: string, tipo: string, erro: string) {
  await db.from("agenda_lembretes").update({ ok: false, erro })
    .eq("agendamento_id", agendamentoId).eq("tipo", tipo);
}

/** A ficha do lead que vai junto do aviso de quem conduz a call. */
function fichaDoLead(a: Record<string, any>, tipoNome: string): string {
  const L: string[] = [];
  L.push("*NOVA CALL MARCADA*");
  L.push("");
  L.push(`*${a.nome ?? "Sem nome"}*`);
  L.push(`${tipoNome} - ${dataBonita(a.data)} as ${hhmm(a.hora_inicio)}`);
  L.push("");
  if (a.whatsapp) L.push(`WhatsApp: ${a.whatsapp}`);
  if (a.instagram) L.push(`Instagram: ${a.instagram}`);
  if (a.link_reuniao) L.push(`Link: ${a.link_reuniao}`);

  // As respostas do formulario sao o ouro da ficha: e o que ela contou antes
  // de entrar na call. Vao todas, na ordem em que foram perguntadas.
  const respostas = (a.respostas ?? {}) as Record<string, unknown>;
  const chaves = Object.keys(respostas).filter((k) => {
    const v = respostas[k];
    return v !== null && v !== undefined && String(v).trim() !== "";
  });
  if (chaves.length) {
    L.push("");
    L.push("*O que ela respondeu:*");
    for (const k of chaves) L.push(`- ${k}: ${respostas[k]}`);
  }
  if (a.observacoes) {
    L.push("");
    L.push(`*Observacoes:* ${a.observacoes}`);
  }
  if (a.agendado_por_nome) {
    L.push("");
    L.push(`_Marcada por ${a.agendado_por_nome}_`);
  }
  return L.join("\n");
}

const lembreteHost = (a: Record<string, any>, tipoNome: string) =>
  [
    "*Sua call e daqui a 1 hora*",
    "",
    `*${a.nome ?? "Sem nome"}* - ${hhmm(a.hora_inicio)}`,
    tipoNome,
    a.whatsapp ? `WhatsApp: ${a.whatsapp}` : "",
    a.link_reuniao ? `\nLink: ${a.link_reuniao}` : "",
  ].filter(Boolean).join("\n");

const lembreteLead = (a: Record<string, any>, primeiro: string) =>
  [
    `Oie ${primeiro}, tudo bem?`,
    "",
    `Passando pra lembrar da nossa conversa de hoje as ${hhmm(a.hora_inicio)}.`,
    a.link_reuniao ? `\nE por aqui: ${a.link_reuniao}` : "",
    "",
    "Consegue confirmar que vai estar?",
  ].filter(Boolean).join("\n");

Deno.serve(async (req) => {
  const { data: cfg } = await db
    .from("agenda_lembretes_config")
    .select("uazapi_url, uazapi_token, cron_secret, ligado")
    .eq("id", "unico")
    .maybeSingle();

  if (!cfg) {
    return new Response(JSON.stringify({ erro: "config ausente" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  // Protege o gatilho: sem o segredo, qualquer um dispararia lembrete pra lead.
  if (cfg.cron_secret && req.headers.get("x-cron-secret") !== cfg.cron_secret) {
    return new Response(JSON.stringify({ erro: "nao autorizado" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(req.url);
  // ?seco=1 mostra o que MANDARIA, sem mandar nada. E como se confere o texto
  // antes de soltar no WhatsApp de verdade.
  const seco = url.searchParams.get("seco") === "1";

  if (!cfg.ligado && !seco) {
    return new Response(JSON.stringify({ ok: true, desligado: true }), {
      headers: { "content-type": "application/json" },
    });
  }

  const agora = agoraBR();
  const hoje = agora.toISOString().slice(0, 10);
  const amanha = new Date(agora.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10);

  const { data: ags, error } = await db
    .from("agendamentos")
    .select(
      "id, nome, whatsapp, instagram, data, hora_inicio, link_reuniao, observacoes, respostas, status, anfitriao_id, tipo_id, agendado_por_nome",
    )
    .gte("data", hoje).lte("data", amanha)
    .order("data").order("hora_inicio");

  if (error) {
    return new Response(JSON.stringify({ erro: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const [{ data: anfitrioes }, { data: tipos }, { data: jaAvisados }] = await Promise.all([
    db.from("anfitrioes").select("id, nome, whatsapp"),
    db.from("agenda_tipos").select("id, nome"),
    db.from("agenda_lembretes").select("agendamento_id, tipo"),
  ]);

  const porId = new Map((anfitrioes ?? []).map((a) => [a.id, a]));
  const tipoPorId = new Map((tipos ?? []).map((t) => [t.id, t.nome as string]));
  const feito = new Set((jaAvisados ?? []).map((l) => `${l.agendamento_id}|${l.tipo}`));

  const enviados: string[] = [];
  const falhas: string[] = [];
  const previa: Record<string, string>[] = [];

  for (const a of ags ?? []) {
    if (String(a.status ?? "").toLowerCase().includes("cancel")) continue;

    const minutos = (quando(a.data, a.hora_inicio).getTime() - agora.getTime()) / 60000;
    const anfitriao = a.anfitriao_id ? porId.get(a.anfitriao_id) : null;
    const tipoNome = (a.tipo_id ? tipoPorId.get(a.tipo_id) : null) ?? "Reuniao";
    const numeroHost = numeroWhats(anfitriao?.whatsapp ?? null);
    const numeroLead = numeroWhats(a.whatsapp);

    // A janela de 1 hora e a mesma para os dois avisos (45 a 75 minutos),
    // entao eles saem na mesma rodada do cron.
    const janela1h = minutos <= 75 && minutos > 45;

    const tarefas: { tipo: string; numero: string | null; destino: string; texto: string; quando: boolean }[] = [
      {
        tipo: "ficha",
        numero: numeroHost,
        destino: anfitriao?.nome ?? "anfitriao",
        texto: fichaDoLead(a, tipoNome),
        quando: minutos > -60,
      },
      {
        tipo: "lead_1h",
        numero: numeroLead,
        destino: "lead",
        texto: lembreteLead(a, String(a.nome ?? "").trim().split(/\s+/)[0] || "tudo bem"),
        quando: janela1h,
      },
      {
        tipo: "host_1h",
        numero: numeroHost,
        destino: anfitriao?.nome ?? "anfitriao",
        texto: lembreteHost(a, tipoNome),
        quando: janela1h,
      },
    ];

    for (const t of tarefas) {
      if (!t.numero || !t.quando || feito.has(`${a.id}|${t.tipo}`)) continue;
      if (seco) {
        previa.push({ tipo: t.tipo, para: `${t.destino} (${t.numero})`, texto: t.texto });
        continue;
      }
      if (!(await marcar(a.id, t.tipo, t.destino, t.numero))) continue;
      const r = await enviar(cfg.uazapi_url, cfg.uazapi_token ?? "", t.numero, t.texto);
      if (r.ok) enviados.push(`${t.tipo}->${t.destino}`);
      else {
        await registrarFalha(a.id, t.tipo, r.erro!);
        falhas.push(`${t.tipo} ${a.id}: ${r.erro}`);
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, seco, olhou: (ags ?? []).length, enviados, falhas, previa }),
    { headers: { "content-type": "application/json" } },
  );
});
