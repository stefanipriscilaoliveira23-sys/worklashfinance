import { supabase } from "@/integrations/supabase/client";

export type NovaNotificacao = {
  destinatario_id: string;
  titulo: string;
  descricao?: string | null;
  tipo?: string;
  link_interno?: string | null;
};

/** Cria uma notificação para um membro da equipe. Falha silenciosamente (não bloqueia a ação principal). */
export async function criarNotificacao(n: NovaNotificacao) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("notificacoes").insert({
    destinatario_id: n.destinatario_id,
    titulo: n.titulo,
    descricao: n.descricao ?? null,
    tipo: n.tipo ?? "geral",
    link_interno: n.link_interno ?? null,
    criado_por: auth?.user?.id ?? null,
  });
  if (error) console.warn("Falha ao criar notificação:", error.message);
}

/**
 * Avisa alguém que uma tarefa foi atribuída a ela. Não avisa se a pessoa
 * atribuiu a tarefa a si mesma (ninguém precisa de aviso do próprio ato).
 */
export async function notificarTarefaAtribuida(opts: {
  responsavelId: string | null | undefined;
  titulo: string;
  contexto?: string | null;
  link_interno?: string | null;
}) {
  if (!opts.responsavelId) return;
  const { data: auth } = await supabase.auth.getUser();
  if (auth?.user?.id === opts.responsavelId) return;
  await criarNotificacao({
    destinatario_id: opts.responsavelId,
    titulo: `Nova tarefa: ${opts.titulo}`,
    descricao: opts.contexto ?? null,
    tipo: "tarefa",
    link_interno: opts.link_interno ?? null,
  });
}

/** Notifica a si mesmo — usado quando a ação não tem responsável definido. */
export async function notificarProprio(n: Omit<NovaNotificacao, "destinatario_id">) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) return;
  await criarNotificacao({ ...n, destinatario_id: auth.user.id });
}
