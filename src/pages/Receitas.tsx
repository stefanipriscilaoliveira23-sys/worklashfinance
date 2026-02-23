import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Upload, Search, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NovaReceitaModal } from "@/components/receitas/NovaReceitaModal";
import { ImportarPlanilhaModal } from "@/components/receitas/ImportarPlanilhaModal";
import type { Tables } from "@/integrations/supabase/types";

const PLATAFORMAS = ["Hotmart", "Kiwify", "Eduzz", "Direto Pix", "Outro"] as const;
const CATEGORIAS = [
  "Mentoria Outsider", "Mentoria Digital Beauty", "Consultoria Premium", "Consultoria Express",
  "Curso/Formação", "Ferramenta", "Apostila", "Produto Físico", "Renovação Mentoria", "Outros"
] as const;

export default function Receitas() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [showNova, setShowNova] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroPlataforma, setFiltroPlataforma] = useState("all");
  const [filtroCategoria, setFiltroCategoria] = useState("all");

  const { data: receitas, isLoading } = useQuery({
    queryKey: ["receitas-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("receitas").select("*").order("data", { ascending: false });
      if (error) throw error;
      return data;
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

  const filtered = (receitas ?? []).filter((r) => {
    if (filtroPlataforma !== "all" && r.plataforma !== filtroPlataforma) return false;
    if (filtroCategoria !== "all" && r.produto_categoria !== filtroCategoria) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        r.produto_nome.toLowerCase().includes(s) ||
        (r.cliente_nome ?? "").toLowerCase().includes(s) ||
        (r.cliente_email ?? "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  const totalBruto = filtered.reduce((s, r) => s + (r.valor_bruto ?? 0), 0);
  const totalTaxas = filtered.reduce((s, r) => s + (r.taxa_plataforma_valor ?? 0), 0);
  const totalLiquido = filtered.reduce((s, r) => s + (r.valor_liquido ?? 0), 0);
  const totalUSD = filtered.filter(r => r.moeda_original === "USD").reduce((s, r) => s + (r.valor_bruto ?? 0), 0);

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
          { label: "Qtd vendas", value: String(filtered.length) },
          { label: "Total em USD", value: formatCurrency(totalUSD, "USD") },
        ].map((c) => (
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
          <Input
            placeholder="Buscar por produto, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50 border-border"
          />
        </div>
        <Select value={filtroPlataforma} onValueChange={setFiltroPlataforma}>
          <SelectTrigger className="w-[160px] bg-secondary/50 border-border">
            <SelectValue placeholder="Plataforma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {PLATAFORMAS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-[200px] bg-secondary/50 border-border">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  {["Data", "Produto", "Categoria", "Plataforma", "Cliente", "Bruto", "Taxa", "Líquido", "Moeda", "Origens", "Status", "Ações"].map((h) => (
                    <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${h === "Bruto" || h === "Taxa" || h === "Líquido" ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={12} className="p-12 text-center text-muted-foreground">Nenhuma receita encontrada</td></tr>
                )}
                {filtered.map((r) => (
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
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {(r.origens_venda ?? []).map((o, i) => (
                          <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary">{o}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 text-[10px] rounded-full ${r.status === "ativo" ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {role === "admin" && (
                          <button
                            onClick={() => { if (confirm("Excluir esta receita?")) deleteMutation.mutate(r.id); }}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showNova && <NovaReceitaModal open={showNova} onClose={() => setShowNova(false)} />}
      {showImport && <ImportarPlanilhaModal open={showImport} onClose={() => setShowImport(false)} />}
    </div>
  );
}
