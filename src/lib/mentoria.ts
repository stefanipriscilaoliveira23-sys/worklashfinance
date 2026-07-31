import { supabase } from "@/integrations/supabase/client";

export const STATUS_JORNADA = [
  "Onboarding",
  "Ativa",
  "Em risco",
  "Renovação",
  "Inativa",
  "Cancelada",
  "Concluída",
] as const;

export type StatusJornada = (typeof STATUS_JORNADA)[number];

export const PROGRAMAS = ["Educadora Outsider", "Digital Beauty", "Mentoria Individual", "Imersão", "Outro"];

export const FORMAS_PAGAMENTO = ["Pix", "Cartão de crédito", "Boleto", "Transferência", "Dinheiro"];

/** Gera as tarefas configuradas de uma etapa para uma mentorada, sem duplicar. */
export async function gerarTarefasDaEtapa(mentoradaId: string, etapa: string, pipelineId?: string | null): Promise<number> {
  let q = supabase
    .from("processos_etapa").select("*").eq("etapa", etapa).eq("ativo", true);
  if (pipelineId) q = q.eq("pipeline_id", pipelineId);
  const { data: processos } = await q.order("ordem", { ascending: true });
  if (!processos?.length) return 0;


  const { data: existentes } = await supabase
    .from("mentorada_tarefas").select("processo_id, titulo")
    .eq("mentorada_id", mentoradaId).eq("etapa", etapa);

  const idsFeitos = new Set((existentes ?? []).map((t) => t.processo_id).filter(Boolean));
  const titulosFeitos = new Set((existentes ?? []).map((t) => t.titulo));

  const novas = processos
    .filter((p) => !idsFeitos.has(p.id) && !titulosFeitos.has(p.titulo))
    .map((p) => ({
      mentorada_id: mentoradaId,
      titulo: p.titulo,
      descricao: p.descricao,
      categoria: etapa,
      etapa,
      processo_id: p.id,
      ordem: p.ordem,
    }));

  if (!novas.length) return 0;
  const { error } = await supabase.from("mentorada_tarefas").insert(novas);
  if (error) throw error;
  return novas.length;
}


/** Checklist padrão criado automaticamente no onboarding de cada mentorada. */
export const CHECKLIST_ONBOARDING: { titulo: string; categoria: string }[] = [
  { titulo: "Enviar mensagem de boas-vindas", categoria: "Ação da equipe" },
  { titulo: "Enviar contrato para assinatura", categoria: "Ação da equipe" },
  { titulo: "Confirmar assinatura do contrato", categoria: "Ação da equipe" },
  { titulo: "Liberar acesso à plataforma", categoria: "Ação da equipe" },
  { titulo: "Adicionar no grupo de alunas", categoria: "Ação da equipe" },
  { titulo: "Enviar formulário de onboarding", categoria: "Ação da equipe" },
  { titulo: "Preencher formulário de onboarding", categoria: "Ação para a mentorada" },
  { titulo: "Agendar call de boas-vindas", categoria: "Ação da equipe" },
  { titulo: "Montar plano de ação inicial", categoria: "Ação da equipe" },
  { titulo: "Registrar mentorada no financeiro", categoria: "Ação da equipe" },
];

/** Check-ins de acompanhamento criados automaticamente a partir da data de início. */
export const CHECKINS_PADRAO: { tipo: string; dias: number }[] = [
  { tipo: "Check-in D+3", dias: 3 },
  { tipo: "Check-in D+7", dias: 7 },
  { tipo: "Check-in D+15", dias: 15 },
  { tipo: "Check-in D+30", dias: 30 },
  { tipo: "Check-in D+60", dias: 60 },
  { tipo: "Check-in D+90", dias: 90 },
];

export function addDias(dataISO: string, dias: number): string {
  const d = new Date(dataISO + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().split("T")[0];
}

export function addMeses(dataISO: string, meses: number): string {
  const d = new Date(dataISO + "T00:00:00");
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().split("T")[0];
}

export function diasRestantes(dataISO: string | null | undefined): number | null {
  if (!dataISO) return null;
  const alvo = new Date(dataISO + "T00:00:00").getTime();
  const hoje = new Date(new Date().toISOString().split("T")[0] + "T00:00:00").getTime();
  return Math.round((alvo - hoje) / 86400000);
}

export function interpolar(texto: string, nome: string): string {
  const primeiro = (nome ?? "").trim().split(" ")[0] ?? "";
  return texto.replace(/\[Nome\]/g, primeiro);
}
