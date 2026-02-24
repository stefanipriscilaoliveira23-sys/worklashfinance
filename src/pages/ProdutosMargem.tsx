import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatPercent, getMonthRange, getDaysInMonth } from "@/lib/format";
import { toast } from "sonner";
import { Loader2, Package, TrendingUp, Users, BarChart3, PieChart as PieIcon, ChevronLeft, ChevronRight, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import type { Database } from "@/integrations/supabase/types";

type ProdutoCategoria = Database["public"]["Enums"]["produto_categoria"];

const GOLD_COLORS = ["#C9A84C", "#E5C76B", "#A68A3E", "#D4B85A", "#8B7432", "#F0D87E"];
const ENTRY_CATEGORIES = ["Apostila", "Ferramenta", "Produto Físico"];

const CATEGORIAS: ProdutoCategoria[] = [
  "Mentoria Outsider", "Mentoria Digital Beauty", "Consultoria Premium", "Consultoria Express",
  "Curso/Formação", "Ferramenta", "Apostila", "Produto Físico", "Renovação Mentoria", "Outros"
];
const PLATAFORMAS = ["Hotmart", "Kiwify", "Eduzz", "Direto Pix", "Outro"];

export default function ProdutosMargem() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("catalogo");
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth());
  const { start, end } = getMonthRange(ano, mes);
  const mesLabel = new Date(ano, mes).toLocaleString("pt-BR", { month: "long", year: "numeric" });

  // Product form state
  const [showProdForm, setShowProdForm] = useState(false);
  const [editProd, setEditProd] = useState<any>(null);
  const [prodForm, setProdForm] = useState({ nome: "", categoria: "Outros" as ProdutoCategoria, plataformas: [] as string[], custo_direto_percentual: 0, observacao: "" });

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

  const { data: parcelasMentoria } = useQuery({
    queryKey: ["parcelas-mentoria-all"],
    queryFn: async () => {
      const { data } = await supabase.from("parcelas_mentoria").select("*, parcelas_mentoria_detalhe(*)");
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

  const { data: despesasEmp } = useQuery({
    queryKey: ["rateio-desp-emp"],
    queryFn: async () => {
      const { data } = await supabase.from("despesas_empresa").select("*");
      return data ?? [];
    },
  });

  const { data: meta } = useQuery({
    queryKey: ["rateio-meta", mes + 1, ano],
    queryFn: async () => {
      const { data } = await supabase.from("metas").select("*").eq("mes", mes + 1).eq("ano", ano).maybeSingle();
      return data;
    },
  });

  const isLoading = loadProd || loadRec;

  const openAddProd = () => { setEditProd(null); setProdForm({ nome: "", categoria: "Outros", plataformas: [], custo_direto_percentual: 0, observacao: "" }); setShowProdForm(true); };
  const openEditProd = (p: any) => { setEditProd(p); setProdForm({ nome: p.nome, categoria: p.categoria, plataformas: p.plataformas ?? [], custo_direto_percentual: p.custo_direto_percentual ?? 0, observacao: p.observacao ?? "" }); setShowProdForm(true); };
  const closeProdForm = () => { setShowProdForm(false); setEditProd(null); };

  const saveProd = useMutation({
    mutationFn: async () => {
      if (!prodForm.nome) throw new Error("Nome obrigatório");
      const payload = { nome: prodForm.nome, categoria: prodForm.categoria, plataformas: prodForm.plataformas, custo_direto_percentual: prodForm.custo_direto_percentual, observacao: prodForm.observacao || null };
      if (editProd) {
        const { error } = await supabase.from("produtos_catalogo").update(payload).eq("id", editProd.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("produtos_catalogo").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["produtos-catalogo"] }); toast.success(editProd ? "Produto atualizado" : "Produto adicionado"); closeProdForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteProd = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos_catalogo").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["produtos-catalogo"] }); toast.success("Produto removido"); },
    onError: () => toast.error("Erro ao remover produto"),
  });

  const allReceitas = receitas ?? [];
  const receitasMes = allReceitas.filter(r => r.data >= start && r.data <= end);
  const proLabore = meta?.pro_labore ?? 30000;

  // CATÁLOGO — match receitas + parcelas_mentoria contracts
  const allParcelas = parcelasMentoria ?? [];
  const catalogData = (produtos ?? []).map(p => {
    // Match receitas by id, name, or category
    const vendasReceitas = allReceitas.filter(r => r.produto_id === p.id || r.produto_nome === p.nome || r.produto_categoria === p.categoria);
    // Match parcelas_mentoria contracts by categoria or product name
    const vendasParcelas = allParcelas.filter(pm => {
      // Direct categoria match (works for Mentoria Outsider, Digital Beauty, etc.)
      if (pm.tipo_mentoria === p.categoria) return true;
      // For renovation products: match by checking if the product name contains info about which mentoria
      // e.g. "Renovação Lash Outsider" matches renovations of clients who had "Mentoria Outsider"
      if (p.categoria === "Renovação Mentoria" && pm.tipo_mentoria === "Renovação Mentoria") {
        // Try to find which specific renovation this is by checking client's other contracts
        const clientOtherContracts = allParcelas.filter(
          other => other.cliente_nome === pm.cliente_nome && other.tipo_mentoria !== "Renovação Mentoria"
        );
        if (clientOtherContracts.length > 0) {
          const originalMentoria = clientOtherContracts[0].tipo_mentoria;
          // Match renovation product name to original mentoria category
          // e.g. "Renovação Lash Outsider" contains keywords from "Mentoria Outsider"
          const prodNameLower = p.nome.toLowerCase();
          if (originalMentoria === "Mentoria Outsider" && prodNameLower.includes("outsider")) return true;
          if (originalMentoria === "Mentoria Digital Beauty" && (prodNameLower.includes("digital") || prodNameLower.includes("beauty"))) return true;
          if (originalMentoria === "Consultoria Premium" && prodNameLower.includes("premium")) return true;
          if (originalMentoria === "Consultoria Express" && prodNameLower.includes("express")) return true;
          return false;
        }
        return false;
      }
      return false;
    });
    
    const totalVendas = vendasReceitas.length + vendasParcelas.length;
    const totalBrutoReceitas = vendasReceitas.reduce((s, r) => s + (r.valor_bruto ?? 0), 0);
    const totalBrutoParcelas = vendasParcelas.reduce((s, pm) => s + (pm.valor_total ?? 0), 0);
    const totalBruto = totalBrutoReceitas + totalBrutoParcelas;
    const precoMedio = totalVendas > 0 ? totalBruto / totalVendas : 0;
    const custoPerc = p.custo_direto_percentual ?? 0;
    const margemPerc = precoMedio > 0 ? 100 - custoPerc : 0;
    return { ...p, vendas: totalVendas, precoMedio, margemPerc, totalBruto };
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

  // LTV & FUNIL
  const clienteMap = new Map<string, typeof allReceitas>();
  allReceitas.forEach(r => { if (r.cliente_email) { const l = clienteMap.get(r.cliente_email) ?? []; l.push(r); clienteMap.set(r.cliente_email, l); } });

  const entryProducts = (produtos ?? []).filter(p => ENTRY_CATEGORIES.includes(p.categoria));
  const ltvData = entryProducts.map(ep => {
    let totalClientes = 0, ascendidos = 0, receitaTotal = 0, tempoTotalDias = 0, tempoCount = 0;
    clienteMap.forEach(compras => {
      const entryCompra = compras.find(c => c.produto_nome === ep.nome || c.produto_id === ep.id);
      if (!entryCompra) return;
      totalClientes++;
      receitaTotal += compras.reduce((s, c) => s + (c.valor_bruto ?? 0), 0);
      const posteriores = compras.filter(c => c.id !== entryCompra.id && c.data > entryCompra.data && !ENTRY_CATEGORIES.includes(c.produto_categoria ?? ""));
      if (posteriores.length > 0) {
        ascendidos++;
        const first = posteriores.sort((a, b) => a.data.localeCompare(b.data))[0];
        tempoTotalDias += Math.floor((new Date(first.data).getTime() - new Date(entryCompra.data).getTime()) / 86400000);
        tempoCount++;
      }
    });
    return { nome: ep.nome, categoria: ep.categoria, totalClientes, ascendidos, taxaConversao: totalClientes > 0 ? (ascendidos / totalClientes) * 100 : 0, receitaTotal, ltvMedio: totalClientes > 0 ? receitaTotal / totalClientes : 0, tempoMedioDias: tempoCount > 0 ? Math.round(tempoTotalDias / tempoCount) : 0 };
  });

  const funnelData = ltvData.filter(l => l.totalClientes > 0).map(l => ({ name: l.nome, value: l.totalClientes, ascendidos: l.ascendidos }));

  // CMV
  const estoqueData = (estoque ?? []).map(e => ({
    nome: e.produto_descricao, data: e.data_compra, valorTotal: e.valor_total, absorvido: e.valor_absorvido ?? 0, restante: e.valor_restante ?? 0,
    margemPct: e.valor_total > 0 ? ((e.valor_absorvido ?? 0) / e.valor_total) * 100 : 0, margemR: (e.valor_absorvido ?? 0) - e.valor_total,
  }));

  // RATEIO DE DESPESAS
  const allDespEmp = despesasEmp ?? [];
  const fixasEmpresa = allDespEmp.filter(d => d.tipo_despesa === "Fixa").reduce((s, d) => s + (d.valor_original ?? 0), 0);
  const totalFixos = fixasEmpresa + proLabore;
  const receitaTotalMes = receitasMes.reduce((s, r) => s + (r.valor_bruto ?? 0), 0);

  const rateioData = useMemo(() => {
    const catMap = new Map<string, { receita: number; custoDireto: number }>();
    receitasMes.forEach(r => {
      const cat = r.produto_categoria || "Outros";
      const e = catMap.get(cat) ?? { receita: 0, custoDireto: 0 };
      e.receita += r.valor_bruto ?? 0;
      const prod = (produtos ?? []).find(p => p.id === r.produto_id || p.nome === r.produto_nome);
      if (prod) e.custoDireto += (r.valor_liquido ?? 0) * ((prod.custo_direto_percentual ?? 0) / 100);
      catMap.set(cat, e);
    });
    return Array.from(catMap.entries()).map(([cat, v]) => {
      const pctReceita = receitaTotalMes > 0 ? (v.receita / receitaTotalMes) * 100 : 0;
      const fixosAbsorvidos = totalFixos * (pctReceita / 100);
      const custoTotal = v.custoDireto + fixosAbsorvidos;
      const margemLiquida = v.receita - custoTotal;
      const margemPct = v.receita > 0 ? (margemLiquida / v.receita) * 100 : 0;
      return { cat, receita: v.receita, pctReceita, fixosAbsorvidos, custoDireto: v.custoDireto, custoTotal, margemLiquida, margemPct };
    }).sort((a, b) => b.receita - a.receita);
  }, [receitasMes, totalFixos, receitaTotalMes, produtos]);

  const prevMonth = () => { if (mes === 0) { setMes(11); setAno(a => a - 1); } else setMes(m => m - 1); };
  const nextMonth = () => { if (mes === 11) { setMes(0); setAno(a => a + 1); } else setMes(m => m + 1); };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-foreground">Produtos e Margem</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-secondary/50 border border-border flex-wrap">
          <TabsTrigger value="catalogo"><Package className="h-3.5 w-3.5 mr-1.5" />Catálogo</TabsTrigger>
          <TabsTrigger value="desempenho"><TrendingUp className="h-3.5 w-3.5 mr-1.5" />Desempenho</TabsTrigger>
          <TabsTrigger value="ltv"><Users className="h-3.5 w-3.5 mr-1.5" />LTV e Ascensão</TabsTrigger>
          <TabsTrigger value="cmv"><BarChart3 className="h-3.5 w-3.5 mr-1.5" />CMV</TabsTrigger>
          <TabsTrigger value="rateio"><PieIcon className="h-3.5 w-3.5 mr-1.5" />Rateio de Despesas</TabsTrigger>
        </TabsList>

        {/* CATÁLOGO */}
        <TabsContent value="catalogo">
          <div className="flex justify-end mb-3">
            <Button onClick={openAddProd} className="gold-gradient text-primary-foreground"><Plus className="h-4 w-4 mr-2" /> Novo produto</Button>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-secondary/30">
                  {["Produto", "Categoria", "Plataforma(s)", "Custo Direto %", "Preço Médio", "Margem Média %", "Vendas", "Ações"].map(h => (
                    <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${["Custo Direto %", "Preço Médio", "Margem Média %", "Vendas"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {catalogData.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">Nenhum produto no catálogo</td></tr>}
                  {catalogData.map(p => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                      <td className="p-3 font-medium">{p.nome}</td>
                      <td className="p-3 text-muted-foreground">{p.categoria}</td>
                      <td className="p-3"><div className="flex gap-1">{(p.plataformas ?? []).map((pl, i) => <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary">{pl}</span>)}</div></td>
                      <td className="p-3 text-right text-muted-foreground">{formatPercent(p.custo_direto_percentual)}</td>
                      <td className="p-3 text-right">{formatCurrency(p.precoMedio)}</td>
                      <td className={`p-3 text-right font-medium ${p.margemPerc >= 70 ? "text-emerald-400" : "text-foreground"}`}>{formatPercent(p.margemPerc)}</td>
                      <td className="p-3 text-right text-muted-foreground">{p.vendas}</td>
                      <td className="p-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><button className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><MoreHorizontal className="h-4 w-4" /></button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card border-border">
                            <DropdownMenuItem onClick={() => openEditProd(p)} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Editar</DropdownMenuItem>
                            {role === "admin" && <DropdownMenuItem onClick={() => { if (confirm("Remover produto?")) deleteProd.mutate(p.id); }} className="gap-2 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Excluir</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* DESEMPENHO */}
        <TabsContent value="desempenho">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-medium text-muted-foreground">Desempenho — {mesLabel}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-secondary/30">
                  {["Produto", "Unidades", "Receita Bruta", "Taxa Média", "Receita Líquida", "Custo Direto", "Margem R$", "Margem %"].map(h => (
                    <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h !== "Produto" ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr></thead>
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

        {/* LTV */}
        <TabsContent value="ltv">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border"><h3 className="text-sm font-medium text-muted-foreground">Funil de Ascensão</h3></div>
              {funnelData.length === 0 ? <p className="p-12 text-center text-muted-foreground">Sem dados</p> : (
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
              <div className="p-4 border-b border-border"><h3 className="text-sm font-medium text-muted-foreground">LTV por Produto de Entrada</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-secondary/30">
                    {["Produto", "Clientes", "Ascenderam", "Conv. %", "Receita Total", "LTV Médio", "Tempo (dias)"].map(h => (
                      <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h !== "Produto" ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr></thead>
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
              {estoqueData.length === 0 ? <p className="text-center text-muted-foreground py-12">Sem lotes</p> : (
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
                  <thead><tr className="border-b border-border bg-secondary/30">
                    {["Produto", "Data Compra", "Valor Total", "Absorvido", "Restante", "Margem %", "Margem R$"].map(h => (
                      <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h !== "Produto" && h !== "Data Compra" ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr></thead>
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

        {/* RATEIO DE DESPESAS */}
        <TabsContent value="rateio">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={prevMonth} className="text-muted-foreground"><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-medium text-foreground capitalize">{mesLabel}</span>
              <Button variant="ghost" size="icon" onClick={nextMonth} className="text-muted-foreground"><ChevronRight className="h-4 w-4" /></Button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase">Total Fixos (Empresa + Pro Labore)</p>
                <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(totalFixos)}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase">Receita Total do Mês</p>
                <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(receitaTotalMes)}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase">Pro Labore</p>
                <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(proLabore)}</p>
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs text-primary">💡 Este rateio é proporcional à receita. Produtos com maior receita absorvem mais custo fixo.</p>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-secondary/30">
                    {["Categoria", "Receita", "% Receita", "Fixos Absorvidos", "Custo Direto", "Custo Total", "Margem Líquida", "Margem %"].map(h => (
                      <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h !== "Categoria" ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {rateioData.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">Sem dados no mês</td></tr>}
                    {rateioData.map((r, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                        <td className="p-3 font-medium">{r.cat}</td>
                        <td className="p-3 text-right">{formatCurrency(r.receita)}</td>
                        <td className="p-3 text-right text-muted-foreground">{formatPercent(r.pctReceita)}</td>
                        <td className="p-3 text-right text-muted-foreground">{formatCurrency(r.fixosAbsorvidos)}</td>
                        <td className="p-3 text-right text-muted-foreground">{formatCurrency(r.custoDireto)}</td>
                        <td className="p-3 text-right">{formatCurrency(r.custoTotal)}</td>
                        <td className={`p-3 text-right font-medium ${r.margemLiquida >= 0 ? "text-emerald-400" : "text-destructive"}`}>{formatCurrency(r.margemLiquida)}</td>
                        <td className={`p-3 text-right ${r.margemPct >= 0 ? "text-emerald-400" : "text-destructive"}`}>{formatPercent(r.margemPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-primary/30 bg-secondary/40 font-bold">
                      <td className="p-3">TOTAL</td>
                      <td className="p-3 text-right">{formatCurrency(rateioData.reduce((s, r) => s + r.receita, 0))}</td>
                      <td className="p-3 text-right">100%</td>
                      <td className="p-3 text-right">{formatCurrency(totalFixos)}</td>
                      <td className="p-3 text-right">{formatCurrency(rateioData.reduce((s, r) => s + r.custoDireto, 0))}</td>
                      <td className="p-3 text-right">{formatCurrency(rateioData.reduce((s, r) => s + r.custoTotal, 0))}</td>
                      <td className={`p-3 text-right ${rateioData.reduce((s, r) => s + r.margemLiquida, 0) >= 0 ? "text-emerald-400" : "text-destructive"}`}>{formatCurrency(rateioData.reduce((s, r) => s + r.margemLiquida, 0))}</td>
                      <td className="p-3 text-right">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Product Add/Edit Dialog */}
      <Dialog open={showProdForm} onOpenChange={() => closeProdForm()}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">{editProd ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Nome *</Label>
              <Input value={prodForm.nome} onChange={e => setProdForm(f => ({ ...f, nome: e.target.value }))} className="bg-secondary/50 border-border" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-foreground/80">Categoria</Label>
                <Select value={prodForm.categoria} onValueChange={v => setProdForm(f => ({ ...f, categoria: v as ProdutoCategoria }))}>
                  <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80">Custo Direto %</Label>
                <Input type="number" step="0.1" value={prodForm.custo_direto_percentual || ""} onChange={e => setProdForm(f => ({ ...f, custo_direto_percentual: Number(e.target.value) }))} className="bg-secondary/50 border-border" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Plataformas</Label>
              <div className="flex flex-wrap gap-2">
                {PLATAFORMAS.map(p => (
                  <button key={p} type="button" onClick={() => setProdForm(f => ({ ...f, plataformas: f.plataformas.includes(p) ? f.plataformas.filter(x => x !== p) : [...f.plataformas, p] }))}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${prodForm.plataformas.includes(p) ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Observação</Label>
              <Textarea value={prodForm.observacao} onChange={e => setProdForm(f => ({ ...f, observacao: e.target.value }))} className="bg-secondary/50 border-border" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeProdForm} className="border-border">Cancelar</Button>
            <Button onClick={() => saveProd.mutate()} disabled={saveProd.isPending} className="gold-gradient text-primary-foreground">
              {saveProd.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
