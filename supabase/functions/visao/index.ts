// Ponte da aba Visão: o Escritório pergunta, o CRM responde.
//
// Mesmo desenho da ponte de Pessoas. A chave do CRM NUNCA chega no
// navegador: ela mora em `integracao_segredos`, que só a service_role lê,
// e quem chama o CRM é esta função, aqui no servidor.
//
// ARMADILHA QUE JÁ PEGOU (e quase vazou 385 contatos):
// `verify_jwt: true` NÃO garante que quem chamou está logado. A chave
// anônima do site também é um JWT válido e vai no navegador de qualquer
// visitante. Por isso a conferência é feita na mão, em dois passos:
//   1. o token é de um usuário de verdade?
//   2. esse usuário tem acesso ao Escritório?
// Os dois importam: no apps-ste tem app com cadastro aberto, então estar
// logado não é a mesma coisa que ser da casa.
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CRM = "https://crm.worklash.com.br/api/v1/public/visao";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json" },
  });

/** Só estas rotas passam. Lista fechada pra ninguém usar a ponte como proxy. */
const PERMITIDAS = new Set([
  "achados", "placar", "plantao", "esteira",
  "semana", "mes", "minerador/etapas", "minerador/ultima",
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!jwt) return json({ erro: "sem token" }, 401);

    const { data: quem } = await admin.auth.getUser(jwt);
    if (!quem?.user) return json({ erro: "não autenticado" }, 401);

    const { data: ok } = await admin.rpc("tem_acesso_escritorio", { _user_id: quem.user.id });
    if (ok !== true) return json({ erro: "sem acesso ao Escritório" }, 403);

    const corpo = await req.json().catch(() => ({}));
    const rota = String(corpo.rota ?? "achados");

    const { data: segredo } = await admin
      .from("integracao_segredos").select("valor").eq("chave", "crm_api_key_visao").single();
    if (!segredo?.valor) return json({ erro: "chave do CRM não configurada" }, 500);

    const cabecalho = {
      Authorization: `Bearer ${segredo.valor}`,
      "Content-Type": "application/json",
    };

    // Marcar um achado como feito: a única escrita que a ponte aceita.
    // Vai o e-mail de quem clicou, pra ficar registrado quem resolveu.
    if (corpo.marcar) {
      const id = String(corpo.marcar);
      const r = await fetch(`${CRM}/achados/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: cabecalho,
        body: JSON.stringify({ status: corpo.status ?? "FEITO", quem: quem.user.email }),
        signal: AbortSignal.timeout(20000),
      });
      return json(await r.json().catch(() => ({})), r.ok ? 200 : r.status);
    }

    // Minerar é a outra escrita: dispara uma leitura de IA nas conversas
    // travadas de uma etapa. Fica separada da lista de leitura porque é
    // POST e porque demora quase um minuto.
    if (corpo.minerarEtapa) {
      const r = await fetch(`${CRM}/minerador`, {
        method: "POST",
        headers: cabecalho,
        body: JSON.stringify({ stageId: String(corpo.minerarEtapa), limite: corpo.limite ?? 30 }),
        // A IA lê conversa por conversa: o tempo aqui precisa ser folgado.
        signal: AbortSignal.timeout(280000),
      });
      return json(await r.json().catch(() => ({})), r.ok ? 200 : r.status);
    }

    if (!PERMITIDAS.has(rota)) return json({ erro: "rota não permitida" }, 400);

    const params = new URLSearchParams();
    for (const c of ["status", "tipo", "severidade"]) {
      if (corpo[c]) params.set(c, String(corpo[c]));
    }
    const qs = params.toString();

    const r = await fetch(`${CRM}/${rota}${qs ? `?${qs}` : ""}`, {
      headers: cabecalho,
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) return json({ erro: `CRM respondeu ${r.status}` }, 502);
    return json(await r.json());
  } catch (e) {
    return json({ erro: String(e) }, 500);
  }
});
