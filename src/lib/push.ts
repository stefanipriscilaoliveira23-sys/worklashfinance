import { supabase } from "@/integrations/supabase/client";

/**
 * Notificações no celular (push).
 *
 * O que é preciso saber, e vale pra vida:
 *  - no iPhone só funciona se o app estiver INSTALADO na tela de início.
 *    No Safari normal a Apple simplesmente não oferece push. Não é bug.
 *  - a permissão só pode ser pedida a partir de um toque da pessoa, nunca
 *    sozinha ao abrir a tela.
 *  - cada aparelho gera uma inscrição própria. Celular e computador são
 *    dois cadastros diferentes, de propósito.
 */

export type SituacaoPush =
  | "pronto"            // dá pra ativar
  | "ativo"             // já está ativo neste aparelho
  | "negado"            // a pessoa recusou no navegador
  | "precisa_instalar"  // iPhone sem o app na tela de início
  | "sem_suporte";      // navegador antigo

export function estaInstalado(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari do iPhone usa uma propriedade própria
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function ehIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export async function situacaoPush(): Promise<SituacaoPush> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return ehIOS() && !estaInstalado() ? "precisa_instalar" : "sem_suporte";
  }
  if (ehIOS() && !estaInstalado()) return "precisa_instalar";
  if (Notification.permission === "denied") return "negado";

  const reg = await navigator.serviceWorker.getRegistration();
  const inscricao = await reg?.pushManager.getSubscription();
  return inscricao ? "ativo" : "pronto";
}

function chaveParaBytes(base64: string): Uint8Array {
  const preenchido = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const cru = atob(preenchido);
  return Uint8Array.from([...cru].map((c) => c.charCodeAt(0)));
}

async function chavePublica(): Promise<string> {
  const { data, error } = await supabase.functions.invoke("push", {
    body: { acao: "chave-publica" },
  });
  if (error) throw new Error("Não consegui falar com o servidor de notificações");
  const chave = (data as { chave_publica?: string })?.chave_publica;
  if (!chave) throw new Error("O servidor não devolveu a chave de notificação");
  return chave;
}

/** Registra este aparelho. Precisa ser chamado a partir de um clique. */
export async function ativarPush(): Promise<void> {
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") {
    throw new Error(
      permissao === "denied"
        ? "Você recusou as notificações. Dá pra liberar de novo nos ajustes do navegador."
        : "Permissão não concedida."
    );
  }

  const reg =
    (await navigator.serviceWorker.getRegistration()) ??
    (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;

  const jaTinha = await reg.pushManager.getSubscription();
  const inscricao =
    jaTinha ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chaveParaBytes(await chavePublica()),
    }));

  const bruto = inscricao.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) throw new Error("Faça login de novo pra ativar as notificações");

  const { error } = await supabase.from("push_inscricoes").upsert(
    {
      user_id: auth.user.id,
      endpoint: bruto.endpoint!,
      p256dh: bruto.keys!.p256dh,
      auth: bruto.keys!.auth,
      aparelho: navigator.userAgent.slice(0, 200),
    },
    { onConflict: "endpoint" }
  );
  if (error) throw new Error(error.message);
}

/** Desliga neste aparelho. Os outros continuam recebendo. */
export async function desativarPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const inscricao = await reg?.pushManager.getSubscription();
  if (inscricao) {
    await supabase.from("push_inscricoes").delete().eq("endpoint", inscricao.endpoint);
    await inscricao.unsubscribe();
  }
}

/** Registra o service worker no carregamento, sem pedir nada à pessoa. */
export function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* sem service worker o app segue funcionando, só não tem push */
    });
  });
}
