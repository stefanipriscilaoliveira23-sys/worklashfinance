import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Search, Loader2, AlertTriangle, ChevronRight, Users, DollarSign, Clock, CheckCircle2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import ParcelaDetalheSheet from "@/components/parcelas/ParcelaDetalheSheet";
import PagamentoDialog from "@/components/parcelas/PagamentoDialog";
import NovoContratoDialog from "@/components/parcelas/NovoContratoDialog";
import MonthNavigator, { getCurrentMonthKey, type DateFilter, getDateRange } from "@/components/MonthNavigator";
import type { Tables } from "@/integrations/supabase/types";

const TIPOS_MENTORIA = [
  "Mentoria Outsider", "Mentoria Digital Beauty", "Consultoria Premium",
  "Consultoria Express", "Renovação Mentoria"
] as const;

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  Pendente: { label: "A vencer", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  Quitado: { label: "Pago", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  Atraso: { label: "Atrasada", className: "bg-destructive/10 text-destructive border-destructive/20" },
  "Parcialmente Pago": { label: "Parcial", className: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
};

export function statusBadge(status: string | null) {
  const s = STATUS_LABELS[status ?? "Pendente"] ?? STATUS_LABELS["Pendente"];
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}


export default function ParcelasMentoria() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>({ type: "month", key: getCurrentMonthKey() });
  const [selectedAluna, setSelectedAluna] = useState<Tables<"parcelas_mentoria"> | null>(null);
  const [showPagamento, setShowPagamento] = useState<Tables<"parcelas_mentoria_detalhe"> | null>(null);
  const [showNovoContrato, setShowNovoContrato] = useState(false);

  // Fetch produtos_catalogo for product name display
  const { data: produtosCatalogo } = useQuery({
    queryKey: ["produtos-catalogo"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos_catalogo").select("*").eq("ativo", true);
      return data ?? [];
    },
  });

  // Helper: resolve product name from produto_id or tipo_mentoria
  const getProdutoNome = (parcela: any) => {
    if (parcela.produto_id) {
      const prod = (produtosCatalogo ?? []).find(p => p.id === parcela.produto_id);
      if (prod) return prod.nome;
    }
    const prod = (produtosCatalogo ?? []).find(p => p.categoria === parcela.tipo_mentoria);
    return prod?.nome ?? parcela.tipo_mentoria;
  };

  // Fetch all parcelas with their details for the selected date range
  const dateRange = getDateRange(dateFilter);
  const { data: allDetalhes, isLoading } = useQuery({
    queryKey: ["parcelas-detalhe-all", dateRange.start, dateRange.end],
    queryFn: async () => {
      await supabase.rpc("atualizar_parcelas_atrasadas");

      const { data, error } = await supabase
        .from("parcelas_mentoria_detalhe")
        .select("*, parcelas_mentoria!inner(*)")
        .gte("data_vencimento", dateRange.start)
        .lte("data_vencimento", dateRange.end)
        .order("data_vencimento");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: parcelas } = useQuery({
    queryKey: ["parcelas-mentoria"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parcelas_mentoria").select("*").order("criado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Metrics for selected month
  const metrics = useMemo(() => {
    if (!allDetalhes) return { total: 0, aReceber: 0, recebido: 0, qtdAReceber: 0, qtdRecebido: 0, clientes: 0, valorAtrasado: 0 };
    const clientSet = new Set<string>();
    let aReceber = 0, recebido = 0, qtdAReceber = 0, qtdRecebido = 0, valorAtrasado = 0;

    allDetalhes.forEach((d: any) => {
      const parent = d.parcelas_mentoria;
      clientSet.add(parent.cliente_nome);
      const valor = d.valor_real ?? d.valor_sugerido ?? 0;
      if (d.status === "Quitado") {
        recebido += valor;
        qtdRecebido++;
      } else if (d.status === "Atraso") {
        valorAtrasado += valor;
      } else {
        aReceber += valor;
        qtdAReceber++;
      }
    });

    return {
      total: aReceber + recebido + valorAtrasado,
      aReceber,
      recebido,
      qtdAReceber,
      qtdRecebido,
      clientes: clientSet.size,
      valorAtrasado,
    };
  }, [allDetalhes]);

  // Build table rows: group by parent contract, show each installment
  const tableRows = useMemo(() => {
    if (!allDetalhes) return [];
    return allDetalhes.filter((d: any) => {
      const parent = d.parcelas_mentoria;
      if (filtroTipo !== "all" && parent.tipo_mentoria !== filtroTipo) return false;
      if (filtroStatus === "contrato_quitado") {
        if (parent.status_geral !== "Quitado") return false;
      } else if (filtroStatus !== "all" && d.status !== filtroStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        return parent.cliente_nome.toLowerCase().includes(s) || (parent.cliente_email ?? "").toLowerCase().includes(s);
      }
      return true;
    });
  }, [allDetalhes, filtroTipo, filtroStatus, search]);

  const inadimplentes = (allDetalhes ?? []).filter((d: any) => d.status === "Atraso");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Parcelas de Mentoria</h1>
        <Button
          size="sm"
          className="gap-1"
          onClick={() => setShowNovoContrato(true)}
        >
          <Plus className="h-4 w-4" />
          Novo Contrato
        </Button>
      </div>

      <MonthNavigator filter={dateFilter} onChange={setDateFilter} />

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Clientes</span>
            </div>
            <p className="text-lg font-bold text-foreground">{metrics.clientes}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Valor Total</span>
            </div>
            <p className="text-lg font-bold text-foreground">{formatCurrency(metrics.total)}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Recebido ({metrics.qtdRecebido})</span>
            </div>
            <p className="text-lg font-bold text-emerald-400">{formatCurrency(metrics.recebido)}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-400" />
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">A Receber ({metrics.qtdAReceber})</span>
            </div>
            <p className="text-lg font-bold text-yellow-400">{formatCurrency(metrics.aReceber)}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Atrasadas ({inadimplentes.length})</span>
            </div>
            <p className="text-lg font-bold text-destructive">{formatCurrency(metrics.valorAtrasado)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Alert */}
      {inadimplentes.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {inadimplentes.length} parcela{inadimplentes.length > 1 ? "s" : ""} em atraso
            </p>
            <p className="text-xs text-muted-foreground">Parcelas em atraso precisam de atenção</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border" />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[200px] bg-secondary/50 border-border"><SelectValue placeholder="Tipo mentoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {TIPOS_MENTORIA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[200px] bg-secondary/50 border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Quitado">Parcela Paga</SelectItem>
            <SelectItem value="Pendente">Parcela Pendente</SelectItem>
            <SelectItem value="Atraso">Parcela Atrasada</SelectItem>
            <SelectItem value="Parcialmente Pago">Parcialmente Paga</SelectItem>
            <SelectItem value="contrato_quitado">Contrato Quitado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  {["Nome", "Produto", "Parcela", "Valor Parcela", "Vencimento", "Saldo Restante", "Status", "Obs.", ""].map(h => (
                    <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${["Valor Parcela", "Saldo Contrato"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 && (
                  <tr><td colSpan={9} className="p-12 text-center text-muted-foreground">Nenhuma parcela encontrada neste mês</td></tr>
                )}
                {tableRows.map((d: any) => {
                  const parent = d.parcelas_mentoria;
                  const valorParcela = d.valor_real ?? d.valor_sugerido ?? 0;
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer"
                      onClick={() => {
                        const p = (parcelas ?? []).find(p => p.id === parent.id);
                        if (p) setSelectedAluna(p);
                      }}
                    >
                      <td className="p-3 font-medium">{parent.cliente_nome}</td>
                      <td className="p-3 text-muted-foreground text-xs">{getProdutoNome(parent)}</td>
                      <td className="p-3 text-xs">
                        <span className="text-primary font-medium">{d.numero_parcela}</span>
                        <span className="text-muted-foreground">/{parent.quant_parcelas}</span>
                      </td>
                      <td className="p-3 text-right">{formatCurrency(valorParcela)}</td>
                      <td className="p-3 text-muted-foreground text-xs">{formatDate(d.data_vencimento)}</td>
                      <td className="p-3 text-right text-primary">{formatCurrency(d.saldo_parcela ?? 0)}</td>
                      <td className="p-3">{statusBadge(d.status)}</td>
                      <td className="p-3 text-muted-foreground text-xs truncate max-w-[100px]">{d.observacao || "—"}</td>
                      <td className="p-3"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ParcelaDetalheSheet
        selectedAluna={selectedAluna}
        onClose={() => setSelectedAluna(null)}
        onRegistrarPagamento={(d) => {
          setShowPagamento(d);
        }}
      />

      <PagamentoDialog
        showPagamento={showPagamento}
        onClose={() => setShowPagamento(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["parcelas-mentoria"] });
          queryClient.invalidateQueries({ queryKey: ["parcelas-detalhe-all"] });
        }}
      />

      <NovoContratoDialog
        open={showNovoContrato}
        onClose={() => setShowNovoContrato(false)}
      />
    </div>
  );
}
