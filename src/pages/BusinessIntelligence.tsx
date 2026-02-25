import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatPercent, formatDate, getMonthRange } from "@/lib/format";
import { Loader2, BarChart3, Users, RefreshCw, DollarSign, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Navigate } from "react-router-dom";

const ASCENSION_LEVELS = [
  { name: "Digitais/Físicos", cats: ["Digitais", "Físicos"] },
  { name: "Mentorias", cats: ["Mentorias"] },
  { name: "Renovações", cats: ["Renovações"] },
];

export default function BusinessIntelligence() {
  const { role } = useAuth();
  const [tab, setTab] = useState("origens");
  const [trafegoPago, setTrafegoPago] = useState("");

  if (role !== "admin") return <Navigate to="/" replace />;

  const { data: receitas, isLoading } = useQuery({
    queryKey: ["bi-receitas"],
    queryFn: async () => { const { data } = await supabase.from("receitas").select("*").order("data", { ascending: false }); return data ?? []; },
  });
  const { data: parcelas } = useQuery({
    queryKey: ["bi-parcelas"],
    queryFn: async () => { const { data } = await supabase.from("parcelas_mentoria").select("*"); return data ?? []; },
  });
  const { data: detalhes } = useQuery({
    queryKey: ["bi-detalhe"],
    queryFn: async () => { const { data } = await supabase.from("parcelas_mentoria_detalhe").select("*"); return data ?? []; },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const allReceitas = receitas ?? [];
  const allParcelas = parcelas ?? [];
  const allDetalhes = detalhes ?? [];
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // ORIGENS
  const origemMap = new Map<string, { qtd: number; receita: number }>();
  allReceitas.forEach(r => {
    const origens = r.origens_venda ?? [];
    const share = origens.length > 0 ? 1 / origens.length : 0;
    origens.forEach(o => { const e = origemMap.get(o) ?? { qtd: 0, receita: 0 }; e.qtd += share; e.receita += (r.valor_bruto ?? 0) * share; origemMap.set(o, e); });
  });
  const totalReceitaOrigens = Array.from(origemMap.values()).reduce((s, o) => s + o.receita, 0);
  const origensData = Array.from(origemMap.entries()).map(([name, v]) => ({ name, qtd: Math.round(v.qtd), receita: v.receita, ticket: v.qtd > 0 ? v.receita / v.qtd : 0, pct: totalReceitaOrigens > 0 ? (v.receita / totalReceitaOrigens) * 100 : 0 })).sort((a, b) => b.receita - a.receita);

  // FUNIL
  const clienteMap = new Map<string, typeof allReceitas>();
  allReceitas.forEach(r => { if (r.cliente_email) { const l = clienteMap.get(r.cliente_email) ?? []; l.push(r); clienteMap.set(r.cliente_email, l); } });
  const funnelData = ASCENSION_LEVELS.map(level => {
    let clientes = 0;
    clienteMap.forEach(compras => { if (compras.some(c => level.cats.includes(c.produto_categoria ?? ""))) clientes++; });
    return { name: level.name, clientes, conversao: 0 };
  });
  for (let i = 0; i < funnelData.length - 1; i++) funnelData[i].conversao = funnelData[i].clientes > 0 ? (funnelData[i + 1].clientes / funnelData[i].clientes) * 100 : 0;

  // RETENÇÃO
  const renovacoesMensais: { mes: string; taxa: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const { start: ms, end: me } = getMonthRange(d.getFullYear(), d.getMonth());
    const label = `${d.getMonth() + 1}/${d.getFullYear()}`;
    const encerradas = allParcelas.filter(p => p.data_fim_prevista && p.data_fim_prevista >= ms && p.data_fim_prevista <= me && !p.is_renovacao);
    const renovadas = allParcelas.filter(p => p.is_renovacao && p.data_inicio >= ms && p.data_inicio <= me);
    renovacoesMensais.push({ mes: label, taxa: encerradas.length > 0 ? (renovadas.length / encerradas.length) * 100 : 0 });
  }
  const taxaMediaGeral = renovacoesMensais.length > 0 ? renovacoesMensais.reduce((s, r) => s + r.taxa, 0) / renovacoesMensais.length : 0;
  const potencialReativacao = allParcelas.filter(p => { if (!p.data_fim_prevista || p.is_renovacao) return false; return Math.floor((now.getTime() - new Date(p.data_fim_prevista).getTime()) / 86400000) > 30; }).filter(p => !allParcelas.some(r => r.is_renovacao && r.cliente_email === p.cliente_email && r.data_inicio > (p.data_fim_prevista ?? "")));

  // CPA
  const investimento = parseFloat(trafegoPago) || 0;
  const cpaPorOrigem = origensData.map(o => ({ ...o, cpa: o.name === "Tráfego Pago" && o.qtd > 0 ? investimento / o.qtd : 0, roi: investimento > 0 && o.name === "Tráfego Pago" ? ((o.receita - investimento) / investimento) * 100 : 0 }));

  // INADIMPLÊNCIA
  const inadimplenciaMensal: { mes: string; taxa: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const { start: ms, end: me } = getMonthRange(d.getFullYear(), d.getMonth());
    const doMes = allDetalhes.filter(det => det.data_vencimento >= ms && det.data_vencimento <= me);
    const emAtraso = doMes.filter(det => det.status === "Atraso" || det.status === "Parcialmente Pago");
    const totalValor = doMes.reduce((s, det) => s + (det.valor_sugerido ?? 0), 0);
    const atrasoValor = emAtraso.reduce((s, det) => s + (det.saldo_parcela ?? 0), 0);
    inadimplenciaMensal.push({ mes: `${d.getMonth() + 1}/${d.getFullYear()}`, taxa: totalValor > 0 ? (atrasoValor / totalValor) * 100 : 0 });
  }
  const alunaAtrasoRecorrente = (() => {
    const map = new Map<string, number>();
    allDetalhes.filter(d => d.status === "Atraso").forEach(d => { const p = allParcelas.find(pa => pa.id === d.parcela_mentoria_id); if (p) map.set(p.cliente_nome, (map.get(p.cliente_nome) ?? 0) + 1); });
    return Array.from(map.entries()).filter(([, c]) => c >= 3).map(([nome, count]) => { const p = allParcelas.find(pa => pa.cliente_nome === nome); return { nome, email: p?.cliente_email ?? "—", ocorrencias: count, tipo: p?.tipo_mentoria ?? "—" }; });
  })();

  // RENOVAÇÕES CONTROL
  const renovacoesControl = (() => {
    const elegiveis: any[] = [];
    const renovados: any[] = [];

    allParcelas.forEach(p => {
      if (p.is_renovacao) {
        const original = allParcelas.find(o => !o.is_renovacao && o.cliente_email === p.cliente_email && o.data_fim_prevista && o.data_fim_prevista < p.data_inicio);
        const diasRenov = original?.data_fim_prevista ? Math.floor((new Date(p.data_inicio).getTime() - new Date(original.data_fim_prevista).getTime()) / 86400000) : null;
        renovados.push({ cliente: p.cliente_nome, email: p.cliente_email, mentoriaOriginal: original?.tipo_mentoria ?? "—", dataFimAnterior: original?.data_fim_prevista ?? "—", status: "Renovado", dataRenovacao: p.data_inicio, valorRenovacao: p.valor_total, diasRenov });
      }
    });

    allParcelas.filter(p => !p.is_renovacao && p.data_fim_prevista).forEach(p => {
      const dias = Math.floor((now.getTime() - new Date(p.data_fim_prevista!).getTime()) / 86400000);
      if (dias > 15) {
        const jaRenovou = allParcelas.some(r => r.is_renovacao && r.cliente_email === p.cliente_email && r.data_inicio > (p.data_fim_prevista ?? ""));
        if (!jaRenovou) {
          elegiveis.push({ cliente: p.cliente_nome, email: p.cliente_email, mentoriaOriginal: p.tipo_mentoria, dataFimAnterior: p.data_fim_prevista, status: "Elegível", dataRenovacao: null, valorRenovacao: null, diasRenov: dias });
        }
      }
    });

    return [...renovados, ...elegiveis];
  })();

  const tempoMedioRenov = (() => {
    const renovados = renovacoesControl.filter(r => r.status === "Renovado" && r.diasRenov !== null);
    return renovados.length > 0 ? Math.round(renovados.reduce((s, r) => s + r.diasRenov, 0) / renovados.length) : 0;
  })();

  const tooltipStyle = { background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 16%)", borderRadius: 8, fontSize: 12 };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-foreground">Business Intelligence</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-secondary/50 border border-border flex-wrap">
          <TabsTrigger value="origens"><BarChart3 className="h-3.5 w-3.5 mr-1.5" />Origens</TabsTrigger>
          <TabsTrigger value="funil"><Users className="h-3.5 w-3.5 mr-1.5" />Funil</TabsTrigger>
          <TabsTrigger value="retencao"><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Retenção</TabsTrigger>
          <TabsTrigger value="cpa"><DollarSign className="h-3.5 w-3.5 mr-1.5" />CPA</TabsTrigger>
          <TabsTrigger value="inadimplencia"><AlertTriangle className="h-3.5 w-3.5 mr-1.5" />Inadimplência</TabsTrigger>
          <TabsTrigger value="renovacoes"><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Renovações</TabsTrigger>
        </TabsList>

        {/* ORIGENS */}
        <TabsContent value="origens">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Receita por Origem</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={origensData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} width={120} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatCurrency(v)]} />
                  <Bar dataKey="receita" fill="#C9A84C" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-secondary/30">
                  {["Origem", "Vendas", "Receita", "Ticket Médio", "% Total"].map(h => <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h !== "Origem" ? "text-right" : "text-left"}`}>{h}</th>)}
                </tr></thead>
                <tbody>{origensData.map((o, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                    <td className="p-3 font-medium">{o.name}</td><td className="p-3 text-right">{o.qtd}</td><td className="p-3 text-right">{formatCurrency(o.receita)}</td><td className="p-3 text-right text-muted-foreground">{formatCurrency(o.ticket)}</td><td className="p-3 text-right text-primary">{formatPercent(o.pct)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* FUNIL */}
        <TabsContent value="funil">
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {funnelData.map((f, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{f.name}</p>
                  <p className="text-2xl font-bold text-foreground">{f.clientes}</p>
                  {i < funnelData.length - 1 && <p className="text-xs text-primary mt-1">→ Conv: {formatPercent(f.conversao)}</p>}
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={funnelData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="clientes" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        {/* RETENÇÃO */}
        <TabsContent value="retencao">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground uppercase">Taxa média de renovação</p><p className="text-2xl font-bold text-primary mt-1">{formatPercent(taxaMediaGeral)}</p></div>
              <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground uppercase">Potenciais reativações</p><p className="text-2xl font-bold text-foreground mt-1">{potencialReativacao.length} alunas</p></div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Taxa de renovação mensal (12 meses)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={renovacoesMensais}>
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} /><YAxis tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`]} />
                  <Line type="monotone" dataKey="taxa" stroke="#C9A84C" strokeWidth={2} dot={{ fill: "#C9A84C", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {potencialReativacao.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="p-4 border-b border-border"><h3 className="text-sm font-medium text-foreground">Potenciais Reativações</h3></div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-secondary/30">{["Nome", "Email", "Tipo", "Fim da Mentoria"].map(h => <th key={h} className="p-3 text-xs font-medium text-muted-foreground text-left">{h}</th>)}</tr></thead>
                  <tbody>{potencialReativacao.slice(0, 20).map((p, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                      <td className="p-3 font-medium">{p.cliente_nome}</td><td className="p-3 text-muted-foreground">{p.cliente_email ?? "—"}</td><td className="p-3 text-muted-foreground">{p.tipo_mentoria}</td><td className="p-3 text-muted-foreground">{p.data_fim_prevista}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* CPA */}
        <TabsContent value="cpa">
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground whitespace-nowrap">Investimento em tráfego pago:</label>
                <Input type="number" placeholder="R$ 0,00" value={trafegoPago} onChange={e => setTrafegoPago(e.target.value)} className="w-48 bg-secondary/50 border-border" />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-secondary/30">{["Origem", "Vendas", "Receita", "CPA", "ROI"].map(h => <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h !== "Origem" ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                <tbody>{cpaPorOrigem.map((o, i) => (
                  <tr key={i} className={`border-b border-border/50 hover:bg-surface-hover transition-colors ${o.name === "Tráfego Pago" ? "bg-primary/5" : ""}`}>
                    <td className="p-3 font-medium">{o.name}</td><td className="p-3 text-right">{o.qtd}</td><td className="p-3 text-right">{formatCurrency(o.receita)}</td>
                    <td className="p-3 text-right text-muted-foreground">{o.cpa > 0 ? formatCurrency(o.cpa) : "—"}</td>
                    <td className={`p-3 text-right font-medium ${o.roi > 0 ? "text-emerald-400" : o.roi < 0 ? "text-destructive" : "text-muted-foreground"}`}>{o.roi !== 0 ? formatPercent(o.roi) : "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* INADIMPLÊNCIA */}
        <TabsContent value="inadimplencia">
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Taxa de inadimplência mensal (12 meses)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={inadimplenciaMensal}>
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} /><YAxis tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`]} />
                  <Line type="monotone" dataKey="taxa" stroke="#ef4444" strokeWidth={2} dot={{ fill: "#ef4444", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {alunaAtrasoRecorrente.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 overflow-hidden">
                <div className="p-4 border-b border-destructive/20"><h3 className="text-sm font-medium text-destructive">Alunas com atraso recorrente (3+ ocorrências)</h3></div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-destructive/20">{["Nome", "Email", "Tipo", "Ocorrências"].map(h => <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h === "Ocorrências" ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                  <tbody>{alunaAtrasoRecorrente.map((a, i) => (
                    <tr key={i} className="border-b border-destructive/10 hover:bg-destructive/5 transition-colors">
                      <td className="p-3 font-medium">{a.nome}</td><td className="p-3 text-muted-foreground">{a.email}</td><td className="p-3 text-muted-foreground">{a.tipo}</td><td className="p-3 text-right text-destructive font-bold">{a.ocorrencias}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* RENOVAÇÕES */}
        <TabsContent value="renovacoes">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase">Tempo médio para renovar</p>
                <p className="text-2xl font-bold text-primary mt-1">{tempoMedioRenov} dias</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase">Renovados</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{renovacoesControl.filter(r => r.status === "Renovado").length}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase">Elegíveis</p>
                <p className="text-2xl font-bold text-yellow-400 mt-1">{renovacoesControl.filter(r => r.status === "Elegível").length}</p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-secondary/30">
                    {["Cliente", "Mentoria Original", "Fim Anterior", "Status", "Data Renovação", "Valor", "Dias p/ Renovar"].map(h => (
                      <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${["Valor", "Dias p/ Renovar"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {renovacoesControl.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">Sem dados</td></tr>}
                    {renovacoesControl.map((r, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                        <td className="p-3">
                          <div><span className="font-medium">{r.cliente}</span></div>
                          <span className="text-xs text-muted-foreground">{r.email}</span>
                        </td>
                        <td className="p-3 text-muted-foreground">{r.mentoriaOriginal}</td>
                        <td className="p-3 text-muted-foreground">{formatDate(r.dataFimAnterior)}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={r.status === "Renovado" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"}>{r.status}</Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{r.dataRenovacao ? formatDate(r.dataRenovacao) : "—"}</td>
                        <td className="p-3 text-right">{r.valorRenovacao ? formatCurrency(r.valorRenovacao) : "—"}</td>
                        <td className="p-3 text-right text-muted-foreground">{r.diasRenov ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
