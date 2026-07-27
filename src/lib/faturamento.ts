/**
 * Fonte única de verdade para o cálculo de "Faturado" (dinheiro que efetivamente entrou).
 *
 * Regra oficial (alinhada com Receitas):
 *  - Receitas: contam pelo campo `data`.
 *  - Parcelas de mentoria (parcelas_mentoria_detalhe): só contam quando
 *    `status = 'Quitado'` E `data_pagamento IS NOT NULL`.
 *
 * Parcelas quitadas sem `data_pagamento` são consideradas dados incompletos
 * e ficam de fora do faturamento até que a data de recebimento seja registrada.
 */

export type ParcelaDetLike = {
  status?: string | null;
  data_pagamento?: string | null;
  data_vencimento?: string;
  valor_real?: number | null;
  valor_sugerido?: number | null;
};

/** Retorna a data efetiva em que o dinheiro entrou, ou null se ainda não sabemos. */
export function getDataFaturamento(p: ParcelaDetLike): string | null {
  return p.data_pagamento ?? null;
}

/** True se a parcela deve contar como faturamento dentro do período [inicio, fim]. */
export function isParcelaFaturadaNoPeriodo(p: ParcelaDetLike, inicio: string, fim: string): boolean {
  if (p.status !== "Quitado") return false;
  const d = p.data_pagamento;
  if (!d) return false;
  return d >= inicio && d <= fim;
}

/** Soma o valor efetivamente recebido de uma parcela. */
export function valorRecebidoParcela(p: ParcelaDetLike): number {
  return p.valor_real ?? p.valor_sugerido ?? 0;
}

/** Filtra parcelas que compõem o faturamento no período informado. */
export function filtrarParcelasFaturadas<T extends ParcelaDetLike>(
  parcelas: T[],
  inicio: string,
  fim: string,
): T[] {
  return parcelas.filter(p => isParcelaFaturadaNoPeriodo(p, inicio, fim));
}
