import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Upload, Search, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NovaReceitaModal } from "@/components/receitas/NovaReceitaModal";
import { ImportarPlanilhaModal } from "@/components/receitas/ImportarPlanilhaModal";

const PLATAFORMAS = ["Hotmart", "Kiwify", "Eduzz", "Direto Pix", "Outro"] as const;
const CATEGORIAS = [
  "Mentoria Outsider", "Mentoria Digital Beauty", "Consultoria Premium", "Consultoria Express",
  "Curso/Formação", "Ferramenta", "Apostila", "Produto Físico", "Renovação Mentoria", "Outros"
] as const;

const MENTORIA_CATS = ["Mentoria Outsider", "Mentoria Digital Beauty", "Consultoria Premium", "Consultoria Express"];
const RENOVACAO_CATS = ["Renovação Mentoria"];
const DIGITAL_CATS = ["Curso/Formação", "Ferramenta", "Apostila"];
const FISICO_CATS = ["Produto Físico"];

export default function Receitas() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [showNova, setShowNova] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroPlataforma, setFiltroPlataforma] = useState("all");
  const [filtroCategoria, setFiltroCategoria] = useState("all");
  const [tab, setTab] = useState("todas");

  const { data: receitas, isLoading } = useQuery({
    queryKey: ["receitas-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("receitas").select("*").order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: parcelasData } = useQuery({
    queryKey: ["receitas-parcelas-info"],
    queryFn: async () => {
      const { data } = await supabase.from("parcelas_mentoria").select("*, parcelas_mentoria_detalhe(*)");
      return data ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("receitas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receitas-all"] });
      toast.success("Receita excluída");
    },
    onError: () => toast.error("Erro ao excluir — apenas administradores podem excluir"),
  });

  const allReceitas = receitas ?? [];
  const allParcelas = parcelasData ?? [];

  const filtered = allReceitas.filter((r) => {
    if (filtroPlataforma !== "all" && r.plataforma !== filtroPlataforma) return false;
    if (filtroCategoria !== "all" && r.produto_categoria !== filtroCategoria) return false;
    if (search) {
      const s = search.toLowerCase();
      return r.produto_nome.toLowerCase().includes(s) || (r.cliente_nome ?? "").toLowerCase().includes(s) || (r.cliente_email ?? "").toLowerCase().includes(s);
    }
    return true;
  });

  // Tab filtering
  const getTabData = () => {
    switch (tab) {
      case "mentorias": return filtered.filter(r => MENTORIA_CATS.includes(r.produto_categoria ?? ""));
      case "renovacoes": return filtered.filter(r => RENOVACAO_CATS.includes(r.produto_categoria ?? ""));
      case "digitais": return filtered.filter(r => DIGITAL_CATS.includes(r.produto_categoria ?? ""));
      case "fisicos": return filtered.filter(r => FISICO_CATS.includes(r.produto_categoria ?? ""));
      default: return filtered;
    }
  };
  const tabData = getTabData();

  const totalBruto = tabData.reduce((s, r) => s + (r.valor_bruto ?? 0), 0);
  const totalTaxas = tabData.reduce((s, r) => s + (r.taxa_plataforma_valor ?? 0), 0);
  const totalLiquido = tabData.reduce((s, r) => s + (r.valor_liquido ?? 0), 0);
  const totalUSD = tabData.filter(r => r.moeda_original === "USD").reduce((s, r) => s + (r.valor_bruto ?? 0), 0);

  // Helper to find parcela info for a receita
  const getParcelaInfo = (receitaId: string) => {
    const pm = allParcelas.find(p => p.receita_id === receitaId);
    if (!pm) return null;
    const detalhes = (pm as any).parcelas_mentoria_detalhe ?? [];
    const primeiraParcela = detalhes.sort((a: any, b: any) => a.data_vencimento.localeCompare(b.data_vencimento))[0];
    return { pm, detalhes, primeiraParcela, qtd: pm.quant_parcelas, valorParcela: pm.valor_total > 0 && pm.quant_parcelas > 0 ? (pm.valor_total - (pm.entrada_valor ?? 0)) / pm.quant_parcelas : 0, dataPrimeira: primeiraParcela?.data_vencimento };
  };

  const renderAllTable = () => (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border bg-secondary/30">
          {["Data", "Produto", "Categoria", "Plataforma", "Cliente", "Bruto", "Taxa", "Líquido", "Moeda", "Origens", "Status", "Ações"].map(h => (
            <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${["Bruto", "Taxa", "Líquido"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tabData.length === 0 && <tr><td colSpan={12} className="p-12 text-center text-muted-foreground">Nenhuma receita encontrada</td></tr>}
        {tabData.map(r => (
          <tr key={r.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
            <td className="p-3">{formatDate(r.data)}</td>
            <td className="p-3 truncate max-w-[140px]">{r.produto_nome}</td>
            <td className="p-3 text-muted-foreground text-xs">{r.produto_categoria || "—"}</td>
            <td className="p-3 text-muted-foreground">{r.plataforma}</td>
            <td className="p-3 truncate max-w-[120px]">{r.cliente_nome || "—"}</td>
            <td className="p-3 text-right">{formatCurrency(r.valor_bruto)}</td>
            <td className="p-3 text-right text-muted-foreground">{formatCurrency(r.taxa_plataforma_valor)}</td>
            <td className="p-3 text-right text-primary">{formatCurrency(r.valor_liquido)}</td>
            <td className="p-3 text-muted-foreground">{r.moeda_original}</td>
            <td className="p-3"><div className="flex flex-wrap gap-1">{(r.origens_venda ?? []).map((o, i) => <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary">{o}</span>)}</div></td>
            <td className="p-3"><span className={`px-2 py-0.5 text-[10px] rounded-full ${r.status === "ativo" ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>{r.status}</span></td>
            <td className="p-3">{role === "admin" && <button onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(r.id); }} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderMentoriasTable = () => (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-border bg-secondary/30">
        {["Data Venda", "Cliente", "Mentoria", "Valor Pago", "Valor Total", "Forma Pgto", "Nº Parcelas", "Vlr Parcela", "1ª Parcela", "Canal de Venda", "Obs."].map(h => (
          <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${["Valor Pago", "Valor Total", "Vlr Parcela"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
        ))}
      </tr></thead>
      <tbody>
        {tabData.length === 0 && <tr><td colSpan={11} className="p-12 text-center text-muted-foreground">Nenhuma mentoria</td></tr>}
        {tabData.map(r => {
          const pi = getParcelaInfo(r.id);
          return (
            <tr key={r.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
              <td className="p-3">{formatDate(r.data)}</td>
              <td className="p-3">{r.cliente_nome || "—"}</td>
              <td className="p-3">{r.produto_nome}</td>
              <td className="p-3 text-right">{formatCurrency(r.valor_bruto)}</td>
              <td className="p-3 text-right">{pi ? formatCurrency(pi.pm.valor_total) : formatCurrency(r.valor_bruto)}</td>
              <td className="p-3 text-muted-foreground">{r.forma_pagamento || "—"}</td>
              <td className="p-3 text-center">{pi?.qtd ?? "—"}</td>
              <td className="p-3 text-right text-muted-foreground">{pi ? formatCurrency(pi.valorParcela) : "—"}</td>
              <td className="p-3 text-muted-foreground">{pi ? formatDate(pi.dataPrimeira) : "—"}</td>
              <td className="p-3"><div className="flex flex-wrap gap-1">{(r.origens_venda ?? []).map((o, i) => <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary">{o}</span>)}</div></td>
              <td className="p-3 text-muted-foreground text-xs truncate max-w-[100px]">{r.observacao || "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const renderRenovacoesTable = () => (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-border bg-secondary/30">
        {["Data Venda", "Cliente", "Mentoria", "Valor Pago", "Valor Renovação", "Forma Pgto", "Nº Parcelas", "Vlr Parcela", "1ª Parcela", "Obs.", "Fim Anterior", "Status"].map(h => (
          <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${["Valor Pago", "Valor Renovação", "Vlr Parcela"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
        ))}
      </tr></thead>
      <tbody>
        {tabData.length === 0 && <tr><td colSpan={12} className="p-12 text-center text-muted-foreground">Nenhuma renovação</td></tr>}
        {tabData.map(r => {
          const pi = getParcelaInfo(r.id);
          const fimAnterior = pi?.pm?.data_termino_mentoria_anterior;
          const diasRenov = fimAnterior ? Math.floor((new Date(r.data).getTime() - new Date(fimAnterior).getTime()) / 86400000) : null;
          return (
            <tr key={r.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
              <td className="p-3">{formatDate(r.data)}</td>
              <td className="p-3">{r.cliente_nome || "—"}</td>
              <td className="p-3">{r.produto_nome}</td>
              <td className="p-3 text-right">{formatCurrency(r.valor_bruto)}</td>
              <td className="p-3 text-right">{pi ? formatCurrency(pi.pm.valor_total) : formatCurrency(r.valor_bruto)}</td>
              <td className="p-3 text-muted-foreground">{r.forma_pagamento || "—"}</td>
              <td className="p-3 text-center">{pi?.qtd ?? "—"}</td>
              <td className="p-3 text-right text-muted-foreground">{pi ? formatCurrency(pi.valorParcela) : "—"}</td>
              <td className="p-3 text-muted-foreground">{pi ? formatDate(pi.dataPrimeira) : "—"}</td>
              <td className="p-3 text-muted-foreground text-xs truncate max-w-[80px]">{r.observacao || "—"}</td>
              <td className="p-3 text-muted-foreground">{fimAnterior ? formatDate(fimAnterior) : "—"}</td>
              <td className="p-3">{diasRenov !== null ? <span className="text-xs text-primary">{diasRenov}d</span> : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const renderDigitaisTable = () => (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-border bg-secondary/30">
        {["Data Venda", "Cliente", "Produto", "Valor Total", "Forma Pgto", "Canal de Venda"].map(h => (
          <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h === "Valor Total" ? "text-right" : "text-left"}`}>{h}</th>
        ))}
      </tr></thead>
      <tbody>
        {tabData.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">Nenhum produto digital</td></tr>}
        {tabData.map(r => (
          <tr key={r.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
            <td className="p-3">{formatDate(r.data)}</td>
            <td className="p-3">{r.cliente_nome || "—"}</td>
            <td className="p-3">{r.produto_nome}</td>
            <td className="p-3 text-right">{formatCurrency(r.valor_bruto)}</td>
            <td className="p-3 text-muted-foreground">{r.forma_pagamento || "—"}</td>
            <td className="p-3"><div className="flex flex-wrap gap-1">{(r.origens_venda ?? []).map((o, i) => <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary">{o}</span>)}</div></td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderFisicosTable = () => (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-border bg-secondary/30">
        {["Data Venda", "Cliente", "Produto", "Valor Total", "Forma Pgto", "Canal de Venda"].map(h => (
          <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h === "Valor Total" ? "text-right" : "text-left"}`}>{h}</th>
        ))}
      </tr></thead>
      <tbody>
        {tabData.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">Nenhum produto físico</td></tr>}
        {tabData.map(r => (
          <tr key={r.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
            <td className="p-3">{formatDate(r.data)}</td>
            <td className="p-3">{r.cliente_nome || "—"}</td>
            <td className="p-3">{r.produto_nome}</td>
            <td className="p-3 text-right">{formatCurrency(r.valor_bruto)}</td>
            <td className="p-3 text-muted-foreground">{r.forma_pagamento || "—"}</td>
            <td className="p-3"><div className="flex flex-wrap gap-1">{(r.origens_venda ?? []).map((o, i) => <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary">{o}</span>)}</div></td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // removed gerais table (same as "todas")

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Receitas</h1>
        <div className="flex gap-2">
          <Button onClick={() => setShowImport(true)} variant="outline" className="border-border text-muted-foreground hover:text-foreground">
            <Upload className="h-4 w-4 mr-2" /> Importar planilha
          </Button>
          <Button onClick={() => setShowNova(true)} className="gold-gradient text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Nova receita
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Bruto", value: formatCurrency(totalBruto) },
          { label: "Total Taxas", value: formatCurrency(totalTaxas) },
          { label: "Total Líquido", value: formatCurrency(totalLiquido) },
          { label: "Qtd vendas", value: String(tabData.length) },
          { label: "Total em USD", value: formatCurrency(totalUSD, "USD") },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</p>
            <p className="text-lg font-bold text-foreground mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por produto, cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border" />
        </div>
        <Select value={filtroPlataforma} onValueChange={setFiltroPlataforma}>
          <SelectTrigger className="w-[160px] bg-secondary/50 border-border"><SelectValue placeholder="Plataforma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {PLATAFORMAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-[200px] bg-secondary/50 border-border"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs + Tabela */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-secondary/50 border border-border flex-wrap">
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="mentorias">Mentorias</TabsTrigger>
          <TabsTrigger value="renovacoes">Renovações</TabsTrigger>
          <TabsTrigger value="digitais">Digitais</TabsTrigger>
          <TabsTrigger value="fisicos">Físicos</TabsTrigger>
        </TabsList>

        <div className="rounded-xl border border-border bg-card overflow-hidden mt-4">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <>
                <TabsContent value="todas" className="m-0">{renderAllTable()}</TabsContent>
                <TabsContent value="mentorias" className="m-0">{renderMentoriasTable()}</TabsContent>
                <TabsContent value="renovacoes" className="m-0">{renderRenovacoesTable()}</TabsContent>
                <TabsContent value="digitais" className="m-0">{renderDigitaisTable()}</TabsContent>
                <TabsContent value="fisicos" className="m-0">{renderFisicosTable()}</TabsContent>
              </>
            )}
          </div>
        </div>
      </Tabs>

      {showNova && <NovaReceitaModal open={showNova} onClose={() => setShowNova(false)} />}
      {showImport && <ImportarPlanilhaModal open={showImport} onClose={() => setShowImport(false)} />}
    </div>
  );
}
