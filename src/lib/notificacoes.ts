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

/** Notifica a si mesmo — usado quando a ação não tem responsável definido. */
export async function notificarProprio(n: Omit<NovaNotificacao, "destinatario_id">) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) return;
  await criarNotificacao({ ...n, destinatario_id: auth.user.id });
}
