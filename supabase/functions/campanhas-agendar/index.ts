// Agenda (ou lista / cancela) mensagens da aba Campanhas sem passar pela tela.
// Usado pelo comando scripts/agendar-campanha.mjs, que o Claude roda quando a Stéfani manda
// a copy e a imagem no chat. Autenticação: cabeçalho x-segredo = campanha_config.agendar_segredo.
//
// POST { acao: "agendar", oferta, texto, dia: "AAAA-MM-DD", hora: "HH:MM", titulo?, descricao?,
//        imagem?: { base64, nome, mime }, midia_url?, grupos?: "todos" | "teste" | string[] (nomes),
//        rascunho?: boolean }
// POST { acao: "listar" }                 -> mensagens agendadas de hoje em diante
// POST { acao: "cancelar", mensagem_id }  -> status cancelada (só se ainda não começou a sair)
import { createClient } from "npm:@supabase/supabase-js@2";
import { decodeBase64 } from "jsr:@std/encoding@1/base64";

const TZ = "America/Sao_Paulo";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function agoraBR() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

function tipoDaMidia(nome: string, mime = "") {
  if (mime.startsWith("image/")) return "imagem";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  const ext = nome.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "imagem";
  if (["mp4", "mov", "webm", "m4v"].includes(ext)) return "video";
  if (["mp3", "ogg", "opus", "m4a", "wav"].includes(ext)) return "audio";
  return "documento";
}

Deno.serve(async (req) => {
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: seg } = await db.from("campanha_config").select("valor").eq("chave", "agendar_segredo").maybeSingle();
    if (!seg?.valor || req.headers.get("x-segredo") !== seg.valor) return json({ erro: "não autorizado" }, 401);

    const b = await req.json();
    const hoje = agoraBR().slice(0, 10);

    if (b.acao === "listar") {
      const { data, error } = await db.from("campanha_mensagens")
        .select("id, dia, hora, titulo, status, grupos, midia_tipo, texto, campanhas(oferta)")
        .gte("dia", hoje).in("status", ["agendada", "rascunho", "erro"]).order("dia").order("hora");
      if (error) throw error;
      return json({ ok: true, mensagens: (data ?? []).map((m) => ({ ...m, texto: m.texto.slice(0, 80) })) });
    }

    if (b.acao === "cancelar") {
      const { count } = await db.from("campanha_envios").select("id", { count: "exact", head: true })
        .eq("mensagem_id", b.mensagem_id).neq("status", "pendente");
      if (count) return json({ erro: "Essa mensagem já começou a sair nos grupos. Não dá para cancelar o que já foi." }, 409);
      const { data, error } = await db.from("campanha_mensagens").update({ status: "cancelada" }).eq("id", b.mensagem_id).select("id, dia, hora");
      if (error) throw error;
      await db.from("campanha_envios").delete().eq("mensagem_id", b.mensagem_id).eq("status", "pendente");
      return json({ ok: true, cancelada: data?.[0] ?? null });
    }

    if (b.acao !== "agendar") return json({ erro: "acao deve ser agendar, listar ou cancelar" }, 400);

    // ---------- validação ----------
    const oferta = String(b.oferta ?? "").trim();
    const texto = String(b.texto ?? "");
    const dia = String(b.dia ?? "");
    const hora = String(b.hora ?? "").slice(0, 5);
    if (!oferta) return json({ erro: "Falta o nome da oferta" }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !/^\d{2}:\d{2}$/.test(hora)) return json({ erro: "Dia (AAAA-MM-DD) ou hora (HH:MM) inválidos" }, 400);
    if (!texto.trim() && !b.imagem && !b.midia_url) return json({ erro: "Falta texto ou imagem" }, 400);
    const status = b.rascunho ? "rascunho" : "agendada";
    if (status === "agendada" && `${dia} ${hora}` <= agoraBR()) return json({ erro: `Esse horário já passou (agora são ${agoraBR().slice(11)} em Brasília)` }, 400);

    // ---------- grupos ----------
    const { data: grupos } = await db.from("campanha_grupos").select("id, nome, jid, ativo");
    let gruposIds: string[] | null = null;
    let destino: string[];
    if (!b.grupos || b.grupos === "todos") {
      destino = (grupos ?? []).filter((g) => g.ativo && g.jid).map((g) => g.nome);
    } else {
      const nomes: string[] = b.grupos === "teste" ? ["Marketing Ste (teste)"] : b.grupos;
      const achados = nomes.map((n) => (grupos ?? []).find((g) => g.nome.toLowerCase() === n.toLowerCase()));
      const faltam = nomes.filter((_, i) => !achados[i]);
      if (faltam.length) return json({ erro: `Grupo não encontrado: ${faltam.join(", ")}` }, 400);
      gruposIds = achados.map((g) => g!.id);
      destino = achados.map((g) => g!.nome);
    }
    if (!destino.length) return json({ erro: "Nenhum grupo de destino" }, 400);

    // ---------- campanha: reaproveita a da mesma oferta que ainda não acabou ----------
    let { data: campanha } = await db.from("campanhas").select("*").eq("oferta", oferta)
      .not("status", "in", "(concluida,cancelada)").order("criado_em", { ascending: false }).limit(1).maybeSingle();
    if (!campanha) {
      const { data, error } = await db.from("campanhas").insert({
        oferta, descricao: b.descricao ?? "", data_inicio: dia, status: status === "agendada" ? "agendada" : "rascunho",
        ...(b.cor ? { cor: b.cor } : {}),
      }).select().single();
      if (error) throw error;
      campanha = data;
    }

    // ---------- mídia ----------
    let midia_url: string | null = b.midia_url ?? null;
    let midia_tipo: string | null = midia_url ? tipoDaMidia(midia_url) : null;
    if (b.imagem?.base64) {
      const nome = String(b.imagem.nome ?? "midia.jpg").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "-");
      const path = `${campanha.id}/${Date.now()}-${nome}`;
      const { error } = await db.storage.from("campanhas").upload(path, decodeBase64(b.imagem.base64), { contentType: b.imagem.mime || undefined });
      if (error) throw error;
      midia_url = db.storage.from("campanhas").getPublicUrl(path).data.publicUrl;
      midia_tipo = tipoDaMidia(nome, b.imagem.mime);
    }

    const { count: ordem } = await db.from("campanha_mensagens").select("id", { count: "exact", head: true })
      .eq("campanha_id", campanha.id).eq("dia", dia);
    const { data: msg, error: eMsg } = await db.from("campanha_mensagens").insert({
      campanha_id: campanha.id, dia, hora, ordem: ordem ?? 0, titulo: b.titulo ?? "", texto,
      midia_url, midia_tipo, grupos: gruposIds, status,
    }).select("id").single();
    if (eMsg) throw eMsg;

    if (status === "agendada" && campanha.status === "rascunho") await db.from("campanhas").update({ status: "agendada" }).eq("id", campanha.id);
    // período da campanha acompanha as mensagens
    const ini = !campanha.data_inicio || dia < campanha.data_inicio ? dia : campanha.data_inicio;
    const fim = campanha.data_fim && campanha.data_fim > dia ? campanha.data_fim : dia;
    await db.from("campanhas").update({ data_inicio: ini, data_fim: fim }).eq("id", campanha.id);

    return json({ ok: true, status, campanha: oferta, campanha_id: campanha.id, mensagem_id: msg.id, dia, hora, midia_url, grupos: destino });
  } catch (err) {
    console.error(err);
    return json({ ok: false, erro: (err as Error).message ?? String(err) }, 500);
  }
});
