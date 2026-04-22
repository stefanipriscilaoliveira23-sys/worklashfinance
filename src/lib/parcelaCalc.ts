// Helpers de cálculo financeiro para parcelas de mentoria.
// Não armazenamos dias_atraso/multa/juros — calculamos em tempo real.

export const MULTA_PERCENT = 0.10; // 10%
export const JUROS_MENSAL = 0.01;  // 1% ao mês (proporcional aos dias)

export function getInstallmentValue(d: { valor_real?: number | null; valor_sugerido?: number | null }): number {
  return d.valor_real ?? d.valor_sugerido ?? 0;
}

/** Dias entre hoje (00:00 local) e a data de vencimento. Negativo = ainda no prazo. */
export function diasAtraso(dataVencimento: string | null | undefined, status?: string | null): number {
  if (!dataVencimento) return 0;
  if (status === "Quitado") return 0;
  const venc = new Date(dataVencimento + "T00:00:00");
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diff = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export function calcularMulta(valorParcela: number, dias: number): number {
  return dias > 0 ? round2(valorParcela * MULTA_PERCENT) : 0;
}

export function calcularJuros(valorParcela: number, dias: number): number {
  return dias > 0 ? round2(valorParcela * JUROS_MENSAL * (dias / 30)) : 0;
}

export function calcularValorTotalAtualizado(valorParcela: number, multa: number, juros: number, desconto = 0): number {
  return round2(valorParcela + multa + juros - desconto);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ParcelaCalc {
  valorParcela: number;
  diasAtraso: number;
  multa: number;
  juros: number;
  multaJuros: number;
  desconto: number;
  valorTotalAtualizado: number;
}

export function computeParcela(
  detalhe: { valor_real?: number | null; valor_sugerido?: number | null; data_vencimento?: string | null; status?: string | null },
  desconto = 0
): ParcelaCalc {
  const valorParcela = getInstallmentValue(detalhe);
  const dias = diasAtraso(detalhe.data_vencimento, detalhe.status);
  const multa = calcularMulta(valorParcela, dias);
  const juros = calcularJuros(valorParcela, dias);
  const valorTotalAtualizado = calcularValorTotalAtualizado(valorParcela, multa, juros, desconto);
  return {
    valorParcela,
    diasAtraso: dias,
    multa,
    juros,
    multaJuros: round2(multa + juros),
    desconto,
    valorTotalAtualizado,
  };
}

/** Formata número como "1.234,56" (sem prefixo R$). */
export function formatBRL(value: number | null | undefined): string {
  const v = value ?? 0;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Primeira palavra do nome (saudação). */
export function primeiroNome(nome: string | null | undefined): string {
  if (!nome) return "";
  return nome.trim().split(/\s+/)[0] ?? "";
}

/** Data DD/MM/YYYY. */
export function formatDataBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR");
}
