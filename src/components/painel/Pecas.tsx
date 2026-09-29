import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { LucideIcon } from "lucide-react";

/** Variação percentual entre dois números, tratando o zero sem explodir. */
export function variacao(agora: number, antes: number): number | null {
  if (antes === 0) return agora === 0 ? 0 : null;
  return ((agora - antes) / Math.abs(antes)) * 100;
}

/**
 * `formato` diz como escrever o valor de antes. Contagem de vendas não é
 * dinheiro: escrever "37" como "R$ 37,00" faz a comparação mentir.
 */
export function Comparacao({
  agora, antes, legenda, formato = "dinheiro",
}: {
  agora: number; antes: number; legenda: string; formato?: "dinheiro" | "numero";
}) {
  const v = variacao(agora, antes);
  if (v === null) {
    return <p className="mt-1 text-[10px] text-muted-foreground">{legenda}: nada no período</p>;
  }
  const subiu = v > 0.5;
  const caiu = v < -0.5;
  const Icone = subiu ? ArrowUpRight : caiu ? ArrowDownRight : Minus;
  const cor = subiu ? "text-emerald-500" : caiu ? "text-destructive" : "text-muted-foreground";
  const escrito = formato === "numero"
    ? antes.toLocaleString("pt-BR")
    : formatCurrency(antes);
  return (
    <p className={`mt-1 flex items-center gap-1 text-[10px] ${cor}`}>
      <Icone className="h-3 w-3 shrink-0" />
      <span className="font-medium">{v > 0 ? "+" : ""}{v.toFixed(0)}%</span>
      <span className="text-muted-foreground">{legenda} ({escrito})</span>
    </p>
  );
}

type TomCartao = "normal" | "destaque" | "alerta" | "bom";

const TONS: Record<TomCartao, { caixa: string; valor: string; icone: string }> = {
  normal:   { caixa: "border-border bg-card", valor: "text-foreground", icone: "text-primary" },
  destaque: { caixa: "border-primary/50 bg-primary/5", valor: "text-primary", icone: "text-primary" },
  alerta:   { caixa: "border-destructive/40 bg-destructive/5", valor: "text-destructive", icone: "text-destructive" },
  bom:      { caixa: "border-emerald-500/40 bg-emerald-500/5", valor: "text-emerald-500", icone: "text-emerald-500" },
};

export function Cartao({
  titulo, valor, detalhe, icone: Icone, tom = "normal", aoClicar, children,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  icone?: LucideIcon;
  tom?: TomCartao;
  aoClicar?: () => void;
  children?: React.ReactNode;
}) {
  const t = TONS[tom];
  return (
    <div
      onClick={aoClicar}
      className={`rounded-xl border p-4 transition-colors ${t.caixa} ${aoClicar ? "cursor-pointer hover:bg-surface-hover" : ""}`}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{titulo}</span>
        {Icone && <Icone className={`h-3.5 w-3.5 shrink-0 ${t.icone}`} />}
      </div>
      <p className={`text-xl font-bold leading-tight ${t.valor}`}>{valor}</p>
      {detalhe && <p className="mt-0.5 text-[10px] text-muted-foreground">{detalhe}</p>}
      {children}
    </div>
  );
}

/** Cartão que mostra bruto e líquido juntos, com o líquido em destaque. */
export function CartaoBrutoLiquido({
  titulo, bruto, liquido, detalhe, icone: Icone,
}: {
  titulo: string; bruto: number; liquido: number; detalhe?: string; icone?: LucideIcon;
}) {
  const taxa = bruto - liquido;
  return (
    <div className="rounded-xl border border-primary/50 bg-primary/5 p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{titulo}</span>
        {Icone && <Icone className="h-3.5 w-3.5 shrink-0 text-primary" />}
      </div>
      <p className="text-xl font-bold leading-tight text-primary">{formatCurrency(liquido)}</p>
      <p className="text-[10px] text-muted-foreground">líquido, já sem a taxa</p>
      <div className="mt-2 border-t border-border/60 pt-2">
        <p className="text-[11px] text-muted-foreground">
          Bruto <span className="font-medium text-foreground">{formatCurrency(bruto)}</span>
          {taxa > 0.5 && <> · taxa <span className="text-destructive">{formatCurrency(taxa)}</span></>}
        </p>
        {detalhe && <p className="mt-0.5 text-[10px] text-muted-foreground">{detalhe}</p>}
      </div>
    </div>
  );
}

export function Painel({ titulo, acao, children }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">{titulo}</h3>
        {acao}
      </div>
      {children}
    </div>
  );
}

export function Vazio({ texto }: { texto: string }) {
  return <p className="py-6 text-center text-xs text-muted-foreground">{texto}</p>;
}

/** Barra horizontal simples para rankings, sem depender de biblioteca. */
export function Barra({ valor, maximo }: { valor: number; maximo: number }) {
  const pct = maximo > 0 ? Math.max(2, (valor / maximo) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

export const OURO = ["#C9A84C", "#E5C76B", "#A68A3E", "#D4B85A", "#8B7432", "#F0D87E", "#6E5C28"];

export const estiloTooltip = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.5rem",
  fontSize: "12px",
} as const;
