export const STATUS_JORNADA = [
  "Onboarding",
  "Em andamento",
  "Acompanhamento",
  "Renovação",
  "Concluída",
  "Cancelada",
] as const;

export type StatusJornada = (typeof STATUS_JORNADA)[number];

export const PROGRAMAS = ["Educadora Outsider", "Mentoria Individual", "Imersão", "Outro"];

export const FORMAS_PAGAMENTO = ["Pix", "Cartão de crédito", "Boleto", "Transferência", "Dinheiro"];

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
