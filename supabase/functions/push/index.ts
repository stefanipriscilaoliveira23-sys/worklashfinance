import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Notificações push do Escritório.
//
// Duas ações:
//   chave-publica : devolve a chave pública do push. Se ainda não existir par
//                   de chaves, gera aqui dentro e guarda em push_config. A
//                   chave privada nunca sai do servidor.
//   enviar        : dispara a notificação para os aparelhos de uma pessoa.
//                   Só aceita chamada com o papel de serviço (o gatilho do
//                   banco), nunca de um usuário comum.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const responder = (status: number, corpo: Record<string, unknown>) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

function papelDoToken(auth: string): string | null {
  try {
    const t = auth.replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder(405, { erro: "Use POST" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, servico);

  const autorizacao = req.headers.get("Authorization") ?? "";
  if (!autorizacao) return responder(401, { erro: "Sem login" });

  let corpo: { acao?: string; user_id?: string; titulo?: string; descricao?: string; link?: string };
  try {
    corpo = await req.json();
  } catch {
    return responder(400, { erro: "Corpo inválido" });
  }

  // --- garante que existe um par de chaves ---
  const carregarChaves = async () => {
    const { data } = await admin.from("push_config").select("*").eq("id", 1).maybeSingle();
    if (data) return data;
    const novas = webpush.generateVAPIDKeys();
    const { data: criada, error } = await admin.from("push_config").insert({
      id: 1,
      vapid_public: novas.publicKey,
      vapid_private: novas.privateKey,
      contato: "mailto:stefanipriscilaoliveira23@gmail.com",
    }).select("*").single();
    if (error) throw new Error(error.message);
    return criada;
  };

  if (corpo.acao === "chave-publica") {
    try {
      const chaves = await carregarChaves();
      return responder(200, { chave_publica: chaves.vapid_public });
    } catch (e) {
      return responder(500, { erro: (e as Error).message });
    }
  }

  if (corpo.acao === "enviar") {
    if (papelDoToken(autorizacao) !== "service_role") {
      return responder(403, { erro: "Só o próprio sistema pode disparar notificação" });
    }
    if (!corpo.user_id || !corpo.titulo) {
      return responder(400, { erro: "Informe user_id e titulo" });
    }

    const chaves = await carregarChaves();
    webpush.setVapidDetails(chaves.contato, chaves.vapid_public, chaves.vapid_private);

    const { data: inscricoes } = await admin
      .from("push_inscricoes").select("*").eq("user_id", corpo.user_id);

    if (!inscricoes?.length) return responder(200, { enviados: 0, motivo: "nenhum aparelho inscrito" });

    const carga = JSON.stringify({
      titulo: corpo.titulo,
      descricao: corpo.descricao ?? "",
      link: corpo.link ?? "/",
    });

    let ok = 0;
    const mortas: string[] = [];

    for (const i of inscricoes) {
      try {
        await webpush.sendNotification(
          { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
          carga,
        );
        ok++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410 = o aparelho desinstalou o app ou revogou. Some da lista.
        if (status === 404 || status === 410) mortas.push(i.endpoint);
      }
    }

    if (mortas.length) {
      await admin.from("push_inscricoes").delete().in("endpoint", mortas);
    }
    if (ok) {
      await admin.from("push_inscricoes")
        .update({ ultimo_envio: new Date().toISOString() })
        .eq("user_id", corpo.user_id);
    }

    return responder(200, { enviados: ok, removidos: mortas.length });
  }

  return responder(400, { erro: "Ação desconhecida" });
});
