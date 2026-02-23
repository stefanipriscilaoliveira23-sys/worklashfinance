import { useDashboardData } from "@/hooks/useDashboardData";
import { formatCurrency, formatPercent, formatDate } from "@/lib/format";
import { Loader2, AlertTriangle, TrendingUp, Target, Flame, DollarSign, Users, CalendarClock, ArrowRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useNavigate } from "react-router-dom";

const GOLD_COLORS = ["#C9A84C", "#E5C76B", "#A68A3E", "#D4B85A", "#8B7432", "#F0D87E"];

function MetricCard({ label, value, sub, icon: Icon, variant }: { label: string; value: string; sub?: string; icon?: any; variant?: "alert" }) {
  return (
    <div className={`rounded-xl border p-5 transition-colors ${variant === "alert" ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        {Icon && <Icon className={`h-4 w-4 ${variant === "alert" ? "text-destructive" : "text-primary"}`} />}
      </div>
      <p className={`text-2xl font-bold ${variant === "alert" ? "text-destructive" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const d = useDashboardData();
  const navigate = useNavigate();

  if (d.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const metaColor = d.metaPercent >= 80 ? "bg-emerald-500" : d.metaPercent >= 50 ? "bg-yellow-500" : "bg-destructive";

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-foreground">Dashboard</h1>

      {/* LINHA 1 — 4 cards grandes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Faturado este mês</span>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(d.totalBruto)}</p>
          <p className="text-sm text-primary mt-1">Líquido: {formatCurrency(d.totalLiquido)}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Meta do mês</span>
            <Target className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(d.metaValor)}</p>
          <div className="mt-2">
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div className={`h-full ${metaColor} rounded-full transition-all`} style={{ width: `${Math.min(d.metaPercent, 100)}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-muted-foreground">{formatPercent(d.metaPercent)} atingido</span>
              <span className="text-xs text-muted-foreground">Falta: {formatCurrency(d.metaFaltante)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Custo diário</span>
            <Flame className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(d.custoDiario)}</p>
          <p className="text-xs text-muted-foreground mt-1">Você já queimou {formatCurrency(d.queimadoHoje)} hoje</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lucro líquido projetado</span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <p className={`text-2xl font-bold ${d.lucroProjetado >= 0 ? "text-emerald-400" : "text-destructive"}`}>
            {formatCurrency(d.lucroProjetado)}
          </p>
        </div>
      </div>

      {/* LINHA 2 — 3 cards de alerta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-xs font-medium text-destructive uppercase tracking-wider">Contas em atraso</span>
          </div>
          <p className="text-xl font-bold text-destructive">{d.contasAtrasoQtd} contas</p>
          <p className="text-sm text-destructive/70">{formatCurrency(d.totalAtraso)}</p>
          <button onClick={() => navigate("/despesas-empresa")} className="mt-3 text-xs text-primary hover:underline flex items-center gap-1">
            Ver todas <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="h-4 w-4 text-destructive" />
            <span className="text-xs font-medium text-destructive uppercase tracking-wider">Vencendo esta semana</span>
          </div>
          <div className="space-y-1 max-h-20 overflow-auto">
            {d.vencendoSemana.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma</p>}
            {d.vencendoSemana.slice(0, 3).map((v, i) => (
              <p key={i} className="text-xs text-foreground truncate">
                {v.descricao} — {formatCurrency(v.saldo_pendente)} — {formatDate(v.data_vencimento)}
              </p>
            ))}
          </div>
          <button onClick={() => navigate("/despesas-empresa")} className="mt-3 text-xs text-primary hover:underline flex items-center gap-1">
            Ver todas <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-destructive" />
            <span className="text-xs font-medium text-destructive uppercase tracking-wider">Alunas inadimplentes</span>
          </div>
          <p className="text-xl font-bold text-destructive">{d.alunosInadimplentesQtd} alunas</p>
          <p className="text-sm text-destructive/70">{formatCurrency(d.totalInadimplente)}</p>
          <button onClick={() => navigate("/parcelas")} className="mt-3 text-xs text-primary hover:underline flex items-center gap-1">
            Ver alunas <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* LINHA 3 — Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Faturamento diário — últimos 30 dias</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={d.faturamentoDiario}>
              <XAxis dataKey="data" tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} tickFormatter={(v) => v.slice(8)} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 16%)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "hsl(0 0% 55%)" }}
                formatter={(v: number) => [formatCurrency(v), "Faturamento"]}
              />
              <Line type="monotone" dataKey="valor" stroke="#C9A84C" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Composição por categoria</h3>
          {d.composicaoPorCategoria.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">Sem dados no mês</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={d.composicaoPorCategoria} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45}>
                  {d.composicaoPorCategoria.map((_, i) => (
                    <Cell key={i} fill={GOLD_COLORS[i % GOLD_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 16%)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [formatCurrency(v)]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* LINHA 4 — 6 cards de métricas mentoria */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard label="Previstas no mês" value={formatCurrency(d.previstaMes)} icon={CalendarClock} />
        <MetricCard label="Recebidas no mês" value={formatCurrency(d.recebidaMes)} icon={DollarSign} />
        <MetricCard label="Saldo a receber (mês)" value={formatCurrency(d.saldoReceberMes)} icon={Target} />
        <MetricCard label="Saldo total futuro" value={formatCurrency(d.saldoTotalFuturo)} icon={TrendingUp} />
        <MetricCard label="Taxa de renovação" value={formatPercent(d.taxaRenovacao)} icon={Users} />
        <MetricCard
          label="Taxa inadimplência"
          value={formatPercent(d.taxaInadimplencia)}
          icon={AlertTriangle}
          variant={d.taxaInadimplencia > 20 ? "alert" : undefined}
        />
      </div>

      {/* LINHA 5 — Últimas 10 receitas */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Últimas 10 receitas</h3>
          <button onClick={() => navigate("/receitas")} className="text-xs text-primary hover:underline flex items-center gap-1">
            Ver todas <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Data</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Produto</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Categoria</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Plataforma</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Cliente</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground">Bruto</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground">Líquido</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Origens</th>
              </tr>
            </thead>
            <tbody>
              {d.ultimasReceitas.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhuma receita registrada</td></tr>
              )}
              {d.ultimasReceitas.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                  <td className="p-3 text-foreground">{formatDate(r.data)}</td>
                  <td className="p-3 text-foreground truncate max-w-[150px]">{r.produto_nome}</td>
                  <td className="p-3 text-muted-foreground">{r.produto_categoria || "—"}</td>
                  <td className="p-3 text-muted-foreground">{r.plataforma}</td>
                  <td className="p-3 text-foreground truncate max-w-[120px]">{r.cliente_nome || "—"}</td>
                  <td className="p-3 text-right text-foreground">{formatCurrency(r.valor_bruto)}</td>
                  <td className="p-3 text-right text-primary">{formatCurrency(r.valor_liquido)}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {(r.origens_venda ?? []).map((o, i) => (
                        <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary">{o}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
