import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { Loader2, AlertTriangle, Users, CalendarClock, ArrowRight, CreditCard, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MonthNavigator, { getCurrentMonthKey, getDateRange, type DateFilter } from "@/components/MonthNavigator";
import { useState } from "react";

export default function DashboardOperacional() {
  const navigate = useNavigate();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const [dateFilter, setDateFilter] = useState<DateFilter>({ type: "month", key: getCurrentMonthKey() });
  const { start: mesInicio, end: mesFim } = getDateRange(dateFilter);

  const { data: detalhes, isLoading: loadingParcelas } = useQuery({
    queryKey: ["op-parcelas-detalhe", mesInicio, mesFim],
    queryFn: async () => {
      const { data } = await supabase
        .from("parcelas_mentoria_detalhe")
        .select("*, parcelas_mentoria(*)")
        .gte("data_vencimento", mesInicio)
        .lte("data_vencimento", mesFim);
      return data ?? [];
    },
  });

  const { data: contratosAtivos } = useQuery({
    queryKey: ["op-contratos-ativos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("parcelas_mentoria")
        .select("*")
        .or("status_geral.eq.Pendente,status_geral.eq.Parcialmente Pago");
      return data ?? [];
    },
  });

  const { data: vendasRecentes } = useQuery({
    queryKey: ["op-vendas-recentes", mesInicio, mesFim],
    queryFn: async () => {
      const { data } = await supabase
        .from("receitas")
        .select("*")
        .gte("data", mesInicio)
        .lte("data", mesFim)
        .order("data", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  if (loadingParcelas) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const detalhesMes = detalhes ?? [];
  const pagas = detalhesMes.filter(p => p.status === "Quitado");
  const aReceber = detalhesMes.filter(p => p.status === "Pendente" || p.status === "Parcialmente Pago");
  const emAtraso = detalhesMes.filter(p => p.status === "Atraso" || (p.data_vencimento < today && p.status === "Pendente"));

  const valorPagas = pagas.reduce((s, p) => s + (p.valor_real ?? p.valor_sugerido ?? 0), 0);
  const valorAReceber = aReceber.reduce((s, p) => s + ((p.valor_real ?? p.valor_sugerido ?? 0) - (p.valor_pago_parcial ?? 0)), 0);
  const valorAtraso = emAtraso.reduce((s, p) => s + ((p.valor_real ?? p.valor_sugerido ?? 0) - (p.valor_pago_parcial ?? 0)), 0);

  // Next 7 days
  const in7days = new Date(now);
  in7days.setDate(in7days.getDate() + 7);
  const in7str = in7days.toISOString().split("T")[0];
  const proximas7dias = detalhesMes.filter(p =>
    p.data_vencimento >= today && p.data_vencimento <= in7str && p.status !== "Quitado"
  );

  const atrasadas = emAtraso;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <MonthNavigator filter={dateFilter} onChange={setDateFilter} />
      </div>

      {/* KPIs parcelas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Parcelas Pagas</span>
            <DollarSign className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">{pagas.length}</p>
          <p className="text-sm text-primary">{formatCurrency(valorPagas)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">A Receber</span>
            <CreditCard className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">{aReceber.length}</p>
          <p className="text-sm text-muted-foreground">{formatCurrency(valorAReceber)}</p>
        </div>
        <div className={`rounded-xl border p-5 ${emAtraso.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Em Atraso</span>
            <AlertTriangle className={`h-3.5 w-3.5 ${emAtraso.length > 0 ? "text-destructive" : "text-primary"}`} />
          </div>
          <p className={`text-2xl font-bold ${emAtraso.length > 0 ? "text-destructive" : "text-foreground"}`}>{emAtraso.length}</p>
          <p className={`text-sm ${emAtraso.length > 0 ? "text-destructive/70" : "text-muted-foreground"}`}>{formatCurrency(valorAtraso)}</p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Clientes Ativos</span>
            <Users className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-2xl font-bold text-primary">{(contratosAtivos ?? []).length}</p>
          <p className="text-sm text-muted-foreground">Contratos em andamento</p>
        </div>
      </div>

      {/* Alertas de atraso */}
      {atrasadas.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">Parcelas em Atraso</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-auto">
            {atrasadas.slice(0, 10).map((p: any) => {
              const pm = p.parcelas_mentoria as any;
              return (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-foreground font-medium">{pm?.cliente_nome ?? "—"}</span>
                    <span className="text-muted-foreground ml-2 text-xs">Parc. {p.numero_parcela} — venc. {formatDate(p.data_vencimento)}</span>
                  </div>
                  <span className="text-destructive font-medium">{formatCurrency((p.valor_real ?? p.valor_sugerido ?? 0) - (p.valor_pago_parcial ?? 0))}</span>
                </div>
              );
            })}
          </div>
          <button onClick={() => navigate("/parcelas")} className="mt-3 text-xs text-primary hover:underline flex items-center gap-1">Ver todas <ArrowRight className="h-3 w-3" /></button>
        </div>
      )}

      {/* Próximos 7 dias */}
      {proximas7dias.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Vencendo nos próximos 7 dias</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-auto">
            {proximas7dias.map((p: any) => {
              const pm = p.parcelas_mentoria as any;
              return (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-foreground font-medium">{pm?.cliente_nome ?? "—"}</span>
                    <span className="text-muted-foreground ml-2 text-xs">venc. {formatDate(p.data_vencimento)}</span>
                  </div>
                  <span className="text-primary font-medium">{formatCurrency((p.valor_real ?? p.valor_sugerido ?? 0) - (p.valor_pago_parcial ?? 0))}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vendas recentes */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Vendas Recentes</h3>
          <button onClick={() => navigate("/receitas")} className="text-xs text-primary hover:underline flex items-center gap-1">Ver todas <ArrowRight className="h-3 w-3" /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["Data", "Cliente", "Produto", "Valor"].map(h => (
                  <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h === "Valor" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(vendasRecentes ?? []).length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Nenhuma venda no período</td></tr>
              )}
              {(vendasRecentes ?? []).map(r => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="p-3 text-foreground">{formatDate(r.data)}</td>
                  <td className="p-3 text-foreground truncate max-w-[150px]">{r.cliente_nome || "—"}</td>
                  <td className="p-3 text-muted-foreground truncate max-w-[180px]">{r.produto_nome}</td>
                  <td className="p-3 text-right text-primary font-medium">{formatCurrency(r.valor_bruto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
