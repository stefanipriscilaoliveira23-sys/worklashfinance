import { useEffect, useRef } from "react";

type Field = "percent" | "valor" | "liquido" | null;

interface Args {
  valorVenda: number;
  taxaPercent: number;
  taxaValor: number;
  valorLiquido: number;
  setTaxaPercent: (v: number) => void;
  setTaxaValor: (v: number) => void;
  setValorLiquido: (v: number) => void;
  /** Campo atualmente em foco (não deve ser sobrescrito). */
  activeField: Field;
  /** Habilita o cálculo (default true). */
  enabled?: boolean;
  /** Debounce em ms (default 300). */
  debounceMs?: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Calculadora bidirecional para Taxa%, Valor da taxa e Valor líquido,
 * tendo `valorVenda` como base. Usa debounce para não recalcular a cada tecla.
 *
 * Regras:
 * - Editou Taxa%       → recalcula Valor da taxa e Valor líquido
 * - Editou Valor taxa  → recalcula Taxa% e Valor líquido
 * - Editou Valor líquido → recalcula Valor taxa e Taxa%
 * - Validações: Taxa <= 100, Líquido <= Venda
 * - O campo em foco não é sobrescrito.
 */
export function useTaxaCalculator({
  valorVenda,
  taxaPercent,
  taxaValor,
  valorLiquido,
  setTaxaPercent,
  setTaxaValor,
  setValorLiquido,
  activeField,
  enabled = true,
  debounceMs = 300,
}: Args) {
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!valorVenda || valorVenda <= 0) return;

    if (timer.current) window.clearTimeout(timer.current);

    timer.current = window.setTimeout(() => {
      // Decide qual campo é a "fonte da verdade" (último editado / com foco).
      const source: Field = activeField ?? "percent";

      if (source === "percent") {
        const pct = Math.min(Math.max(taxaPercent, 0), 100);
        const tv = round2(valorVenda * (pct / 100));
        const liq = round2(valorVenda - tv);
        if (tv !== round2(taxaValor)) setTaxaValor(tv);
        if (liq !== round2(valorLiquido)) setValorLiquido(liq);
        if (pct !== taxaPercent) setTaxaPercent(round2(pct));
      } else if (source === "valor") {
        const tv = Math.min(Math.max(taxaValor, 0), valorVenda);
        const pct = round2((tv / valorVenda) * 100);
        const liq = round2(valorVenda - tv);
        if (pct !== round2(taxaPercent)) setTaxaPercent(pct);
        if (liq !== round2(valorLiquido)) setValorLiquido(liq);
        if (tv !== taxaValor) setTaxaValor(round2(tv));
      } else if (source === "liquido") {
        const liq = Math.min(Math.max(valorLiquido, 0), valorVenda);
        const tv = round2(valorVenda - liq);
        const pct = round2((tv / valorVenda) * 100);
        if (pct !== round2(taxaPercent)) setTaxaPercent(pct);
        if (tv !== round2(taxaValor)) setTaxaValor(tv);
        if (liq !== valorLiquido) setValorLiquido(round2(liq));
      }
    }, debounceMs);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorVenda, taxaPercent, taxaValor, valorLiquido, activeField, enabled]);
}
