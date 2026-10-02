// Disparo das campanhas da aba Campanhas nos grupos de WhatsApp, pela uazapi (número 1388).
//
// Chamada pelo pg_cron a cada minuto (job campanhas-disparo), com o cabeçalho x-cron-secret.
// 1. Mensagens "agendada" cujo dia+hora (Brasília) já chegou ganham uma linha em campanha_envios
//    por grupo de destino. O unique (mensagem_id, jid) impede mandar duas vezes no mesmo grupo.
// 2. Manda os envios pendentes um a um, com intervalo aleatório, até ~50 s por chamada.
//    Cada envio é "reservado" (pendente -> enviando) antes de mandar, então duas chamadas
//    ao mesmo tempo nunca mandam o mesmo envio.
// 3. Mensagem com todos os grupos resolvidos vira "enviada" (ou "erro", com o resumo).
import { createClient } from "npm:@supabase/supabase-js@2";

const TZ = "America/Sao_Paulo";
const ORCAMENTO_MS = 50_000;
const INTERVALO_MIN_MS = 3_000;
const INTERVALO_MAX_MS = 7_000;
const ATRASO_MAXIMO_MIN = 120; // passou disso sem começar, não manda (evita oferta velha sair do nada)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** "AAAA-MM-DD HH:MM:SS" de agora em Brasília */
function agoraBR() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

const TIPO_UAZAPI: Record<string, string> = { imagem: "image", video: "video", audio: "audio", documento: "document" };

Deno.serve(async (req) => {
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: cfgRows, error: cfgErr } = await db.from("campanha_config").select("chave, valor");
    if (cfgErr) throw cfgErr;
    const cfg = Object.fromEntries((cfgRows ?? []).map((r) => [r.chave, r.valor]));
    if (!cfg.cron_segredo || req.headers.get("x-cron-secret") !== cfg.cron_segredo) return json({ erro: "não autorizado" }, 401);

    const inicio = Date.now();
    const agora = agoraBR();
    const hoje = agora.slice(0, 10);

    // ---------- 1. prepara os envios das mensagens que chegaram na hora ----------
    const { data: agendadas, error: e1 } = await db.from("campanha_mensagens")
      .select("id, dia, hora, grupos, atualizado_em, campanhas!inner(status)")
      .eq("status", "agendada").lte("dia", hoje);
    if (e1) throw e1;

    const { data: grupos, error: e2 } = await db.from("campanha_grupos").select("id, nome, jid, ativo");
    if (e2) throw e2;

    let preparadas = 0;
    for (const m of agendadas ?? []) {
      const quando = `${m.dia} ${m.hora}`;
      // deno-lint-ignore no-explicit-any
      const stCampanha = (m as any).campanhas?.status;
      if (quando > agora || ["pausada", "cancelada"].includes(stCampanha)) continue;

      const { count } = await db.from("campanha_envios").select("id", { count: "exact", head: true }).eq("mensagem_id", m.id);
      const atrasoMin = (Date.now() - Date.parse(`${m.dia}T${m.hora}-03:00`)) / 60000;
      if (!count && atrasoMin > ATRASO_MAXIMO_MIN) {
        await db.from("campanha_mensagens").update({
          status: "erro", erro: `Não saiu: o horário passou há mais de ${ATRASO_MAXIMO_MIN / 60} horas. Reagende se ainda quiser mandar.`,
        }).eq("id", m.id);
        continue;
      }

      const alvo = (grupos ?? []).filter((g) => g.jid && (m.grupos ? m.grupos.includes(g.id) : g.ativo));
      if (alvo.length === 0) {
        await db.from("campanha_mensagens").update({ status: "erro", erro: "Nenhum grupo de destino com endereço (JID) cadastrado." }).eq("id", m.id);
        continue;
      }
      await db.from("campanha_envios").upsert(
        alvo.map((g) => ({ mensagem_id: m.id, grupo_id: g.id, grupo_nome: g.nome, jid: g.jid })),
        { onConflict: "mensagem_id,jid", ignoreDuplicates: true },
      );
      // mensagem que deu erro e foi agendada de novo: tenta de novo só os grupos que falharam
      await db.from("campanha_envios").update({ status: "pendente", erro: null })
        .eq("mensagem_id", m.id).eq("status", "erro").lt("tentado_em", m.atualizado_em);
      preparadas++;
    }

    // ---------- 2. manda os pendentes ----------
    const resultado = { enviados: 0, erros: 0 };
    while (Date.now() - inicio < ORCAMENTO_MS) {
      const { data: pend, error: e3 } = await db.from("campanha_envios")
        .select("id, jid, grupo_nome, mensagem_id, campanha_mensagens!inner(dia, hora, ordem, texto, midia_url, midia_tipo, status)")
        .eq("status", "pendente").eq("campanha_mensagens.status", "agendada").limit(200);
      if (e3) throw e3;
      if (!pend?.length) break;

      // mesmo horário: grupo por grupo, e dentro do grupo na ordem das mensagens
      // deno-lint-ignore no-explicit-any
      const msg = (x: any) => x.campanha_mensagens;
      pend.sort((a, b) =>
        `${msg(a).dia} ${msg(a).hora}`.localeCompare(`${msg(b).dia} ${msg(b).hora}`) ||
        a.grupo_nome.localeCompare(b.grupo_nome) || msg(a).ordem - msg(b).ordem);
      const e = pend[0];
      const m = msg(e);

      const { data: reservado } = await db.from("campanha_envios")
        .update({ status: "enviando", tentado_em: new Date().toISOString() })
        .eq("id", e.id).eq("status", "pendente").select("id");
      if (!reservado?.length) continue; // outra chamada pegou este

      const corpo = m.midia_url
        ? {
          number: e.jid, type: TIPO_UAZAPI[m.midia_tipo] ?? "document", file: m.midia_url, text: m.texto || undefined,
          ...(m.midia_tipo === "documento" ? { docName: decodeURIComponent(m.midia_url.split("/").pop()!.split("?")[0]) } : {}),
        }
        : { number: e.jid, text: m.texto, linkPreview: true };

      let ok = false, erro = "", wid: string | null = null;
      try {
        const r = await fetch(`${cfg.uazapi_base}/send/${m.midia_url ? "media" : "text"}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: cfg.uazapi_token },
          body: JSON.stringify(corpo),
          signal: AbortSignal.timeout(40_000),
        });
        const t = await r.text();
        let j: Record<string, unknown> = {};
        try { j = JSON.parse(t); } catch { /* resposta não é json */ }
        ok = r.ok && !j.error;
        wid = (j.messageid as string) ?? null;
        if (!ok) erro = String(j.error ?? j.message ?? `HTTP ${r.status}: ${t.slice(0, 200)}`);
      } catch (err) {
        erro = `Falha ao chamar a uazapi: ${(err as Error).message}`;
      }

      await db.from("campanha_envios").update(ok
        ? { status: "enviado", enviado_em: new Date().toISOString(), whatsapp_id: wid, erro: null }
        : { status: "erro", erro }).eq("id", e.id);
      ok ? resultado.enviados++ : resultado.erros++;

      if (Date.now() - inicio < ORCAMENTO_MS) await dormir(INTERVALO_MIN_MS + Math.random() * (INTERVALO_MAX_MS - INTERVALO_MIN_MS));
    }

    // ---------- 3. fecha as mensagens ----------
    // envio que ficou "enviando" por 10 min (função caiu no meio): não reenvia, para não duplicar
    await db.from("campanha_envios").update({ status: "erro", erro: "Sem confirmação da uazapi. Confira no grupo antes de reenviar." })
      .eq("status", "enviando").lt("tentado_em", new Date(Date.now() - 10 * 60_000).toISOString());

    const { data: abertas } = await db.from("campanha_mensagens").select("id, campanha_id").eq("status", "agendada").lte("dia", hoje);
    const campanhasMexidas = new Set<string>();
    for (const m of abertas ?? []) {
      const { data: env } = await db.from("campanha_envios").select("status, grupo_nome, erro, enviado_em").eq("mensagem_id", m.id);
      if (!env?.length || env.some((x) => x.status === "pendente" || x.status === "enviando")) continue;
      const falhas = env.filter((x) => x.status === "erro");
      const ultimo = env.map((x) => x.enviado_em).filter(Boolean).sort().pop() ?? new Date().toISOString();
      await db.from("campanha_mensagens").update(falhas.length
        ? {
          status: "erro", enviado_em: ultimo,
          erro: `${falhas.length} de ${env.length} grupos falharam: ` + falhas.map((f) => `${f.grupo_nome} (${f.erro})`).join("; ").slice(0, 900),
        }
        : { status: "enviada", enviado_em: ultimo, erro: null }).eq("id", m.id);
      campanhasMexidas.add(m.campanha_id);
    }

    // campanha: em andamento enquanto falta mensagem agendada, concluída quando acabou
    for (const id of campanhasMexidas) {
      const { data: ms } = await db.from("campanha_mensagens").select("status").eq("campanha_id", id);
      const falta = (ms ?? []).some((x) => x.status === "agendada");
      await db.from("campanhas").update({ status: falta ? "em_andamento" : "concluida" }).eq("id", id).not("status", "in", "(pausada,cancelada)");
    }

    return json({ ok: true, agora, preparadas, ...resultado, fechadas: campanhasMexidas.size });
  } catch (err) {
    console.error(err);
    return json({ ok: false, erro: (err as Error).message ?? String(err) }, 500);
  }
});
