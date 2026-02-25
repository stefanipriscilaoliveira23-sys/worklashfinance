import { useState } from "react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { formatCurrency, formatPercent, formatDate, getMonthRange, getWeekRange } from "@/lib/format";
import { Loader2, AlertTriangle, TrendingUp, Target, Flame, DollarSign, Users, CalendarClock, ArrowRight, ShoppingCart, RefreshCw, BookOpen, CreditCard, BarChart3, Pencil, PiggyBank } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import MonthNavigator, { getCurrentMonthKey, getDateRange, type DateFilter } from "@/components/MonthNavigator";

const GOLD_COLORS = ["#C9A84C", "#E5C76B", "#A68A3E", "#D4B85A", "#8B7432", "#F0D87E"];

function MetricCard({ label, value, sub, icon: Icon, variant }: { label: string; value: string; sub?: string; icon?: any; variant?: "alert" }) {
  return (
    <div className={`rounded-xl border p-4 transition-colors ${variant === "alert" ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        {Icon && <Icon className={`h-3.5 w-3.5 ${variant === "alert" ? "text-destructive" : "text-primary"}`} />}
      </div>
      <p className={`text-lg font-bold ${variant === "alert" ? "text-destructive" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaInput, setMetaInput] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>({ type: "month", key: getCurrentMonthKey() });

  const { start: periodStart, end: periodEnd } = getDateRange(dateFilter);
  const d = useDashboardData(periodStart, periodEnd);

  const mesInicio = d.mesInicio;
  const mesFim = d.mesFim;

  // Derive month/year from selected period for meta save
  const periodDate = new Date(periodStart + "T00:00:00");

  const saveMeta = useMutation({
    mutationFn: async (valor: number) => {
      const mes = periodDate.getMonth() + 1;
      const ano = periodDate.getFullYear();
      const { data: existing } = await supabase.from("metas").select("id").eq("mes", mes).eq("ano", ano).maybeSingle();
      if (existing) {
        const { error } = await supabase.from("metas").update({ valor_meta: valor }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("metas").insert({ mes, ano, valor_meta: valor });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-mes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Meta atualizada");
      setEditingMeta(false);
    },
    onError: () => toast.error("Erro ao salvar meta"),
  });

  // Extra data for new KPIs
  const now = new Date();


  const { data: allReceitas } = useQuery({
    queryKey: ["dash-receitas-all"],
    queryFn: async () => {
      const { data } = await supabase.from("receitas").select("*").order("data", { ascending: false });
      return data ?? [];
    },
  });

  const { data: allDetalhes } = useQuery({
    queryKey: ["dash-parcelas-detalhe-all"],
    queryFn: async () => {
      const { data } = await supabase.from("parcelas_mentoria_detalhe").select("*, parcelas_mentoria(*)");
      return data ?? [];
    },
  });

  const { data: allContratos } = useQuery({
    queryKey: ["dash-contratos-mentoria"],
    queryFn: async () => {
      const { data } = await supabase.from("parcelas_mentoria").select("*, parcelas_mentoria_detalhe(*)");
      return data ?? [];
    },
  });

  if (d.isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const receitas = allReceitas ?? [];
  const receitasMes = receitas.filter(r => r.data >= mesInicio && r.data <= mesFim);
  const detalhes = allDetalhes ?? [];
  const detalhesMes = detalhes.filter(p => p.data_vencimento >= mesInicio && p.data_vencimento <= mesFim);
  const today = now.toISOString().split("T")[0];

  // A) KPIs principais (receitas + parcelas quitadas)
  const qtdVendas = (d.qtdReceitasMes ?? 0) + (d.qtdParcelasQuitadasMes ?? 0);
  const ticketMedio = qtdVendas > 0 ? d.totalBruto / qtdVendas : 0;

  // B) KPIs de renovação (contratos vendidos no mês, pela data da venda/entrada)
  const contratosMes = (allContratos ?? []).filter(c => {
    const dataVenda = c.entrada_data ?? c.data_inicio;
    return dataVenda >= mesInicio && dataVenda <= mesFim;
  });
  const renovacoesMes = contratosMes.filter(c => c.is_renovacao);
  const valorTotalRenovacoes = renovacoesMes.reduce((s, c) => s + (c.valor_total ?? 0), 0);
  const entradasRenovacoesMes = renovacoesMes.reduce((s, c) => s + (c.entrada_valor ?? 0), 0);
  const recebidoRenovacoesMes = renovacoesMes.reduce((s, c) => {
    const entrada = c.entrada_valor ?? 0;
    const parcRecebidas = ((c as any).parcelas_mentoria_detalhe ?? [])
      .filter((p: any) => p.status === "Quitado" && p.data_pagamento >= mesInicio && p.data_pagamento <= mesFim)
      .reduce((acc: number, p: any) => acc + (p.valor_real ?? p.valor_sugerido ?? 0), 0);
    return s + entrada + parcRecebidas;
  }, 0);
  // C) KPIs de mentoria (contratos não-renovação vendidos no mês)
  const mentoriasMes = contratosMes.filter(c => !c.is_renovacao);
  const valorTotalMentorias = mentoriasMes.reduce((s, c) => s + (c.valor_total ?? 0), 0);
  const entradasMentoriasMes = mentoriasMes.reduce((s, c) => s + (c.entrada_valor ?? 0), 0);
  const recebidoMentoriasMes = mentoriasMes.reduce((s, c) => {
    const entrada = c.entrada_valor ?? 0;
    const parcRecebidas = ((c as any).parcelas_mentoria_detalhe ?? [])
      .filter((p: any) => p.status === "Quitado" && p.data_pagamento >= mesInicio && p.data_pagamento <= mesFim)
      .reduce((acc: number, p: any) => acc + (p.valor_real ?? p.valor_sugerido ?? 0), 0);
    return s + entrada + parcRecebidas;
  }, 0);

  // D) KPIs Digitais
  const digitaisMes = receitasMes.filter(r => r.produto_categoria === "Digitais");
  const qtdDigitais = digitaisMes.length;
  const valorTotalDigitais = digitaisMes.reduce((s, r) => s + (r.valor_bruto ?? 0), 0);
  const recebidoDigitaisMes = digitaisMes.reduce((s, r) => s + (r.valor_liquido ?? r.valor_bruto ?? 0), 0);

  // E) KPIs Produtos Físicos
  const produtosFisicosMes = receitasMes.filter(r => r.produto_categoria === "Físicos");
  const qtdProdutosFisicos = produtosFisicosMes.length;
  const valorTotalProdutosFisicos = produtosFisicosMes.reduce((s, r) => s + (r.valor_bruto ?? 0), 0);
  const recebidoProdutosFisicosMes = produtosFisicosMes.reduce((s, r) => s + (r.valor_liquido ?? r.valor_bruto ?? 0), 0);

  // Percentuais sobre o total geral vendido (contratos + digitais + produtos)
  const totalGeralVendido = valorTotalRenovacoes + valorTotalMentorias + valorTotalDigitais + valorTotalProdutosFisicos;
  const pctRenovacoes = totalGeralVendido > 0 ? (valorTotalRenovacoes / totalGeralVendido) * 100 : 0;
  const pctMentorias = totalGeralVendido > 0 ? (valorTotalMentorias / totalGeralVendido) * 100 : 0;
  const pctDigitais = totalGeralVendido > 0 ? (valorTotalDigitais / totalGeralVendido) * 100 : 0;
  const pctProdutosFisicos = totalGeralVendido > 0 ? (valorTotalProdutosFisicos / totalGeralVendido) * 100 : 0;

  // D) Controle parcelas
  const parcelasPagas = detalhesMes.filter(p => p.status === "Quitado");
  const parcelasAReceber = detalhesMes.filter(p => p.status === "Pendente" || p.status === "Parcialmente Pago");
  const parcelasEmAtraso = detalhesMes.filter(p => p.status === "Atraso" || (p.data_vencimento < today && p.status === "Pendente"));
  const valorAtraso = parcelasEmAtraso.reduce((s, p) => s + ((p.valor_real ?? p.valor_sugerido ?? 0) - (p.valor_pago_parcial ?? 0)), 0);
  const valorAReceber = parcelasAReceber.reduce((s, p) => s + ((p.valor_real ?? p.valor_sugerido ?? 0) - (p.valor_pago_parcial ?? 0)), 0);
  const valorRecebido = parcelasPagas.reduce((s, p) => s + (p.valor_real ?? p.valor_sugerido ?? 0), 0);

  // Valor em risco (alunas com 2+ parcelas em atraso)
  const atrasoMap = new Map<string, number>();
  const allDetalhesFull = detalhes;
  allDetalhesFull.filter(p => p.status === "Atraso" || (p.data_vencimento < today && p.status === "Pendente")).forEach(p => {
    const id = p.parcela_mentoria_id;
    atrasoMap.set(id, (atrasoMap.get(id) ?? 0) + 1);
  });
  const idsRisco = Array.from(atrasoMap.entries()).filter(([, c]) => c >= 2).map(([id]) => id);
  const valorEmRisco = allDetalhesFull.filter(p => idsRisco.includes(p.parcela_mentoria_id) && (p.status === "Atraso" || p.status === "Pendente" || p.status === "Parcialmente Pago")).reduce((s, p) => s + ((p.valor_real ?? p.valor_sugerido ?? 0) - (p.valor_pago_parcial ?? 0)), 0);

  // E) Metas vs Realizado
  const diffMeta = d.totalBruto - d.metaValor;

  // F) Comparação mensal — Fev/2026 em diante
  const comparacaoMensal = [];
  const startMonth = new Date(2026, 1, 1); // Fev 2026
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const tempDate = new Date(startMonth);
  while (tempDate <= currentMonth) {
    const { start: ms, end: me } = getMonthRange(tempDate.getFullYear(), tempDate.getMonth());
    const label = tempDate.toLocaleString("pt-BR", { month: "short", year: "2-digit" });
    const rm = receitas.filter(r => r.data >= ms && r.data <= me);
    const mentorias = rm.filter(r => r.produto_categoria === "Mentorias").reduce((s, r) => s + (r.valor_bruto ?? 0), 0);
    const renovacoes = rm.filter(r => r.produto_categoria === "Renovações").reduce((s, r) => s + (r.valor_bruto ?? 0), 0);
    const parcelasVal = detalhes.filter(p => p.data_vencimento >= ms && p.data_vencimento <= me && p.status === "Quitado").reduce((s, p) => s + (p.valor_real ?? p.valor_sugerido ?? 0), 0);
    const fisicos = rm.filter(r => r.produto_categoria === "Físicos").reduce((s, r) => s + (r.valor_bruto ?? 0), 0);
    const digitais = rm.filter(r => r.produto_categoria === "Digitais").reduce((s, r) => s + (r.valor_bruto ?? 0), 0);
    const total = rm.reduce((s, r) => s + (r.valor_bruto ?? 0), 0) + parcelasVal;
    comparacaoMensal.push({ periodo: label, mentorias, renovacoes, parcelas: parcelasVal, fisicos, digitais, total });
    tempDate.setMonth(tempDate.getMonth() + 1);
  }

  const metaColor = d.metaPercent >= 80 ? "bg-emerald-500" : d.metaPercent >= 50 ? "bg-yellow-500" : "bg-destructive";

  // Faturamento anual (soma de todos os meses da comparação)
  const faturamentoAnual = comparacaoMensal.reduce((s, m) => s + m.total, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <MonthNavigator filter={dateFilter} onChange={setDateFilter} />
      </div>

      {/* LINHA 1 — 5 cards grandes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Faturamento Anual</span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-primary">{formatCurrency(faturamentoAnual)}</p>
          <p className="text-xs text-muted-foreground mt-1">Acumulado 2026</p>
        </div>

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
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setMetaInput(String(d.metaValor));
                  setEditingMeta(true);
                }}
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="Editar meta"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <Target className="h-4 w-4 text-primary" />
            </div>
          </div>
          {editingMeta ? (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Ex: 60000 ou 60.000,00"
                value={metaInput}
                onChange={e => setMetaInput(e.target.value)}
                className="h-8 text-sm bg-secondary/50 border-border"
                autoFocus
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const v = parseFloat(metaInput.replace(/\./g, "").replace(",", "."));
                    if (!isNaN(v) && v > 0) saveMeta.mutate(v);
                  }
                  if (e.key === "Escape") setEditingMeta(false);
                }}
              />
              <button
                onClick={() => {
                  const v = parseFloat(metaInput.replace(/\./g, "").replace(",", "."));
                  if (!isNaN(v) && v > 0) saveMeta.mutate(v);
                }}
                className="text-xs text-primary hover:underline whitespace-nowrap"
              >
                Salvar
              </button>
            </div>
          ) : (
            <p className="text-2xl font-bold text-foreground">{formatCurrency(d.metaValor)}</p>
          )}
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
          <p className="text-xs text-muted-foreground mt-1">Acumulado até hoje: {formatCurrency(d.queimadoHoje)}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lucro líquido projetado</span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <p className={`text-2xl font-bold ${d.lucroProjetado >= 0 ? "text-emerald-400" : "text-destructive"}`}>{formatCurrency(d.lucroProjetado)}</p>
        </div>
      </div>

      {/* A) KPIs PRINCIPAIS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Ticket Médio" value={formatCurrency(ticketMedio)} icon={ShoppingCart} />
        <MetricCard label="Total Vendas" value={String(qtdVendas)} icon={BarChart3} />
        <MetricCard label="Meta Atingida" value={formatPercent(d.metaPercent)} icon={Target} sub={`Falta: ${formatCurrency(d.metaFaltante)}`} />
        <MetricCard label="Diferença Meta" value={formatCurrency(diffMeta)} icon={TrendingUp} variant={diffMeta < 0 ? "alert" : undefined} sub={diffMeta >= 0 ? "Superou" : "Abaixo"} />
      </div>

      {/* LINHA 2 — 4 cards de alerta */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Contas em atraso (empresa + pessoal) */}
        <DashAlertCard
          title="Contas em atraso"
          icon={AlertTriangle}
          mesInicio={mesInicio}
          mesFim={mesFim}
          navigate={navigate}
        />

        {/* Vencendo esta semana (empresa + pessoal) */}
        <DashVencendoCard navigate={navigate} />

        {/* Alunas inadimplentes */}
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-destructive" />
            <span className="text-xs font-medium text-destructive uppercase tracking-wider">Alunas inadimplentes</span>
          </div>
          <p className="text-xl font-bold text-destructive">{d.alunosInadimplentesQtd} alunas</p>
          <p className="text-sm text-destructive/70">{formatCurrency(d.totalInadimplente)}</p>
          <button onClick={() => navigate("/parcelas")} className="mt-3 text-xs text-primary hover:underline flex items-center gap-1">Ver alunas <ArrowRight className="h-3 w-3" /></button>
        </div>

        {/* Cofrinho */}
        <DashCofrinhoCard mesInicio={mesInicio} mesFim={mesFim} navigate={navigate} />
      </div>

      {/* B) KPIs Renovação + C) KPIs Mentoria */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Renovações Vendidas" value={String(renovacoesMes.length)} icon={RefreshCw} sub="Contratos no mês" />
        <MetricCard label="Valor Total Renovações" value={formatCurrency(valorTotalRenovacoes)} icon={RefreshCw} sub="Valor dos contratos" />
        <MetricCard label="Entradas Renovações" value={formatCurrency(entradasRenovacoesMes)} icon={RefreshCw} sub="Recebido no ato da venda" />
        <MetricCard label="Recebido Renovações" value={formatCurrency(recebidoRenovacoesMes)} icon={RefreshCw} sub="Entradas + parcelas pagas" />
        <MetricCard label="% das Vendas" value={formatPercent(pctRenovacoes)} icon={RefreshCw} sub={`${formatPercent(pctRenovacoes)} do valor total vendido`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Mentorias Vendidas" value={String(mentoriasMes.length)} icon={BookOpen} sub="Contratos no mês" />
        <MetricCard label="Valor Total Mentorias" value={formatCurrency(valorTotalMentorias)} icon={BookOpen} sub="Valor dos contratos" />
        <MetricCard label="Entradas Mentorias" value={formatCurrency(entradasMentoriasMes)} icon={BookOpen} sub="Recebido no ato da venda" />
        <MetricCard label="Recebido Mentorias" value={formatCurrency(recebidoMentoriasMes)} icon={BookOpen} sub="Entradas + parcelas pagas" />
        <MetricCard label="% das Vendas" value={formatPercent(pctMentorias)} icon={BookOpen} sub={`${formatPercent(pctMentorias)} do valor total vendido`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Digitais Vendidos" value={String(qtdDigitais)} icon={ShoppingCart} sub="Cursos, ferramentas, apostilas" />
        <MetricCard label="Valor Total Digitais" value={formatCurrency(valorTotalDigitais)} icon={ShoppingCart} sub="Valor bruto das vendas" />
        <MetricCard label="Recebido Digitais" value={formatCurrency(recebidoDigitaisMes)} icon={ShoppingCart} sub="Valor líquido recebido no mês" />
        <MetricCard label="% das Vendas" value={formatPercent(pctDigitais)} icon={ShoppingCart} sub={`${formatPercent(pctDigitais)} do valor total vendido`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Produtos Vendidos" value={String(qtdProdutosFisicos)} icon={BarChart3} sub="Produtos físicos" />
        <MetricCard label="Valor Total Produtos" value={formatCurrency(valorTotalProdutosFisicos)} icon={BarChart3} sub="Valor bruto das vendas" />
        <MetricCard label="Recebido Produtos" value={formatCurrency(recebidoProdutosFisicosMes)} icon={BarChart3} sub="Valor líquido recebido no mês" />
        <MetricCard label="% das Vendas" value={formatPercent(pctProdutosFisicos)} icon={BarChart3} sub={`${formatPercent(pctProdutosFisicos)} do valor total vendido`} />
      </div>

      {/* LINHA 3 — Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Faturamento diário — últimos 30 dias</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={d.faturamentoDiario}>
              <XAxis dataKey="data" tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} tickFormatter={v => v.slice(8)} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 16%)", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "hsl(0 0% 55%)" }} formatter={(v: number) => [formatCurrency(v), "Faturamento"]} />
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
                  {d.composicaoPorCategoria.map((_, i) => <Cell key={i} fill={GOLD_COLORS[i % GOLD_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 16%)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [formatCurrency(v)]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* D) Controle de Parcelas */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Controle de Parcelas</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <MetricCard label="Valor em Atraso" value={formatCurrency(valorAtraso)} variant="alert" icon={AlertTriangle} />
          <MetricCard label="A Receber (mês)" value={formatCurrency(valorAReceber)} icon={CreditCard} />
          <MetricCard label="Recebido (mês)" value={formatCurrency(valorRecebido)} icon={DollarSign} />
          <MetricCard label="Parcelas Pagas" value={String(parcelasPagas.length)} icon={CalendarClock} />
          <MetricCard label="A Receber (qtd)" value={String(parcelasAReceber.length)} icon={CalendarClock} />
          <MetricCard label="Em Atraso (qtd)" value={String(parcelasEmAtraso.length)} variant={parcelasEmAtraso.length > 0 ? "alert" : undefined} icon={AlertTriangle} />
          <MetricCard label="Inadimplência" value={formatPercent(d.taxaInadimplencia)} variant={d.taxaInadimplencia > 20 ? "alert" : undefined} icon={AlertTriangle} />
          <MetricCard label="Valor em Risco" value={formatCurrency(valorEmRisco)} variant={valorEmRisco > 0 ? "alert" : undefined} icon={AlertTriangle} />
        </div>
      </div>

      {/* LINHA 4 — Saldo futuro */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard label="Saldo total futuro" value={formatCurrency(d.saldoTotalFuturo)} icon={TrendingUp} sub="Parcelas futuras pendentes" />
      </div>

      {/* F) Comparação Mensal */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">Comparação Mensal da Receita</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["Período", "Mentorias", "Renovações", "Parcelas", "Produtos Físicos", "Produtos Digitais", "Total"].map(h => (
                  <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h !== "Período" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparacaoMensal.map((m, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                  <td className="p-3 font-medium text-foreground capitalize">{m.periodo}</td>
                  <td className="p-3 text-right">{formatCurrency(m.mentorias)}</td>
                  <td className="p-3 text-right">{formatCurrency(m.renovacoes)}</td>
                  <td className="p-3 text-right">{formatCurrency(m.parcelas)}</td>
                  <td className="p-3 text-right">{formatCurrency(m.fisicos)}</td>
                  <td className="p-3 text-right">{formatCurrency(m.digitais)}</td>
                  <td className="p-3 text-right text-primary font-bold">{formatCurrency(m.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* LINHA 5 — Últimas 10 entradas (receitas + parcelas) */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Últimas 10 entradas</h3>
          <button onClick={() => navigate("/receitas")} className="text-xs text-primary hover:underline flex items-center gap-1">Ver todas <ArrowRight className="h-3 w-3" /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["Data", "Descrição", "Categoria", "Origem", "Cliente", "Valor"].map(h => (
                  <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h === "Valor" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Merge receitas + parcelas quitadas, sorted by date desc, take 10
                const parcelasRecentes = detalhes
                  .filter(p => p.status === "Quitado")
                  .map((p: any) => ({
                    id: `p-${p.id}`,
                    data: p.data_pagamento ?? p.data_vencimento,
                    descricao: `Parcela ${p.numero_parcela}/${(p.parcelas_mentoria as any)?.quant_parcelas} — ${(p.parcelas_mentoria as any)?.cliente_nome}`,
                    categoria: (p.parcelas_mentoria as any)?.tipo_mentoria,
                    origem: "Parcela",
                    cliente: (p.parcelas_mentoria as any)?.cliente_nome,
                    valor: p.valor_real ?? p.valor_sugerido ?? 0,
                    isParcela: true,
                  }));
                const receitasRecentes = d.ultimasReceitas.map(r => ({
                  id: r.id,
                  data: r.data,
                  descricao: r.produto_nome,
                  categoria: r.produto_categoria,
                  origem: r.plataforma,
                  cliente: r.cliente_nome,
                  valor: r.valor_bruto,
                  isParcela: false,
                }));
                const merged = [...receitasRecentes, ...parcelasRecentes]
                  .sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""))
                  .slice(0, 10);

                if (merged.length === 0) return <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhuma entrada registrada</td></tr>;

                return merged.map(r => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                    <td className="p-3 text-foreground">{formatDate(r.data)}</td>
                    <td className="p-3 text-foreground truncate max-w-[180px]">
                      <div className="flex items-center gap-1.5">
                        {r.isParcela && <span className="px-1.5 py-0.5 text-[9px] rounded bg-primary/10 text-primary font-medium shrink-0">Parcela</span>}
                        <span className="truncate">{r.descricao}</span>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{r.categoria || "—"}</td>
                    <td className="p-3 text-muted-foreground">{r.origem}</td>
                    <td className="p-3 text-foreground truncate max-w-[120px]">{r.cliente || "—"}</td>
                    <td className="p-3 text-right text-primary">{formatCurrency(r.valor)}</td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const PRIO_ORDER: Record<string, number> = { "Alta": 0, "Média": 1, "Baixa": 2 };
const PRIO_STYLE: Record<string, string> = {
  "Alta": "bg-destructive/10 text-destructive",
  "Média": "bg-yellow-500/10 text-yellow-400",
  "Baixa": "bg-secondary text-muted-foreground",
};

function sortByPriority(items: any[]) {
  return [...items].sort((a, b) => (PRIO_ORDER[a.prioridade] ?? 1) - (PRIO_ORDER[b.prioridade] ?? 1));
}

function DashAlertCard({ title, icon: Icon, mesInicio, mesFim, navigate }: any) {
  const { data: despEmp } = useQuery({
    queryKey: ["dash-desp-emp-atraso", mesInicio, mesFim],
    queryFn: async () => {
      const { data } = await supabase.from("despesas_empresa").select("*").eq("status", "Em Atraso").gte("data_vencimento", mesInicio).lte("data_vencimento", mesFim);
      return data ?? [];
    },
  });
  const { data: despPes } = useQuery({
    queryKey: ["dash-desp-pes-atraso", mesInicio, mesFim],
    queryFn: async () => {
      const { data } = await supabase.from("despesas_pessoal").select("*").eq("status", "Em Atraso").gte("data_vencimento", mesInicio).lte("data_vencimento", mesFim);
      return data ?? [];
    },
  });

  const all = sortByPriority([
    ...(despEmp ?? []).map((d: any) => ({ ...d, _tipo: "Empresa" })),
    ...(despPes ?? []).map((d: any) => ({ ...d, _tipo: "Pessoal" })),
  ]);
  const total = all.reduce((s: number, d: any) => s + (d.saldo_pendente ?? 0), 0);

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-destructive" />
        <span className="text-xs font-medium text-destructive uppercase tracking-wider">Contas em atraso</span>
      </div>
      <p className="text-xl font-bold text-destructive">{all.length} contas</p>
      <p className="text-sm text-destructive/70">{formatCurrency(total)}</p>
      <div className="space-y-1 mt-2 max-h-24 overflow-auto">
        {all.slice(0, 5).map((d: any, i: number) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${PRIO_STYLE[d.prioridade] ?? ""}`}>{d.prioridade}</span>
            <span className="text-muted-foreground text-[9px]">{d._tipo}</span>
            <span className="text-foreground truncate flex-1">{d.descricao}</span>
            <span className="text-destructive font-medium shrink-0">{formatCurrency(d.saldo_pendente)}</span>
          </div>
        ))}
      </div>
      <button onClick={() => navigate("/despesas-empresa")} className="mt-3 text-xs text-primary hover:underline flex items-center gap-1">Ver todas <ArrowRight className="h-3 w-3" /></button>
    </div>
  );
}

function DashVencendoCard({ navigate }: { navigate: (path: string) => void }) {
  const { start: semInicio, end: semFim } = getWeekRange();
  const { data: despEmp } = useQuery({
    queryKey: ["dash-desp-emp-semana", semInicio, semFim],
    queryFn: async () => {
      const { data } = await supabase.from("despesas_empresa").select("*").gte("data_vencimento", semInicio).lte("data_vencimento", semFim).neq("status", "Pago");
      return data ?? [];
    },
  });
  const { data: despPes } = useQuery({
    queryKey: ["dash-desp-pes-semana", semInicio, semFim],
    queryFn: async () => {
      const { data } = await supabase.from("despesas_pessoal").select("*").gte("data_vencimento", semInicio).lte("data_vencimento", semFim).neq("status", "Pago");
      return data ?? [];
    },
  });

  const all = sortByPriority([
    ...(despEmp ?? []).map((d: any) => ({ ...d, _tipo: "Empresa" })),
    ...(despPes ?? []).map((d: any) => ({ ...d, _tipo: "Pessoal" })),
  ]);
  const total = all.reduce((s: number, d: any) => s + (d.saldo_pendente ?? 0), 0);

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
      <div className="flex items-center gap-2 mb-2">
        <CalendarClock className="h-4 w-4 text-destructive" />
        <span className="text-xs font-medium text-destructive uppercase tracking-wider">Vencendo esta semana</span>
      </div>
      <p className="text-xl font-bold text-destructive">{formatCurrency(total)}</p>
      <p className="text-sm text-destructive/70">{all.length} contas</p>
      <div className="space-y-1 mt-2 max-h-24 overflow-auto">
        {all.slice(0, 5).map((d: any, i: number) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${PRIO_STYLE[d.prioridade] ?? ""}`}>{d.prioridade}</span>
            <span className="text-muted-foreground text-[9px]">{d._tipo}</span>
            <span className="text-foreground truncate flex-1">{d.descricao}</span>
            <span className="text-destructive font-medium shrink-0">{formatCurrency(d.saldo_pendente)}</span>
          </div>
        ))}
        {all.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma</p>}
      </div>
      <button onClick={() => navigate("/despesas-empresa")} className="mt-3 text-xs text-primary hover:underline flex items-center gap-1">Ver todas <ArrowRight className="h-3 w-3" /></button>
    </div>
  );
}

function DashCofrinhoCard({ mesInicio, mesFim, navigate }: { mesInicio: string; mesFim: string; navigate: (path: string) => void }) {
  const { data: cofrinhoAll } = useQuery({
    queryKey: ["dash-cofrinho-all"],
    queryFn: async () => {
      const { data } = await supabase.from("cofrinho").select("*");
      return data ?? [];
    },
  });
  const { data: despEmp } = useQuery({
    queryKey: ["dash-desp-emp-prio", mesInicio, mesFim],
    queryFn: async () => {
      const { data } = await supabase.from("despesas_empresa").select("*").gte("data_vencimento", mesInicio).lte("data_vencimento", mesFim).neq("status", "Pago");
      return data ?? [];
    },
  });
  const { data: despPes } = useQuery({
    queryKey: ["dash-desp-pes-prio", mesInicio, mesFim],
    queryFn: async () => {
      const { data } = await supabase.from("despesas_pessoal").select("*").gte("data_vencimento", mesInicio).lte("data_vencimento", mesFim).neq("status", "Pago");
      return data ?? [];
    },
  });

  const saldo = (cofrinhoAll ?? []).reduce((s: number, e: any) => s + (e.valor ?? 0), 0);
  const prioAlta = [...(despEmp ?? []), ...(despPes ?? [])].filter((d: any) => d.prioridade === "Alta");
  const totalPrio = prioAlta.reduce((s: number, d: any) => s + (d.saldo_pendente ?? d.valor_original ?? 0), 0);
  const pct = totalPrio > 0 ? Math.min(100, (saldo / totalPrio) * 100) : 100;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
      <div className="flex items-center gap-2 mb-2">
        <PiggyBank className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-primary uppercase tracking-wider">Cofrinho</span>
      </div>
      <p className="text-xl font-bold text-primary">{formatCurrency(saldo)}</p>
      <p className="text-xs text-muted-foreground mt-1">Prioridade: {formatCurrency(totalPrio)}</p>
      <div className="mt-2">
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-yellow-500" : "bg-destructive"}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">{pct >= 100 ? "✅ Cobre as prioridades" : `${pct.toFixed(0)}% das prioridades`}</p>
      </div>
      <button onClick={() => navigate("/cofrinho")} className="mt-3 text-xs text-primary hover:underline flex items-center gap-1">Ver cofrinho <ArrowRight className="h-3 w-3" /></button>
    </div>
  );
}
