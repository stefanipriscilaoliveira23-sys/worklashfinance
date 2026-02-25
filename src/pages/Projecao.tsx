import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatPercent, getMonthRange, getDaysInMonth } from "@/lib/format";
import { Loader2, TrendingUp, Target, Calculator, BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const PRO_LABORE_DEFAULT = 30000; // kept for reference but no longer added separately

export default function Projecao() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth());
  const [metaManual, setMetaManual] = useState("");

  const { start, end } = getMonthRange(ano, mes);
  const diasMes = getDaysInMonth(ano, mes);
  const hoje = new Date();
  const diaAtual = ano === hoje.getFullYear() && mes === hoje.getMonth() ? hoje.getDate() : diasMes;
  const diasPassados = Math.max(diaAtual, 1);
  const diasRestantes = Math.max(diasMes - diasPassados, 0);

  const { data: configProLabore } = useQuery({
    queryKey: ["config-prolabore"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes").select("valor").eq("chave", "pro_labore").single();
      return data?.valor ? parseFloat(data.valor) : PRO_LABORE_DEFAULT;
    },
  });
  const proLabore = configProLabore ?? PRO_LABORE_DEFAULT;

  const { data: receitas, isLoading: loadRec } = useQuery({
    queryKey: ["receitas-projecao", start, end],
    queryFn: async () => {
      const { data } = await supabase.from("receitas").select("*").gte("data", start).lte("data", end).order("data");
      return data ?? [];
    },
  });

  const { data: parcelasQuitadas } = useQuery({
    queryKey: ["parcelas-quitadas-projecao", start, end],
    queryFn: async () => {
      const { data } = await supabase.from("parcelas_mentoria_detalhe").select("*").gte("data_pagamento", start).lte("data_pagamento", end).eq("status", "Quitado");
      return data ?? [];
    },
  });

  const { data: despesas } = useQuery({
    queryKey: ["despesas-empresa-projecao", start, end],
    queryFn: async () => {
      const { data } = await supabase.from("despesas_empresa").select("*");
      return data ?? [];
    },
  });

  const { data: meta } = useQuery({
    queryKey: ["meta-projecao", ano, mes],
    queryFn: async () => {
      const { data } = await supabase.from("metas").select("*").eq("ano", ano).eq("mes", mes + 1).maybeSingle();
      return data;
    },
  });

  const { data: produtos } = useQuery({
    queryKey: ["produtos-catalogo-proj"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos_catalogo").select("*").eq("ativo", true);
      return data ?? [];
    },
  });

  if (loadRec) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const allReceitas = receitas ?? [];
  const allParcelas = parcelasQuitadas ?? [];
  
  // Revenue includes both receitas and parcelas quitadas
  const faturadoReceitas = allReceitas.reduce((s, r) => s + (r.valor_bruto ?? 0), 0);
  const faturadoParcelas = allParcelas.reduce((s, p) => s + (p.valor_real ?? p.valor_sugerido ?? 0), 0);
  const faturadoAteHoje = faturadoReceitas + faturadoParcelas;
  const mediaDiaria = diasPassados > 0 ? faturadoAteHoje / diasPassados : 0;

  const despesasMes = (despesas ?? []).filter(d => d.data_vencimento && d.data_vencimento >= start && d.data_vencimento <= end);
  const totalDespesas = despesasMes.reduce((s, d) => s + (d.valor_original ?? 0), 0);
  const despesasPagas = despesasMes.reduce((s, d) => s + (d.valor_pago_total ?? 0), 0);

  const cenarios = [
    { nome: "Conservador", fator: 0.8, cor: "text-destructive" },
    { nome: "Ritmo Atual", fator: 1.0, cor: "text-primary" },
    { nome: "Otimista", fator: 1.3, cor: "text-emerald-400" },
  ].map(c => {
    const faturamento = mediaDiaria * c.fator * diasMes;
    const lucro = faturamento - totalDespesas;
    const margem = faturamento > 0 ? (lucro / faturamento) * 100 : 0;
    return { ...c, faturamento, totalDespesas, lucro, margem };
  });

  // META SIMULATOR
  const metaValor = metaManual ? parseFloat(metaManual) : (meta?.valor_meta ?? 0);
  const falta = Math.max(metaValor - faturadoAteHoje, 0);
  const metaDiaria = diasRestantes > 0 ? falta / diasRestantes : 0;
  const noRitmo = mediaDiaria >= metaDiaria;

  // GRÁFICO TRIPLO — combine receitas + parcelas by day
  const chartData: { dia: number; real?: number; projecao?: number; meta?: number }[] = [];
  let acumReal = 0;
  const receitasPorDia = new Map<number, number>();
  allReceitas.forEach(r => {
    const dia = parseInt(r.data.split("-")[2]);
    receitasPorDia.set(dia, (receitasPorDia.get(dia) ?? 0) + (r.valor_bruto ?? 0));
  });
  allParcelas.forEach(p => {
    if (!p.data_pagamento) return;
    const dia = parseInt(p.data_pagamento.split("-")[2]);
    receitasPorDia.set(dia, (receitasPorDia.get(dia) ?? 0) + (p.valor_real ?? p.valor_sugerido ?? 0));
  });

  for (let d = 1; d <= diasMes; d++) {
    const entry: typeof chartData[0] = { dia: d };
    if (d <= diasPassados) {
      acumReal += receitasPorDia.get(d) ?? 0;
      entry.real = acumReal;
    }
    if (d > diasPassados) {
      entry.projecao = acumReal + mediaDiaria * (d - diasPassados);
    } else {
      entry.projecao = acumReal;
    }
    entry.meta = metaValor > 0 ? (metaValor / diasMes) * d : undefined;
    chartData.push(entry);
  }

  // MARGEM INCREMENTAL
  const margemIncremental = (produtos ?? []).map(p => {
    const vendasMes = allReceitas.filter(r => r.produto_id === p.id || r.produto_nome === p.nome);
    const receitaAtual = vendasMes.reduce((s, r) => s + (r.valor_liquido ?? 0), 0);
    const custoPerc = p.custo_direto_percentual ?? 0;
    const custoAtual = receitaAtual * (custoPerc / 100);
    const margemAtual = receitaAtual - custoAtual;
    const receitaDobrada = receitaAtual * 2;
    const custoDobrado = receitaDobrada * (custoPerc / 100);
    const fixos = p.custo_direto_fixo_mensal ?? 0;
    const margemDobrada = receitaDobrada - custoDobrado - fixos;
    const ganhoIncremental = margemDobrada - margemAtual;
    return { nome: p.nome, receitaAtual, margemAtual, margemDobrada, ganhoIncremental };
  }).filter(m => m.receitaAtual > 0).sort((a, b) => b.ganhoIncremental - a.ganhoIncremental);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Projeção</h1>
        <div className="flex gap-2">
          <Select value={String(mes)} onValueChange={v => setMes(parseInt(v))}>
            <SelectTrigger className="w-[150px] bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
            <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={v => setAno(parseInt(v))}>
            <SelectTrigger className="w-[100px] bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
            <SelectContent>{[2025, 2026, 2027].map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* BLOCO 1 — 3 CENÁRIOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cenarios.map(c => (
          <div key={c.nome} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className={`h-4 w-4 ${c.cor}`} />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{c.nome}</span>
            </div>
            <p className={`text-2xl font-bold ${c.cor}`}>{formatCurrency(c.faturamento)}</p>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <p>Despesas: {formatCurrency(c.totalDespesas)}</p>
              <p className={c.lucro >= 0 ? "text-emerald-400" : "text-destructive"}>
                Lucro: {formatCurrency(c.lucro)} ({formatPercent(c.margem)})
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* BLOCO 2 — SIMULADOR */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Simulador de Meta</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Quero faturar</label>
            <Input
              type="number" placeholder={String(meta?.valor_meta ?? 0)}
              value={metaManual} onChange={e => setMetaManual(e.target.value)}
              className="bg-secondary/50 border-border"
            />
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">Faturado até hoje</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(faturadoAteHoje)}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">Falta</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(falta)}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">Meta diária necessária</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(metaDiaria)}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">Status</p>
            <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${noRitmo ? "bg-emerald-500/10 text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
              {noRitmo ? "No ritmo ✓" : "Abaixo do ritmo ✗"}
            </span>
          </div>
        </div>
      </div>

      {/* BLOCO 3 — GRÁFICO TRIPLO */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Faturamento Acumulado vs Meta</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 16%)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [formatCurrency(v)]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="real" stroke="#C9A84C" strokeWidth={2.5} dot={false} name="Real" connectNulls={false} />
            <Line type="monotone" dataKey="projecao" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="0" dot={false} name="Projeção" connectNulls={false} />
            <Line type="monotone" dataKey="meta" stroke="hsl(0 0% 70%)" strokeWidth={1.5} strokeDasharray="6 4" dot={false} name="Meta linear" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* BLOCO 4 — MARGEM INCREMENTAL */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">Margem Incremental por Produto</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Simulação: se dobrar as vendas, quanto de margem a mais?</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["Produto", "Receita Atual", "Margem Atual", "Margem c/ 2x Vendas", "Ganho Incremental"].map(h => (
                  <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h !== "Produto" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {margemIncremental.length === 0 && <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">Sem dados</td></tr>}
              {margemIncremental.map((m, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                  <td className="p-3 font-medium">{m.nome}</td>
                  <td className="p-3 text-right">{formatCurrency(m.receitaAtual)}</td>
                  <td className="p-3 text-right">{formatCurrency(m.margemAtual)}</td>
                  <td className="p-3 text-right">{formatCurrency(m.margemDobrada)}</td>
                  <td className="p-3 text-right text-emerald-400 font-medium">+{formatCurrency(m.ganhoIncremental)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
