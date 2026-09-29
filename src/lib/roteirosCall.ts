/**
 * Roteiro de perguntas de cada tipo de call.
 *
 * A ideia: quem agenda (ou quem conduz) já encontra as perguntas prontas no
 * agendamento e vai preenchendo. As respostas ficam separadas por pergunta em
 * `agendamentos.respostas`, e não misturadas no texto de observações, pra
 * depois dar pra comparar entre calls.
 *
 * ONDE O ROTEIRO MORA HOJE: no banco, em `agenda_tipos.roteiro` (e o texto
 * explicativo em `agenda_tipos.sobre`). Passou pra lá quando o CRM ganhou o
 * botão de agendar, senão existiriam duas versões das mesmas perguntas, uma
 * em cada aplicação. As listas abaixo continuam aqui como plano B, pra um tipo
 * antigo que ainda não tenha roteiro gravado não ficar sem nenhuma pergunta.
 *
 * A chave é o SLUG do tipo, não o nome, porque o nome pode ser editado na tela
 * de configuração da agenda sem quebrar isto aqui.
 */

export type Pergunta = {
  chave: string;
  label: string;
  tipo: "texto" | "data" | "sim_nao" | "dinheiro";
  dica?: string;
};

export const ROTEIROS: Record<string, Pergunta[]> = {
  "reuniao-de-onboarding": [
    { chave: "entrada_mentoria", label: "Data em que ela entra na mentoria", tipo: "data" },
    { chave: "ja_da_curso", label: "Ela já ministra cursos?", tipo: "sim_nao" },
    {
      chave: "objetivo_principal",
      label: "Qual o principal objetivo dela ao entrar na mentoria?",
      tipo: "texto",
      dica: "Com as palavras dela, não as suas.",
    },
  ],

  "reuniao-estrategica": [
    { chave: "ja_da_curso", label: "Ela já dá curso?", tipo: "sim_nao" },
    { chave: "faturamento", label: "Quanto ela fatura?", tipo: "dinheiro" },
    { chave: "ja_foi_mentorada", label: "Ela já foi mentorada?", tipo: "sim_nao", dica: "De alguém, não necessariamente sua." },
    {
      chave: "dor_principal",
      label: "Qual a principal dor que ela mencionou?",
      tipo: "texto",
      dica: "A frase que ela usou, se der.",
    },
  ],

  "call-de-vendas": [
    { chave: "faturamento", label: "Quanto ela fatura?", tipo: "dinheiro" },
    { chave: "ja_da_curso", label: "Ela já dá cursos?", tipo: "sim_nao" },
    { chave: "objetivo_principal", label: "Qual o principal objetivo dela?", tipo: "texto" },
    { chave: "sabe_preco", label: "Ela já sabe o preço da mentoria?", tipo: "sim_nao" },
  ],
};

/** Explicação do que é cada call, pra quem for conduzir não errar o tom. */
export const SOBRE_O_TIPO: Record<string, string> = {
  "reuniao-de-onboarding":
    "Primeira call da aluna que acabou de entrar. É acolhimento e alinhamento do que vem pela frente.",
  "reuniao-estrategica":
    "Consultoria gratuita de diagnóstico. O objetivo é entregar valor de verdade primeiro; a oferta vem no fim, se fizer sentido.",
  "call-de-vendas":
    "Call com objetivo comercial declarado. A pessoa já sabe que é sobre entrar na mentoria.",
};

export function roteiroDoTipo(slug: string | null | undefined): Pergunta[] {
  if (!slug) return [];
  return ROTEIROS[slug] ?? [];
}

/** O tipo de agendamento como ele vem da tabela `agenda_tipos`. */
export type TipoDeCall = {
  slug?: string | null;
  roteiro?: unknown;
  sobre?: string | null;
};

/**
 * As perguntas desse tipo: o que está gravado no banco ganha; sem nada
 * gravado, cai na lista do código.
 */
export function perguntasDoTipo(tipo: TipoDeCall | null | undefined): Pergunta[] {
  if (!tipo) return [];
  const doBanco = Array.isArray(tipo.roteiro) ? (tipo.roteiro as Pergunta[]) : [];
  const validas = doBanco.filter((p) => p && typeof p.chave === "string" && typeof p.label === "string");
  return validas.length ? validas : roteiroDoTipo(tipo.slug);
}

/** A explicação do tipo, com a mesma regra: banco primeiro, código depois. */
export function sobreDoTipo(tipo: TipoDeCall | null | undefined): string {
  if (!tipo) return "";
  return (tipo.sobre ?? "").trim() || SOBRE_O_TIPO[tipo.slug ?? ""] || "";
}
