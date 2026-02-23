import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatPercent, getMonthRange } from "@/lib/format";
import { Loader2, Package, TrendingUp, Users, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

const GOLD_COLORS = ["#C9A84C", "#E5C76B", "#A68A3E", "#D4B85A", "#8B7432", "#F0D87E"];
const ENTRY_CATEGORIES = ["Apostila", "Ferramenta", "Produto Físico"];

export default function ProdutosMargem() {
  const [tab, setTab] = useState("catalogo");
  const now = new Date();
  const { start, end } = getMonthRange(now.getFullYear(), now.getMonth());

  const { data: produtos, isLoading: loadProd } = useQuery({
    queryKey: ["produtos-catalogo"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos_catalogo").select("*").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: receitas, isLoading: loadRec } = useQuery({
    queryKey: ["receitas-all"],
    queryFn: async () => {
      const { data } = await supabase.from("receitas").select("*").order("data", { ascending: false });
      return data ?? [];
    },
  });

  const { data: estoque } = useQuery({
    queryKey: ["estoque-cmv"],
    queryFn: async () => {
      const { data } = await supabase.from("estoque_cmv").select("*").order("data_compra", { ascending: false });
      return data ?? [];
    },
  });

  const isLoading = loadProd || loadRec;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const allReceitas = receitas ?? [];
  const receitasMes = allReceitas.filter(r => r.data >= start && r.data <= end);

  // CATÁLOGO: preço médio e margem
  const catalogData = (produtos ?? []).map(p => {
    const vendas = allReceitas.filter(r => r.produto_id === p.id || r.produto_nome === p.nome);
    const totalBruto = vendas.reduce((s, r) => s + (r.valor_bruto ?? 0), 0);
    const precoMedio = vendas.length > 0 ? totalBruto / vendas.length : 0;
    const custoPerc = p.custo_direto_percentual ?? 0;
    const margemPerc = precoMedio > 0 ? 100 - custoPerc : 0;
    return { ...p, vendas: vendas.length, precoMedio, margemPerc, totalBruto };
  });

  // DESEMPENHO DO MÊS
  const desempenhoMap = new Map<string, { nome: string; unidades: number; bruto: number; taxaTotal: number; liquido: number; custoPerc: number }>();
  receitasMes.forEach(r => {
    const key = r.produto_nome;
    const existing = desempenhoMap.get(key) ?? { nome: key, unidades: 0, bruto: 0, taxaTotal: 0, liquido: 0, custoPerc: 0 };
    existing.unidades += 1;
    existing.bruto += r.valor_bruto ?? 0;
    existing.taxaTotal += r.taxa_plataforma_valor ?? 0;
    existing.liquido += r.valor_liquido ?? 0;
    const prod = (produtos ?? []).find(p => p.id === r.produto_id || p.nome === r.produto_nome);
    if (prod) existing.custoPerc = prod.custo_direto_percentual ?? 0;
    desempenhoMap.set(key, existing);
  });
  const desempenho = Array.from(desempenhoMap.values()).map(d => {
    const custoTotal = d.liquido * (d.custoPerc / 100);
    const margemR = d.liquido - custoTotal;
    const margemP = d.liquido > 0 ? (margemR / d.liquido) * 100 : 0;
    return { ...d, custoTotal, margemR, margemP, taxaMedia: d.unidades > 0 ? d.taxaTotal / d.unidades : 0 };
  }).sort((a, b) => b.margemR - a.margemR);

  // LTV & FUNIL DE ASCENSÃO
  const clienteMap = new Map<string, typeof allReceitas>();
  allReceitas.forEach(r => {
    if (!r.cliente_email) return;
    const list = clienteMap.get(r.cliente_email) ?? [];
    list.push(r);
    clienteMap.set(r.cliente_email, list);
  });

  const entryProducts = (produtos ?? []).filter(p => ENTRY_CATEGORIES.includes(p.categoria));
  const ltvData = entryProducts.map(ep => {
    let totalClientes = 0;
    let ascendidos = 0;
    let receitaTotal = 0;
    let tempoTotalDias = 0;
    let tempoCount = 0;

    clienteMap.forEach((compras, _email) => {
      const entryCompra = compras.find(c => c.produto_nome === ep.nome || c.produto_id === ep.id);
      if (!entryCompra) return;
      totalClientes++;
      const receitaCliente = compras.reduce((s, c) => s + (c.valor_bruto ?? 0), 0);
      receitaTotal += receitaCliente;

      const comprasPosteriores = compras.filter(c =>
        c.id !== entryCompra.id && c.data > entryCompra.data &&
        !ENTRY_CATEGORIES.includes(c.produto_categoria ?? "")
      );
      if (comprasPosteriores.length > 0) {
        ascendidos++;
        const firstAsc = comprasPosteriores.sort((a, b) => a.data.localeCompare(b.data))[0];
        const dias = Math.floor((new Date(firstAsc.data).getTime() - new Date(entryCompra.data).getTime()) / 86400000);
        tempoTotalDias += dias;
        tempoCount++;
      }
    });

    return {
      nome: ep.nome,
      categoria: ep.categoria,
      totalClientes,
      ascendidos,
      taxaConversao: totalClientes > 0 ? (ascendidos / totalClientes) * 100 : 0,
      receitaTotal,
      ltvMedio: totalClientes > 0 ? receitaTotal / totalClientes : 0,
      tempoMedioDias: tempoCount > 0 ? Math.round(tempoTotalDias / tempoCount) : 0,
    };
  });

  const funnelData = ltvData.filter(l => l.totalClientes > 0).map(l => ({
    name: l.nome,
    value: l.totalClientes,
    ascendidos: l.ascendidos,
  }));

  // CMV evolution (simple: show estoque with margin)
  const estoqueData = (estoque ?? []).map(e => ({
    nome: e.produto_descricao,
    data: e.data_compra,
    valorTotal: e.valor_total,
    absorvido: e.valor_absorvido ?? 0,
    restante: e.valor_restante ?? 0,
    margemPct: e.valor_total > 0 ? ((e.valor_absorvido ?? 0) / e.valor_total) * 100 : 0,
    margemR: (e.valor_absorvido ?? 0) - e.valor_total,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-foreground">Produtos e Margem</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="catalogo"><Package className="h-3.5 w-3.5 mr-1.5" />Catálogo</TabsTrigger>
          <TabsTrigger value="desempenho"><TrendingUp className="h-3.5 w-3.5 mr-1.5" />Desempenho</TabsTrigger>
          <TabsTrigger value="ltv"><Users className="h-3.5 w-3.5 mr-1.5" />LTV e Ascensão</TabsTrigger>
          <TabsTrigger value="cmv"><BarChart3 className="h-3.5 w-3.5 mr-1.5" />CMV</TabsTrigger>
        </TabsList>

        {/* CATÁLOGO */}
        <TabsContent value="catalogo">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {["Produto", "Categoria", "Plataforma(s)", "Custo Direto %", "Preço Médio", "Margem Média %", "Vendas"].map(h => (
                      <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${["Custo Direto %", "Preço Médio", "Margem Média %", "Vendas"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {catalogData.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">Nenhum produto no catálogo</td></tr>}
                  {catalogData.map(p => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                      <td className="p-3 font-medium">{p.nome}</td>
                      <td className="p-3 text-muted-foreground">{p.categoria}</td>
                      <td className="p-3">
                        <div className="flex gap-1">{(p.plataformas ?? []).map((pl, i) => (
                          <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary">{pl}</span>
                        ))}</div>
                      </td>
                      <td className="p-3 text-right text-muted-foreground">{formatPercent(p.custo_direto_percentual)}</td>
                      <td className="p-3 text-right">{formatCurrency(p.precoMedio)}</td>
                      <td className={`p-3 text-right font-medium ${p.margemPerc >= 70 ? "text-emerald-400" : "text-foreground"}`}>{formatPercent(p.margemPerc)}</td>
                      <td className="p-3 text-right text-muted-foreground">{p.vendas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* DESEMPENHO DO MÊS */}
        <TabsContent value="desempenho">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-medium text-muted-foreground">Desempenho — {now.toLocaleString("pt-BR", { month: "long", year: "numeric" })}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {["Produto", "Unidades", "Receita Bruta", "Taxa Média", "Receita Líquida", "Custo Direto", "Margem R$", "Margem %"].map(h => (
                      <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h !== "Produto" ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {desempenho.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">Sem vendas neste mês</td></tr>}
                  {desempenho.map((d, i) => (
                    <tr key={i} className={`border-b border-border/50 hover:bg-surface-hover transition-colors ${d.margemP >= 70 ? "bg-emerald-500/5" : ""}`}>
                      <td className="p-3 font-medium">{d.nome}</td>
                      <td className="p-3 text-right">{d.unidades}</td>
                      <td className="p-3 text-right">{formatCurrency(d.bruto)}</td>
                      <td className="p-3 text-right text-muted-foreground">{formatCurrency(d.taxaMedia)}</td>
                      <td className="p-3 text-right">{formatCurrency(d.liquido)}</td>
                      <td className="p-3 text-right text-muted-foreground">{formatCurrency(d.custoTotal)}</td>
                      <td className="p-3 text-right text-primary">{formatCurrency(d.margemR)}</td>
                      <td className={`p-3 text-right font-medium ${d.margemP >= 70 ? "text-emerald-400" : "text-foreground"}`}>{formatPercent(d.margemP)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* LTV E FUNIL */}
        <TabsContent value="ltv">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-medium text-muted-foreground">Funil de Ascensão</h3>
              </div>
              {funnelData.length === 0 ? (
                <p className="p-12 text-center text-muted-foreground">Sem dados de ascensão</p>
              ) : (
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={funnelData} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} width={120} />
                      <Tooltip contentStyle={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 16%)", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="value" name="Total clientes" fill="#C9A84C" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="ascendidos" name="Ascenderam" fill="#E5C76B" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-medium text-muted-foreground">LTV por Produto de Entrada</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      {["Produto", "Clientes", "Ascenderam", "Conv. %", "Receita Total", "LTV Médio", "Tempo (dias)"].map(h => (
                        <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h !== "Produto" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ltvData.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Sem produtos de entrada</td></tr>}
                    {ltvData.map((l, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                        <td className="p-3 font-medium">{l.nome}</td>
                        <td className="p-3 text-right">{l.totalClientes}</td>
                        <td className="p-3 text-right">{l.ascendidos}</td>
                        <td className="p-3 text-right text-primary">{formatPercent(l.taxaConversao)}</td>
                        <td className="p-3 text-right">{formatCurrency(l.receitaTotal)}</td>
                        <td className="p-3 text-right text-primary">{formatCurrency(l.ltvMedio)}</td>
                        <td className="p-3 text-right text-muted-foreground">{l.tempoMedioDias}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* CMV */}
        <TabsContent value="cmv">
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Evolução de Margem CMV</h3>
              {estoqueData.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">Sem lotes de estoque</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={estoqueData}>
                    <XAxis dataKey="data" tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} tickFormatter={v => `${v.toFixed(0)}%`} />
                    <Tooltip contentStyle={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 16%)", borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="margemPct" stroke="#C9A84C" strokeWidth={2} dot={{ fill: "#C9A84C", r: 3 }} name="Margem %" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      {["Produto", "Data Compra", "Valor Total", "Absorvido", "Restante", "Margem %", "Margem R$"].map(h => (
                        <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h !== "Produto" && h !== "Data Compra" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {estoqueData.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">Nenhum lote</td></tr>}
                    {estoqueData.map((e, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                        <td className="p-3 font-medium">{e.nome}</td>
                        <td className="p-3 text-muted-foreground">{e.data}</td>
                        <td className="p-3 text-right">{formatCurrency(e.valorTotal)}</td>
                        <td className="p-3 text-right text-muted-foreground">{formatCurrency(e.absorvido)}</td>
                        <td className="p-3 text-right text-primary">{formatCurrency(e.restante)}</td>
                        <td className="p-3 text-right">{formatPercent(e.margemPct)}</td>
                        <td className="p-3 text-right">{formatCurrency(e.margemR)}</td>
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
