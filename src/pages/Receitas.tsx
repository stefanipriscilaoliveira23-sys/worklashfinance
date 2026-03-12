import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Upload, Search, Loader2, MoreHorizontal, Pencil, Trash2, FileSpreadsheet, Download } from "lucide-react";
import { exportCsv } from "@/lib/exportCsv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NovaReceitaModal } from "@/components/receitas/NovaReceitaModal";
import { ImportarPlanilhaModal } from "@/components/receitas/ImportarPlanilhaModal";
import { EditarReceitaModal } from "@/components/receitas/EditarReceitaModal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import MonthNavigator, { getCurrentMonthKey, type DateFilter, filterByDate } from "@/components/MonthNavigator";

const PLATAFORMAS = ["Hotmart", "Kiwify", "Eduzz", "Direto Pix", "Outro"] as const;
const CATEGORIAS = ["Mentorias", "Renovações", "Digitais", "Físicos"] as const;

const MENTORIA_CATS = ["Mentorias"];
const RENOVACAO_CATS = ["Renovações"];
const DIGITAL_CATS = ["Digitais"];
const FISICO_CATS = ["Físicos"];

export default function Receitas() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [showNova, setShowNova] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editReceita, setEditReceita] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filtroPlataforma, setFiltroPlataforma] = useState("all");
  const [filtroProduto, setFiltroProduto] = useState("all");
  const [filtroImportado, setFiltroImportado] = useState<"all" | "importado" | "manual">("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>({ type: "month", key: getCurrentMonthKey() });
  const [tab, setTab] = useState("todas");

  const { data: receitas, isLoading } = useQuery({
    queryKey: ["receitas-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("receitas").select("*").order("data", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: produtosCatalogo } = useQuery({
    queryKey: ["produtos-catalogo"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos_catalogo").select("*").eq("ativo", true);
      return data ?? [];
    },
  });

  const getProdutoNome = (parcela: any) => {
    if (parcela.produto_id) {
      const prod = (produtosCatalogo ?? []).find(p => p.id === parcela.produto_id);
      if (prod) return prod.nome;
    }
    const prod = (produtosCatalogo ?? []).find(p => p.categoria === parcela.tipo_mentoria);
    return prod?.nome ?? parcela.tipo_mentoria;
  };

  const { data: parcelasData } = useQuery({
    queryKey: ["receitas-parcelas-info"],
    queryFn: async () => {
      const { data } = await supabase.from("parcelas_mentoria").select("*, parcelas_mentoria_detalhe(*)");
      return data ?? [];
    },
  });

  // Parcelas quitadas para exibir como entradas de receita
  const { data: parcelasQuitadas } = useQuery({
    queryKey: ["receitas-parcelas-quitadas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("parcelas_mentoria_detalhe")
        .select("*, parcelas_mentoria!inner(*)")
        .eq("status", "Quitado")
        .order("data_pagamento", { ascending: true });
      return data ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // 1. Find related parcelas_mentoria linked to this receita
      const { data: parcelas } = await supabase
        .from("parcelas_mentoria")
        .select("id")
        .eq("receita_id", id);

      if (parcelas && parcelas.length > 0) {
        const pmIds = parcelas.map((p) => p.id);
        // 2. Delete pagamentos parciais for detalhe records
        const { data: detalhes } = await supabase
          .from("parcelas_mentoria_detalhe")
          .select("id")
          .in("parcela_mentoria_id", pmIds);
        if (detalhes && detalhes.length > 0) {
          await supabase
            .from("pagamentos_parciais")
            .delete()
            .eq("referencia_tipo", "parcela_mentoria_detalhe")
            .in("referencia_id", detalhes.map(d => d.id));
        }
        // 3. Delete parcelas_mentoria_detalhe for those contracts
        await supabase
          .from("parcelas_mentoria_detalhe")
          .delete()
          .in("parcela_mentoria_id", pmIds);
        // 4. Delete the parcelas_mentoria contracts themselves
        await supabase
          .from("parcelas_mentoria")
          .delete()
          .in("id", pmIds);
      }

      // 5. Delete the receita
      const { error } = await supabase.from("receitas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receitas-all"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-quitadas"] });
      toast.success("Receita e parcelas relacionadas excluídas");
    },
    onError: () => toast.error("Erro ao excluir receita"),
  });

  // Delete a single parcela detalhe (from Parcelas tab)
  const deleteParcelaMutation = useMutation({
    mutationFn: async (parcelaDetalheId: string) => {
      // 1. Delete pagamentos parciais
      await supabase
        .from("pagamentos_parciais")
        .delete()
        .eq("referencia_tipo", "parcela_mentoria_detalhe")
        .eq("referencia_id", parcelaDetalheId);

      // 2. Delete the receita linked to this parcela if exists
      const { data: receitas } = await supabase
        .from("receitas")
        .select("id")
        .eq("produto_entrada_id", parcelaDetalheId);
      if (receitas && receitas.length > 0) {
        await supabase.from("receitas").delete().in("id", receitas.map(r => r.id));
      }

      // 3. Delete the parcela detalhe
      const { error } = await supabase
        .from("parcelas_mentoria_detalhe")
        .delete()
        .eq("id", parcelaDetalheId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receitas-all"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-quitadas"] });
      toast.success("Parcela excluída com sucesso");
    },
    onError: () => toast.error("Erro ao excluir parcela"),
  });

  const allReceitas = receitas ?? [];
  const allParcelas = parcelasData ?? [];

  // Transform parcelas quitadas into receita-like objects
  const parcelasComoReceitas = (parcelasQuitadas ?? []).map((pq: any) => {
    const parent = pq.parcelas_mentoria;
    return {
      id: `parcela-${pq.id}`,
      data: pq.data_pagamento ?? pq.data_vencimento,
      produto_nome: getProdutoNome(parent),
      produto_categoria: parent.tipo_mentoria,
      plataforma: "" as any,
      cliente_nome: parent.cliente_nome,
      cliente_email: parent.cliente_email,
      valor_bruto: pq.valor_real ?? pq.valor_sugerido ?? 0,
      taxa_plataforma_valor: 0,
      valor_liquido: pq.valor_real ?? pq.valor_sugerido ?? 0,
      moeda_original: "BRL",
      origens_venda: [] as string[],
      status: "ativo",
      observacao: pq.observacao,
      forma_pagamento: null,
      is_parcela: true,
      parcela_label: `${pq.numero_parcela}/${parent.quant_parcelas}`,
      // Carry parent parcela info for renovações/mentorias tabs
      _parent_parcela: parent,
      _parent_detalhes: parent,
    };
  });

  const filtered = allReceitas.filter((r) => {
    if (filtroPlataforma !== "all" && r.plataforma !== filtroPlataforma) return false;
    if (filtroProduto !== "all" && r.produto_nome !== filtroProduto) return false;
    if (filtroImportado === "importado" && !(r as any).importado) return false;
    if (filtroImportado === "manual" && (r as any).importado) return false;
    if (search) {
      const s = search.toLowerCase();
      return r.produto_nome.toLowerCase().includes(s) || (r.cliente_nome ?? "").toLowerCase().includes(s) || (r.cliente_email ?? "").toLowerCase().includes(s);
    }
    return true;
  });

  // Filter parcelas the same way
  const filteredParcelas = parcelasComoReceitas.filter((r: any) => {
    // Parcelas nunca são importadas de planilha
    if (filtroImportado === "importado") return false;
    if (filtroPlataforma !== "all" && r.plataforma !== filtroPlataforma) return false;
    if (filtroProduto !== "all" && r.produto_nome !== filtroProduto) return false;
    if (search) {
      const s = search.toLowerCase();
      return r.produto_nome.toLowerCase().includes(s) || (r.cliente_nome ?? "").toLowerCase().includes(s) || (r.cliente_email ?? "").toLowerCase().includes(s);
    }
    return true;
  });

  // Only receitas (actual sales), filtered by date
  const salesEntries = filtered
    .filter(r => filterByDate(r.data, dateFilter))
    .sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));

  // Only parcelas, filtered by date
  const parcelasEntries = filteredParcelas
    .filter(r => filterByDate(r.data, dateFilter))
    .sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));

  // Merge for "Todas" tab
  const allEntries = [...salesEntries, ...parcelasEntries]
    .sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));

  // Tab filtering — category tabs show only sales, "parcelas" tab shows only parcelas
  const getTabData = () => {
    switch (tab) {
      case "mentorias": return salesEntries.filter(r => MENTORIA_CATS.includes(r.produto_categoria ?? ""));
      case "renovacoes": return salesEntries.filter(r => RENOVACAO_CATS.includes(r.produto_categoria ?? ""));
      case "digitais": return salesEntries.filter(r => DIGITAL_CATS.includes(r.produto_categoria ?? ""));
      case "fisicos": return salesEntries.filter(r => FISICO_CATS.includes(r.produto_categoria ?? ""));
      case "parcelas": return parcelasEntries;
      default: return allEntries;
    }
  };
  const tabData = getTabData();

  const totalBruto = tabData.reduce((s, r) => s + (r.valor_bruto ?? 0), 0);
  const totalTaxas = tabData.reduce((s, r) => s + ((r as any).taxa_plataforma_valor ?? 0), 0);
  const totalLiquido = tabData.reduce((s, r) => s + ((r as any).valor_liquido ?? 0), 0);
  const totalUSD = tabData.filter(r => (r as any).moeda_original === "USD").reduce((s, r) => s + (r.valor_bruto ?? 0), 0);

  // Helper to find parcela info for a receita or parcela-type entry
  const getParcelaInfo = (entry: any) => {
    // For parcela-type entries, use the embedded parent data
    if (entry._parent_parcela) {
      const pm = allParcelas.find(p => p.id === entry._parent_parcela.id);
      if (pm) {
        const detalhes = (pm as any).parcelas_mentoria_detalhe ?? [];
        const primeiraParcela = [...detalhes].sort((a: any, b: any) => a.data_vencimento.localeCompare(b.data_vencimento))[0];
        return { pm, detalhes, primeiraParcela, qtd: pm.quant_parcelas, valorParcela: pm.valor_total > 0 && pm.quant_parcelas > 0 ? (pm.valor_total - (pm.entrada_valor ?? 0)) / pm.quant_parcelas : 0, dataPrimeira: primeiraParcela?.data_vencimento };
      }
      // Fallback to _parent_parcela directly
      const pp = entry._parent_parcela;
      return { pm: pp, detalhes: [], primeiraParcela: null, qtd: pp.quant_parcelas, valorParcela: pp.valor_total > 0 && pp.quant_parcelas > 0 ? (pp.valor_total - (pp.entrada_valor ?? 0)) / pp.quant_parcelas : 0, dataPrimeira: null };
    }
    // For receita-type entries
    const pm = allParcelas.find(p => p.receita_id === entry.id);
    if (!pm) return null;
    const detalhes = (pm as any).parcelas_mentoria_detalhe ?? [];
    const primeiraParcela = [...detalhes].sort((a: any, b: any) => a.data_vencimento.localeCompare(b.data_vencimento))[0];
    return { pm, detalhes, primeiraParcela, qtd: pm.quant_parcelas, valorParcela: pm.valor_total > 0 && pm.quant_parcelas > 0 ? (pm.valor_total - (pm.entrada_valor ?? 0)) / pm.quant_parcelas : 0, dataPrimeira: primeiraParcela?.data_vencimento };
  };

  const renderActions = (r: any) => {
    const isParcela = !!r.is_parcela;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><MoreHorizontal className="h-4 w-4" /></button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card border-border">
          {!isParcela && <DropdownMenuItem onClick={() => setEditReceita(r)} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Editar</DropdownMenuItem>}
          {!isParcela && <DropdownMenuItem onClick={() => { if (confirm("Excluir esta receita e suas parcelas vinculadas?")) deleteMutation.mutate(r.id); }} className="gap-2 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Excluir</DropdownMenuItem>}
          {isParcela && <DropdownMenuItem onClick={() => { if (confirm("Excluir esta parcela?")) { const realId = r.id.replace("parcela-", ""); deleteParcelaMutation.mutate(realId); } }} className="gap-2 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Excluir Parcela</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderAllTable = () => (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border bg-secondary/30">
          {["Data", "Produto", "Origem", "Cliente", "Bruto", "Taxa", "Líquido", "Ações"].map(h => (
            <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${["Bruto", "Taxa", "Líquido"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tabData.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">Nenhuma receita encontrada</td></tr>}
        {tabData.map((r: any) => {
          const isParcela = !!r.is_parcela;
          return (
            <tr key={r.id} className={`border-b border-border/50 hover:bg-surface-hover transition-colors ${isParcela ? "bg-primary/[0.02]" : ""}`}>
              <td className="p-3">{formatDate(r.data)}</td>
              <td className="p-3 truncate max-w-[200px]">{r.produto_nome}</td>
              <td className="p-3 text-muted-foreground text-xs">{r.plataforma || "—"}</td>
              <td className="p-3 truncate max-w-[120px]">{r.cliente_nome || "—"}</td>
              <td className="p-3 text-right">{formatCurrency(r.valor_bruto)}</td>
              <td className="p-3 text-right text-muted-foreground">{formatCurrency(r.taxa_plataforma_valor ?? 0)}</td>
              <td className="p-3 text-right text-primary">{formatCurrency(r.valor_liquido ?? r.valor_bruto)}</td>
              <td className="p-3">
                {renderActions(r)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const renderMentoriasTable = () => (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-border bg-secondary/30">
        {["Data Venda", "Cliente", "Mentoria", "Valor Pago", "Valor Total", "Forma Pgto", "Nº Parcelas", "Vlr Parcela", "1ª Parcela", "Canal de Venda", "Obs.", ""].map(h => (
          <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${["Valor Pago", "Valor Total", "Vlr Parcela"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
        ))}
      </tr></thead>
      <tbody>
        {tabData.length === 0 && <tr><td colSpan={12} className="p-12 text-center text-muted-foreground">Nenhuma mentoria</td></tr>}
        {tabData.map(r => {
          const pi = getParcelaInfo(r);
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
              <td className="p-3">{renderActions(r)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const renderRenovacoesTable = () => (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-border bg-secondary/30">
        {["Data Venda", "Cliente", "Mentoria", "Valor Pago", "Valor Renovação", "Forma Pgto", "Nº Parcelas", "Vlr Parcela", "1ª Parcela", "Obs.", "Fim Anterior", "Status", ""].map(h => (
          <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${["Valor Pago", "Valor Renovação", "Vlr Parcela"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
        ))}
      </tr></thead>
      <tbody>
        {tabData.length === 0 && <tr><td colSpan={13} className="p-12 text-center text-muted-foreground">Nenhuma renovação</td></tr>}
        {tabData.map(r => {
          const pi = getParcelaInfo(r);
          const fimAnterior = pi?.pm?.data_termino_mentoria_anterior || (r as any).data_fim_mentoria;
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
              <td className="p-3">{renderActions(r)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const renderDigitaisTable = () => (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-border bg-secondary/30">
        {["Data Venda", "Cliente", "Produto", "Valor Total", "Forma Pgto", "Canal de Venda", ""].map(h => (
          <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h === "Valor Total" ? "text-right" : "text-left"}`}>{h}</th>
        ))}
      </tr></thead>
      <tbody>
        {tabData.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">Nenhum produto digital</td></tr>}
        {tabData.map(r => (
          <tr key={r.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
            <td className="p-3">{formatDate(r.data)}</td>
            <td className="p-3">{r.cliente_nome || "—"}</td>
            <td className="p-3">{r.produto_nome}</td>
            <td className="p-3 text-right">{formatCurrency(r.valor_bruto)}</td>
            <td className="p-3 text-muted-foreground">{r.forma_pagamento || "—"}</td>
            <td className="p-3"><div className="flex flex-wrap gap-1">{(r.origens_venda ?? []).map((o, i) => <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary">{o}</span>)}</div></td>
            <td className="p-3">{renderActions(r)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderFisicosTable = () => (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-border bg-secondary/30">
        {["Data Venda", "Cliente", "Produto", "Valor Total", "Forma Pgto", "Canal de Venda", ""].map(h => (
          <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h === "Valor Total" ? "text-right" : "text-left"}`}>{h}</th>
        ))}
      </tr></thead>
      <tbody>
        {tabData.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">Nenhum produto físico</td></tr>}
        {tabData.map(r => (
          <tr key={r.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
            <td className="p-3">{formatDate(r.data)}</td>
            <td className="p-3">{r.cliente_nome || "—"}</td>
            <td className="p-3">{r.produto_nome}</td>
            <td className="p-3 text-right">{formatCurrency(r.valor_bruto)}</td>
            <td className="p-3 text-muted-foreground">{r.forma_pagamento || "—"}</td>
            <td className="p-3"><div className="flex flex-wrap gap-1">{(r.origens_venda ?? []).map((o, i) => <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary">{o}</span>)}</div></td>
            <td className="p-3">{renderActions(r)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderParcelasTable = () => (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-border bg-secondary/30">
        {["Data Pgto", "Cliente", "Produto", "Parcela", "Valor", "Ações"].map(h => (
          <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h === "Valor" ? "text-right" : "text-left"}`}>{h}</th>
        ))}
      </tr></thead>
      <tbody>
        {tabData.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">Nenhuma parcela recebida neste período</td></tr>}
        {tabData.map((r: any) => (
          <tr key={r.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
            <td className="p-3">{formatDate(r.data)}</td>
            <td className="p-3">{r.cliente_nome || "—"}</td>
            <td className="p-3">{r.produto_nome}</td>
            <td className="p-3 text-xs"><span className="text-primary font-medium">{r.parcela_label}</span></td>
            <td className="p-3 text-right text-primary">{formatCurrency(r.valor_bruto)}</td>
            <td className="p-3 text-muted-foreground text-xs">{r.observacao || "—"}</td>
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
          <Button
            onClick={() => {
              const allRows = [...filtered, ...filteredParcelas].filter((r: any) => filterByDate(r.data, dateFilter));
              const label = dateFilter.type === "month" ? dateFilter.key : `${dateFilter.start}_${dateFilter.end}`;
              exportCsv(`receitas-${label}.csv`,
                ["Data", "Produto", "Categoria", "Plataforma", "Cliente", "Email", "Valor Bruto", "Taxa Plataforma", "Valor Líquido", "Forma Pgto", "Observação"],
                allRows.map((r: any) => [r.data, r.produto_nome, r.produto_categoria, r.plataforma, r.cliente_nome, r.cliente_email, r.valor_bruto, r.taxa_plataforma_valor, r.valor_liquido, r.forma_pagamento, r.observacao])
              );
            }}
            variant="outline" size="sm" className="border-border text-muted-foreground hover:text-foreground"
          >
            <Download className="h-4 w-4 mr-1.5" /> CSV
          </Button>
          <Button
            onClick={() => setFiltroImportado(f => f === "importado" ? "all" : "importado")}
            variant={filtroImportado === "importado" ? "default" : "outline"}
            className={filtroImportado === "importado" ? "gold-gradient text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Importações
          </Button>
          <Button onClick={() => setShowImport(true)} variant="outline" className="border-border text-muted-foreground hover:text-foreground">
            <Upload className="h-4 w-4 mr-2" /> Importar planilha
          </Button>
          <Button onClick={() => setShowNova(true)} className="gold-gradient text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Nova receita
          </Button>
        </div>
      </div>

      <MonthNavigator filter={dateFilter} onChange={setDateFilter} />

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
        <Select value={filtroProduto} onValueChange={setFiltroProduto}>
          <SelectTrigger className="w-[200px] bg-secondary/50 border-border"><SelectValue placeholder="Produto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {(produtosCatalogo ?? []).map(p => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}
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
          <TabsTrigger value="parcelas">Parcelas</TabsTrigger>
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
                <TabsContent value="parcelas" className="m-0">{renderParcelasTable()}</TabsContent>
              </>
            )}
          </div>
        </div>
      </Tabs>



      {showNova && <NovaReceitaModal open={showNova} onClose={() => setShowNova(false)} />}
      {showImport && <ImportarPlanilhaModal open={showImport} onClose={() => setShowImport(false)} />}
      {editReceita && <EditarReceitaModal receita={editReceita} open={!!editReceita} onClose={() => setEditReceita(null)} />}
    </div>
  );
}
