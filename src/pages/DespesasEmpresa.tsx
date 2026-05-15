import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Search, Loader2, DollarSign, MoreHorizontal, Pencil, Trash2, Download, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { exportCsv } from "@/lib/exportCsv";
import MonthNavigator, { getCurrentMonthKey, type DateFilter, filterByDate, getDateRange } from "@/components/MonthNavigator";
import { getWeekRange } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Tables } from "@/integrations/supabase/types";
import { Constants } from "@/integrations/supabase/types";

const CATEGORIAS = Constants.public.Enums.despesa_categoria_empresa;

const STATUS_STYLE: Record<string, string> = {
  "A Vencer": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "Vencendo Hoje": "bg-primary/10 text-primary border-primary/20",
  "Pago": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Em Atraso": "bg-destructive/10 text-destructive border-destructive/20",
  "Parcialmente Pago": "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

type TipoPagamento = "unico" | "fixo" | "variavel" | "parcelado";

function getDisplayStatus(status: string | null, dataVencimento: string | null) {
  const today = new Date().toISOString().split("T")[0];
  if (status === "A Vencer" && dataVencimento === today) return "Vencendo Hoje";
  return status ?? "A Vencer";
}

const TIPO_PAGAMENTO_LABELS: Record<TipoPagamento, string> = {
  unico: "Único",
  fixo: "Fixo (Recorrente)",
  variavel: "Variável",
  parcelado: "Parcelado",
};

export default function DespesasEmpresa() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("fixas");
  const [search, setSearch] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>({ type: "month", key: getCurrentMonthKey() });

  // Expanded parcelado groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // New expense modal
  const [showNova, setShowNova] = useState(false);
  const [novaForm, setNovaForm] = useState({
    descricao: "", categoria: "" as any, tipo_pagamento: "unico" as TipoPagamento,
    valor_original: "", data_vencimento: new Date().toISOString().split("T")[0], forma_pagamento: "", observacao: "",
    prioridade: "Média" as "Alta" | "Média" | "Baixa",
    cmv_produto: "", cmv_quantidade: "", cmv_data_compra: "",
    total_parcelas: "2",
  });

  // Payment modal
  const [showPagamento, setShowPagamento] = useState<Tables<"despesas_empresa"> | null>(null);
  const [showPagamentoParcela, setShowPagamentoParcela] = useState<any | null>(null);
  const [pgValor, setPgValor] = useState("");
  const [pgData, setPgData] = useState(new Date().toISOString().split("T")[0]);
  const [pgObs, setPgObs] = useState("");

  // Edit modal
  const [editItem, setEditItem] = useState<Tables<"despesas_empresa"> | null>(null);
  const [editForm, setEditForm] = useState({ descricao: "", categoria: "" as any, tipo_despesa: "Fixa" as any, valor_original: "", data_vencimento: "", forma_pagamento: "", observacao: "", prioridade: "Média" as "Alta" | "Média" | "Baixa" });

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<Tables<"despesas_empresa"> | null>(null);

  const { data: despesas, isLoading } = useQuery({
    queryKey: ["despesas-empresa"],
    queryFn: async () => {
      await supabase.rpc("atualizar_despesas_atrasadas");
      const { data, error } = await supabase.from("despesas_empresa").select("*").order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: despesasParcelas } = useQuery({
    queryKey: ["despesas-parcelas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("despesas_parcelas" as any).select("*").order("numero_parcela", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: estoque } = useQuery({
    queryKey: ["estoque-cmv"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estoque_cmv").select("*").order("data_compra", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const getTipoDespesaFromTipoPagamento = (tp: TipoPagamento): "Fixa" | "Variável" => {
    if (tp === "fixo") return "Fixa";
    return "Variável";
  };

  const criarDespesa = useMutation({
    mutationFn: async () => {
      const valor = parseFloat(novaForm.valor_original);
      if (!novaForm.descricao || !novaForm.categoria || isNaN(valor)) throw new Error("Preencha todos os campos obrigatórios");

      const tipoDespesa = getTipoDespesaFromTipoPagamento(novaForm.tipo_pagamento);

      if (novaForm.tipo_pagamento === "parcelado") {
        const numParcelas = parseInt(novaForm.total_parcelas);
        if (isNaN(numParcelas) || numParcelas < 2) throw new Error("Número de parcelas deve ser no mínimo 2");

        // Create parent expense
        const { data: pai, error: errPai } = await supabase.from("despesas_empresa").insert({
          descricao: novaForm.descricao,
          categoria: novaForm.categoria,
          tipo_despesa: "Variável" as any,
          valor_original: valor,
          saldo_pendente: valor,
          data_vencimento: novaForm.data_vencimento || null,
          forma_pagamento: novaForm.forma_pagamento || null,
          observacao: `Parcelado em ${numParcelas}x. ${novaForm.observacao || ""}`.trim(),
          prioridade: novaForm.prioridade as any,
          total_parcelas: numParcelas,
        } as any).select("id").single().throwOnError();
        if (errPai) throw errPai;

        // Generate parcelas
        const valorParcela = Math.floor((valor / numParcelas) * 100) / 100;
        const parcelas: any[] = [];
        const baseDate = new Date(novaForm.data_vencimento + "T12:00:00");

        for (let i = 0; i < numParcelas; i++) {
          const dt = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate());
          if (dt.getDate() !== baseDate.getDate()) dt.setDate(0);
          const isLast = i === numParcelas - 1;
          const vp = isLast ? Math.round((valor - valorParcela * (numParcelas - 1)) * 100) / 100 : valorParcela;

          parcelas.push({
            despesa_id: (pai as any).id,
            numero_parcela: i + 1,
            total_parcelas: numParcelas,
            data_vencimento: dt.toISOString().split("T")[0],
            valor: vp,
            status: dt < new Date() ? "Em Atraso" : "A Vencer",
          });
        }

        const { error: errParc } = await supabase.from("despesas_parcelas" as any).insert(parcelas).throwOnError();
        if (errParc) throw errParc;
      } else if (novaForm.tipo_pagamento === "fixo" && novaForm.data_vencimento) {
        const baseDate = new Date(novaForm.data_vencimento + "T12:00:00");
        const day = baseDate.getDate();
        const baseMonth = baseDate.getMonth();
        const baseYear = baseDate.getFullYear();
        const records = [];
        for (let m = baseMonth; m <= 11; m++) {
          const d = new Date(baseYear, m, day);
          if (d.getMonth() !== m) d.setDate(0);
          records.push({
            descricao: novaForm.descricao, categoria: novaForm.categoria, tipo_despesa: "Fixa" as any,
            valor_original: valor, saldo_pendente: valor,
            data_vencimento: d.toISOString().split("T")[0],
            forma_pagamento: novaForm.forma_pagamento || null,
            observacao: novaForm.observacao || null, prioridade: novaForm.prioridade as any,
          });
        }
        const { error } = await supabase.from("despesas_empresa").insert(records).throwOnError();
        if (error) throw error;
      } else {
        const { error } = await supabase.from("despesas_empresa").insert({
          descricao: novaForm.descricao, categoria: novaForm.categoria, tipo_despesa: tipoDespesa,
          valor_original: valor, saldo_pendente: valor,
          data_vencimento: novaForm.data_vencimento || null,
          forma_pagamento: novaForm.forma_pagamento || null,
          observacao: novaForm.observacao || null, prioridade: novaForm.prioridade as any,
        }).throwOnError();
        if (error) throw error;
      }

      // If CMV, also create stock entry
      if (novaForm.categoria === "CMV Produto Físico" && novaForm.cmv_produto) {
        const qty = parseInt(novaForm.cmv_quantidade) || 1;
        await supabase.from("estoque_cmv").insert({
          produto_descricao: novaForm.cmv_produto,
          data_compra: novaForm.cmv_data_compra || novaForm.data_vencimento || new Date().toISOString().split("T")[0],
          valor_total: valor, quantidade: qty, custo_unitario: valor / qty, valor_restante: valor,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas-empresa"] });
      queryClient.invalidateQueries({ queryKey: ["despesas-parcelas"] });
      queryClient.invalidateQueries({ queryKey: ["estoque-cmv"] });
      toast.success("Despesa criada");
      setShowNova(false);
      setNovaForm({ descricao: "", categoria: "" as any, tipo_pagamento: "unico", valor_original: "", data_vencimento: new Date().toISOString().split("T")[0], forma_pagamento: "", observacao: "", prioridade: "Média", cmv_produto: "", cmv_quantidade: "", cmv_data_compra: "", total_parcelas: "2" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const registrarPagamento = useMutation({
    mutationFn: async () => {
      if (!showPagamento) return;
      const valor = parseFloat(pgValor);
      if (isNaN(valor) || valor <= 0) throw new Error("Valor inválido");

      await supabase.from("pagamentos_parciais").insert({
        referencia_id: showPagamento.id, referencia_tipo: "despesa_empresa",
        valor_pago: valor, data_pagamento: pgData, observacao: pgObs || null,
      });

      const novoPago = (showPagamento.valor_pago_total ?? 0) + valor;
      const novoSaldo = Math.max(0, (showPagamento.valor_original ?? 0) - novoPago);
      const novoStatus = novoSaldo <= 0 ? "Pago" : "Parcialmente Pago";

      await supabase.from("despesas_empresa").update({
        valor_pago_total: novoPago, saldo_pendente: novoSaldo, status: novoStatus as any,
        data_pagamento: novoSaldo <= 0 ? pgData : showPagamento.data_pagamento,
      }).eq("id", showPagamento.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas-empresa"] });
      toast.success("Pagamento registrado");
      setShowPagamento(null); setPgValor(""); setPgObs("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const registrarPagamentoParcela = useMutation({
    mutationFn: async () => {
      if (!showPagamentoParcela) return;
      const valor = parseFloat(pgValor);
      if (isNaN(valor) || valor <= 0) throw new Error("Valor inválido");

      const parcelaValor = showPagamentoParcela.valor ?? 0;
      const novoStatus = valor >= parcelaValor ? "Pago" : "Parcialmente Pago";

      await supabase.from("despesas_parcelas" as any).update({
        status: novoStatus,
        data_pagamento: pgData,
      } as any).eq("id", showPagamentoParcela.id).throwOnError();

      // Update parent expense totals
      const despesaId = showPagamentoParcela.despesa_id;
      const { data: allParc } = await supabase.from("despesas_parcelas" as any).select("*").eq("despesa_id", despesaId);
      const parcsList = (allParc ?? []) as any[];
      const totalPago = parcsList.filter(p => p.status === "Pago").reduce((s: number, p: any) => s + (p.valor ?? 0), 0);
      const { data: parentData } = await supabase.from("despesas_empresa").select("valor_original").eq("id", despesaId).single();
      const parentValor = parentData?.valor_original ?? 0;
      const allPaid = parcsList.every(p => p.status === "Pago");

      await supabase.from("despesas_empresa").update({
        valor_pago_total: totalPago,
        saldo_pendente: Math.max(0, parentValor - totalPago),
        status: allPaid ? "Pago" as any : totalPago > 0 ? "Parcialmente Pago" as any : "A Vencer" as any,
      }).eq("id", despesaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas-empresa"] });
      queryClient.invalidateQueries({ queryKey: ["despesas-parcelas"] });
      toast.success("Parcela paga");
      setShowPagamentoParcela(null); setPgValor(""); setPgObs("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, mode }: { id: string; mode: "single" | "future" }) => {
      if (mode === "future" && deleteTarget) {
        const { error } = await supabase.from("despesas_empresa").delete()
          .eq("descricao", deleteTarget.descricao)
          .gte("data_vencimento", deleteTarget.data_vencimento ?? "");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("despesas_empresa").delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas-empresa"] });
      queryClient.invalidateQueries({ queryKey: ["despesas-parcelas"] });
      toast.success("Despesa(s) excluída(s)");
      setDeleteTarget(null);
    },
    onError: () => { toast.error("Erro ao excluir — apenas administradores"); setDeleteTarget(null); },
  });

  const editMutation = useMutation({
    mutationFn: async (mode: "single" | "future") => {
      if (!editItem) return;
      const valor = parseFloat(editForm.valor_original);
      if (!editForm.descricao || isNaN(valor)) throw new Error("Preencha campos obrigatórios");
      const baseData: any = {
        descricao: editForm.descricao, categoria: editForm.categoria, tipo_despesa: editForm.tipo_despesa,
        valor_original: valor, forma_pagamento: editForm.forma_pagamento || null, observacao: editForm.observacao || null,
        prioridade: editForm.prioridade as any,
      };
      if (mode === "future") {
        // Calcula delta de dias entre data antiga e nova para deslocar todas futuras
        let deltaDays = 0;
        if (editForm.data_vencimento && editItem.data_vencimento && editForm.data_vencimento !== editItem.data_vencimento) {
          const oldD = new Date(editItem.data_vencimento + "T00:00:00").getTime();
          const newD = new Date(editForm.data_vencimento + "T00:00:00").getTime();
          deltaDays = Math.round((newD - oldD) / 86400000);
        }
        const { data: futuras } = await supabase.from("despesas_empresa").select("id, valor_pago_total, data_vencimento")
          .eq("descricao", editItem.descricao)
          .gte("data_vencimento", editItem.data_vencimento ?? "");
        for (const f of (futuras ?? [])) {
          const saldo = valor - (f.valor_pago_total ?? 0);
          const upd: any = { ...baseData, saldo_pendente: Math.max(0, saldo) };
          if (deltaDays !== 0 && f.data_vencimento) {
            const d = new Date(f.data_vencimento + "T00:00:00");
            d.setDate(d.getDate() + deltaDays);
            upd.data_vencimento = d.toISOString().split("T")[0];
          }
          await supabase.from("despesas_empresa").update(upd).eq("id", f.id).throwOnError();
        }
      } else {
        const novoSaldo = valor - (editItem.valor_pago_total ?? 0);
        await supabase.from("despesas_empresa").update({
          ...baseData, saldo_pendente: Math.max(0, novoSaldo), data_vencimento: editForm.data_vencimento || null,
        }).eq("id", editItem.id).throwOnError();
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["despesas-empresa"] }); toast.success("Despesa(s) atualizada(s)"); setEditItem(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (d: Tables<"despesas_empresa">) => {
    setEditForm({ descricao: d.descricao, categoria: d.categoria, tipo_despesa: d.tipo_despesa, valor_original: String(d.valor_original), data_vencimento: d.data_vencimento ?? "", forma_pagamento: d.forma_pagamento ?? "", observacao: d.observacao ?? "", prioridade: (d as any).prioridade ?? "Média" });
    setEditItem(d);
  };

  // Filter logic
  const isParceladoTab = tab === "parcelado";
  const tipoFiltro = tab === "fixas" ? "Fixa" : "Variável";

  // For parcelado tab, show parent expenses that have total_parcelas
  const parceladoPais = (despesas ?? []).filter(d => (d as any).total_parcelas != null && (d as any).total_parcelas > 0);

  const filtered = (despesas ?? []).filter(d => {
    if (isParceladoTab) return false; // handled separately
    if (tab !== "cmv" && d.tipo_despesa !== tipoFiltro) return false;
    // Exclude parcelado parent expenses from fixas/variaveis tabs
    if ((d as any).total_parcelas != null && (d as any).total_parcelas > 0) return false;
    if (filtroCategoria !== "all" && d.categoria !== filtroCategoria) return false;
    if (filtroStatus !== "all" && d.status !== filtroStatus) return false;
    if (d.data_vencimento && !filterByDate(d.data_vencimento, dateFilter)) return false;
    if (search) return d.descricao.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const { start: mesStart, end: mesEnd } = getDateRange(dateFilter);
  const mesAtual = (despesas ?? []).filter(d => d.data_vencimento && d.data_vencimento >= mesStart && d.data_vencimento <= mesEnd && !((d as any).total_parcelas > 0));
  // Include parcelas from despesas_parcelas in the period for summary
  const parcelasNoPeriodo = (despesasParcelas ?? []).filter((p: any) => p.data_vencimento >= mesStart && p.data_vencimento <= mesEnd);
  const totalMes = mesAtual.reduce((s, d) => s + (d.valor_original ?? 0), 0) + parcelasNoPeriodo.reduce((s: number, p: any) => s + (p.valor ?? 0), 0);
  const pagoMes = mesAtual.reduce((s, d) => s + (d.valor_pago_total ?? 0), 0) + parcelasNoPeriodo.filter((p: any) => p.status === "Pago").reduce((s: number, p: any) => s + (p.valor ?? 0), 0);
  const emAtraso = mesAtual.filter(d => d.status === "Em Atraso").reduce((s, d) => s + (d.saldo_pendente ?? 0), 0) + parcelasNoPeriodo.filter((p: any) => p.status === "Em Atraso").reduce((s: number, p: any) => s + (p.valor ?? 0), 0);
  const pendenteMes = mesAtual.filter(d => d.status === "A Vencer").reduce((s, d) => s + (d.saldo_pendente ?? 0), 0) + parcelasNoPeriodo.filter((p: any) => p.status === "A Vencer").reduce((s: number, p: any) => s + (p.valor ?? 0), 0);

  // Vencendo essa semana (não pagas)
  const { start: semStart, end: semEnd } = getWeekRange();
  const vencendoSemana =
    (despesas ?? []).filter(d => d.data_vencimento && d.data_vencimento >= semStart && d.data_vencimento <= semEnd && d.status !== "Pago" && !((d as any).total_parcelas > 0))
      .reduce((s, d) => s + (d.saldo_pendente ?? d.valor_original ?? 0), 0) +
    (despesasParcelas ?? []).filter((p: any) => p.data_vencimento >= semStart && p.data_vencimento <= semEnd && p.status !== "Pago")
      .reduce((s: number, p: any) => s + (p.valor ?? 0), 0);


  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const renderTable = (items: typeof filtered) => (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              {["Descrição", "Categoria", "Prioridade", "Valor", "Pago", "Saldo", "Vencimento", "Pagamento", "Status", "Ações"].map(h => (
                <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${["Valor", "Pago", "Saldo"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={10} className="p-12 text-center text-muted-foreground">Nenhuma despesa encontrada</td></tr>
            )}
            {items.map(d => (
              <tr key={d.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                <td className="p-3 font-medium max-w-[200px] truncate">{d.descricao}</td>
                <td className="p-3 text-xs text-muted-foreground">{d.categoria}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${(d as any).prioridade === "Alta" ? "bg-destructive/10 text-destructive" : (d as any).prioridade === "Baixa" ? "bg-secondary text-muted-foreground" : "bg-yellow-500/10 text-yellow-400"}`}>{(d as any).prioridade ?? "Média"}</span></td>
                <td className="p-3 text-right">{formatCurrency(d.valor_original)}</td>
                <td className="p-3 text-right text-muted-foreground">{formatCurrency(d.valor_pago_total)}</td>
                <td className="p-3 text-right text-primary">{formatCurrency(d.saldo_pendente)}</td>
                <td className="p-3 text-muted-foreground">{formatDate(d.data_vencimento)}</td>
                <td className="p-3 text-muted-foreground">{formatDate(d.data_pagamento)}</td>
                <td className="p-3">
                  <Badge variant="outline" className={STATUS_STYLE[getDisplayStatus(d.status, d.data_vencimento)]}>{getDisplayStatus(d.status, d.data_vencimento)}</Badge>
                </td>
                <td className="p-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border">
                      <DropdownMenuItem onClick={() => openEdit(d)} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Editar</DropdownMenuItem>
                      {d.status !== "Pago" && (
                        <DropdownMenuItem onClick={() => { setShowPagamento(d); setPgValor(String(d.saldo_pendente ?? 0)); }} className="gap-2"><DollarSign className="h-3.5 w-3.5" /> Registrar pagamento</DropdownMenuItem>
                      )}
                      {role === "admin" && (
                        <DropdownMenuItem onClick={() => setDeleteTarget(d)} className="gap-2 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Excluir</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderParceladoTab = () => {
    const allParcelas = despesasParcelas ?? [];

    // Filter parcelado parents that have at least one parcela in this period
    const paisComParcelasNoPeriodo = parceladoPais.filter(pai => {
      const parcs = allParcelas.filter((p: any) => p.despesa_id === pai.id);
      if (search && !pai.descricao.toLowerCase().includes(search.toLowerCase())) return false;
      if (filtroCategoria !== "all" && pai.categoria !== filtroCategoria) return false;
      // Show group if ANY parcela is in period, or no date filter
      return parcs.some((p: any) => filterByDate(p.data_vencimento, dateFilter));
    });

    // Check for parcelas em atraso de meses anteriores
    const hoje = new Date();
    const primeiroDiaMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;

    return (
      <div className="space-y-3">
        {paisComParcelasNoPeriodo.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">Nenhuma despesa parcelada encontrada</div>
        )}
        {paisComParcelasNoPeriodo.map(pai => {
          const parcs = allParcelas.filter((p: any) => p.despesa_id === pai.id).sort((a: any, b: any) => a.numero_parcela - b.numero_parcela);
          const pagas = parcs.filter((p: any) => p.status === "Pago").length;
          const atrasadas = parcs.filter((p: any) => p.status === "Em Atraso").length;
          const atrasadasAntigas = parcs.filter((p: any) => p.status === "Em Atraso" && p.data_vencimento < primeiroDiaMes).length;
          const isExpanded = expandedGroups.has(pai.id);

          return (
            <div key={pai.id} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(pai.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-surface-hover transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <p className="font-medium text-foreground">{pai.descricao}</p>
                    <p className="text-xs text-muted-foreground">{pai.categoria} • {formatCurrency(pai.valor_original)} total</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {atrasadasAntigas > 0 && (
                    <span className="flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" /> {atrasadasAntigas} em atraso
                    </span>
                  )}
                  <Badge variant="outline" className={atrasadas > 0 ? STATUS_STYLE["Em Atraso"] : pagas === parcs.length ? STATUS_STYLE["Pago"] : STATUS_STYLE["A Vencer"]}>
                    {pagas}/{parcs.length} pagas
                  </Badge>
                </div>
              </button>

              {atrasadasAntigas > 0 && !isExpanded && (
                <div className="px-4 pb-3 -mt-1">
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> ⚠️ Atenção: {atrasadasAntigas} parcela(s) em atraso de meses anteriores
                  </p>
                </div>
              )}

              {/* Expanded parcelas */}
              {isExpanded && (
                <div className="border-t border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-secondary/20">
                        {["Parcela", "Vencimento", "Valor", "Status", "Pagamento", "Ações"].map(h => (
                          <th key={h} className={`p-2.5 text-xs font-medium text-muted-foreground ${h === "Valor" ? "text-right" : "text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parcs.map((p: any) => (
                        <tr key={p.id} className="border-t border-border/30 hover:bg-surface-hover transition-colors">
                          <td className="p-2.5 text-xs font-medium">P{p.numero_parcela}/{p.total_parcelas}</td>
                          <td className="p-2.5 text-xs text-muted-foreground">{formatDate(p.data_vencimento)}</td>
                          <td className="p-2.5 text-xs text-right">{formatCurrency(p.valor)}</td>
                          <td className="p-2.5">
                            <Badge variant="outline" className={`text-[10px] ${STATUS_STYLE[getDisplayStatus(p.status, p.data_vencimento)]}`}>{getDisplayStatus(p.status, p.data_vencimento)}</Badge>
                          </td>
                          <td className="p-2.5 text-xs text-muted-foreground">{formatDate(p.data_pagamento)}</td>
                          <td className="p-2.5">
                            {p.status !== "Pago" && (
                              <Button
                                size="sm" variant="ghost"
                                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => { setShowPagamentoParcela(p); setPgValor(String(p.valor ?? 0)); setPgData(new Date().toISOString().split("T")[0]); }}
                              >
                                <DollarSign className="h-3 w-3 mr-1" /> Pagar
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Valor por parcela preview
  const valorTotal = parseFloat(novaForm.valor_original) || 0;
  const numParcelas = parseInt(novaForm.total_parcelas) || 2;
  const valorParcela = numParcelas > 0 ? valorTotal / numParcelas : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Despesas — Empresa</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              const label = dateFilter.type === "month" ? dateFilter.key : `${dateFilter.start}_${dateFilter.end}`;
              exportCsv(`despesas-empresa-${label}.csv`,
                ["Descrição", "Categoria", "Tipo", "Valor Original", "Valor Pago", "Saldo Pendente", "Vencimento", "Pagamento", "Status", "Prioridade", "Forma Pgto", "Observação"],
                filtered.map(d => [d.descricao, d.categoria, d.tipo_despesa, d.valor_original, d.valor_pago_total, d.saldo_pendente, d.data_vencimento, d.data_pagamento, d.status, d.prioridade, d.forma_pagamento, d.observacao])
              );
            }}
            variant="outline" size="sm" className="border-border text-muted-foreground hover:text-foreground"
          >
            <Download className="h-4 w-4 mr-1.5" /> CSV
          </Button>
          <Button onClick={() => setShowNova(true)} className="gold-gradient text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Nova despesa
          </Button>
        </div>
      </div>

      <MonthNavigator filter={dateFilter} onChange={setDateFilter} />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total do período", value: formatCurrency(totalMes) },
          { label: "Pago", value: formatCurrency(pagoMes) },
          { label: "Em atraso", value: formatCurrency(emAtraso), alert: emAtraso > 0 },
          { label: "Pendente", value: formatCurrency(pendenteMes) },
          { label: "Vencendo essa semana", value: formatCurrency(vencendoSemana), highlight: vencendoSemana > 0 },
        ].map((c: any) => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.alert ? "border-destructive/30 bg-destructive/5" : c.highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</p>
            <p className={`text-lg font-bold mt-1 ${c.alert ? "text-destructive" : c.highlight ? "text-primary" : "text-foreground"}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="fixas">Fixas</TabsTrigger>
          <TabsTrigger value="variaveis">Variáveis</TabsTrigger>
          <TabsTrigger value="parcelado">Parcelado</TabsTrigger>
          <TabsTrigger value="cmv">CMV</TabsTrigger>
        </TabsList>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border" />
          </div>
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-[200px] bg-secondary/50 border-border"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[160px] bg-secondary/50 border-border"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Constants.public.Enums.status_despesa.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="fixas">{isLoading ? <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : renderTable(filtered)}</TabsContent>
        <TabsContent value="variaveis">{isLoading ? <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : renderTable(filtered)}</TabsContent>
        <TabsContent value="parcelado">{isLoading ? <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : renderParceladoTab()}</TabsContent>
        <TabsContent value="cmv">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {["Produto", "Data Compra", "Valor Total", "Absorvido", "Restante", "Margem"].map(h => (
                      <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${["Valor Total", "Absorvido", "Restante", "Margem"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(estoque ?? []).length === 0 && (
                    <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">Nenhum lote de estoque</td></tr>
                  )}
                  {(estoque ?? []).map(e => {
                    const margemPct = e.valor_total > 0 ? ((e.valor_absorvido ?? 0) / e.valor_total * 100) : 0;
                    return (
                      <tr key={e.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                        <td className="p-3 font-medium">{e.produto_descricao}</td>
                        <td className="p-3 text-muted-foreground">{formatDate(e.data_compra)}</td>
                        <td className="p-3 text-right">{formatCurrency(e.valor_total)}</td>
                        <td className="p-3 text-right text-muted-foreground">{formatCurrency(e.valor_absorvido)}</td>
                        <td className="p-3 text-right text-primary">{formatCurrency(e.valor_restante)}</td>
                        <td className="p-3 text-right text-muted-foreground">{margemPct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* New expense modal */}
      <Dialog open={showNova} onOpenChange={setShowNova}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-foreground">Nova Despesa — Empresa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Descrição *</Label>
              <Input value={novaForm.descricao} onChange={e => setNovaForm(f => ({ ...f, descricao: e.target.value }))} className="bg-secondary/50 border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground">Categoria *</Label>
                <Select value={novaForm.categoria} onValueChange={v => setNovaForm(f => ({ ...f, categoria: v as any }))}>
                  <SelectTrigger className="bg-secondary/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-muted-foreground">Tipo de Pagamento</Label>
                <Select value={novaForm.tipo_pagamento} onValueChange={v => setNovaForm(f => ({ ...f, tipo_pagamento: v as TipoPagamento }))}>
                  <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(TIPO_PAGAMENTO_LABELS) as [TipoPagamento, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Prioridade</Label>
              <Select value={novaForm.prioridade} onValueChange={v => setNovaForm(f => ({ ...f, prioridade: v as any }))}>
                <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alta">🔴 Alta</SelectItem>
                  <SelectItem value="Média">🟡 Média</SelectItem>
                  <SelectItem value="Baixa">⚪ Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground">{novaForm.tipo_pagamento === "parcelado" ? "Valor Total *" : "Valor *"}</Label>
                <Input type="number" value={novaForm.valor_original} onChange={e => setNovaForm(f => ({ ...f, valor_original: e.target.value }))} className="bg-secondary/50 border-border" />
              </div>
              <div>
                <Label className="text-muted-foreground">{novaForm.tipo_pagamento === "parcelado" ? "Data 1ª Parcela" : "Data Vencimento"}</Label>
                <Input type="date" value={novaForm.data_vencimento} onChange={e => setNovaForm(f => ({ ...f, data_vencimento: e.target.value }))} className="bg-secondary/50 border-border" />
              </div>
            </div>

            {novaForm.tipo_pagamento === "parcelado" && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
                <p className="text-xs font-medium text-primary">Detalhes do Parcelamento</p>
                <div>
                  <Label className="text-muted-foreground">Número de parcelas *</Label>
                  <Input type="number" min={2} value={novaForm.total_parcelas} onChange={e => setNovaForm(f => ({ ...f, total_parcelas: e.target.value }))} className="bg-secondary/50 border-border" />
                </div>
                {valorTotal > 0 && numParcelas >= 2 && (
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">
                      {numParcelas}x de <span className="text-foreground font-medium">{formatCurrency(valorParcela)}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Parcelas mensais a partir de {novaForm.data_vencimento ? formatDate(novaForm.data_vencimento) : "—"}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label className="text-muted-foreground">Forma de Pagamento</Label>
              <Input value={novaForm.forma_pagamento} onChange={e => setNovaForm(f => ({ ...f, forma_pagamento: e.target.value }))} className="bg-secondary/50 border-border" />
            </div>
            {novaForm.categoria === "CMV Produto Físico" && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
                <p className="text-xs font-medium text-primary">Dados do Estoque (CMV)</p>
                <div>
                  <Label className="text-muted-foreground">Nome do produto/insumo *</Label>
                  <Input value={novaForm.cmv_produto} onChange={e => setNovaForm(f => ({ ...f, cmv_produto: e.target.value }))} className="bg-secondary/50 border-border" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-muted-foreground">Quantidade</Label>
                    <Input type="number" value={novaForm.cmv_quantidade} onChange={e => setNovaForm(f => ({ ...f, cmv_quantidade: e.target.value }))} className="bg-secondary/50 border-border" />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Data da compra</Label>
                    <Input type="date" value={novaForm.cmv_data_compra} onChange={e => setNovaForm(f => ({ ...f, cmv_data_compra: e.target.value }))} className="bg-secondary/50 border-border" />
                  </div>
                </div>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground">Observação</Label>
              <Textarea value={novaForm.observacao} onChange={e => setNovaForm(f => ({ ...f, observacao: e.target.value }))} className="bg-secondary/50 border-border" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNova(false)} className="border-border">Cancelar</Button>
            <Button onClick={() => criarDespesa.mutate()} disabled={criarDespesa.isPending} className="gold-gradient text-primary-foreground">
              {criarDespesa.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment modal - regular expenses */}
      <Dialog open={!!showPagamento} onOpenChange={() => setShowPagamento(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Registrar Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-muted-foreground">Valor</Label><Input type="number" value={pgValor} onChange={e => setPgValor(e.target.value)} className="bg-secondary/50 border-border" /></div>
            <div><Label className="text-muted-foreground">Data</Label><Input type="date" value={pgData} onChange={e => setPgData(e.target.value)} className="bg-secondary/50 border-border" /></div>
            <div><Label className="text-muted-foreground">Observação</Label><Textarea value={pgObs} onChange={e => setPgObs(e.target.value)} className="bg-secondary/50 border-border" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPagamento(null)} className="border-border">Cancelar</Button>
            <Button onClick={() => registrarPagamento.mutate()} disabled={registrarPagamento.isPending} className="gold-gradient text-primary-foreground">
              {registrarPagamento.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment modal - parcela de despesa */}
      <Dialog open={!!showPagamentoParcela} onOpenChange={() => setShowPagamentoParcela(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Pagar Parcela {showPagamentoParcela?.numero_parcela}/{showPagamentoParcela?.total_parcelas}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Valor da parcela: <span className="text-foreground font-medium">{formatCurrency(showPagamentoParcela?.valor ?? 0)}</span></p>
              <p className="text-xs text-muted-foreground">Vencimento: {formatDate(showPagamentoParcela?.data_vencimento)}</p>
            </div>
            <div><Label className="text-muted-foreground">Valor pago</Label><Input type="number" value={pgValor} onChange={e => setPgValor(e.target.value)} className="bg-secondary/50 border-border" /></div>
            <div><Label className="text-muted-foreground">Data pagamento</Label><Input type="date" value={pgData} onChange={e => setPgData(e.target.value)} className="bg-secondary/50 border-border" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPagamentoParcela(null)} className="border-border">Cancelar</Button>
            <Button onClick={() => registrarPagamentoParcela.mutate()} disabled={registrarPagamentoParcela.isPending} className="gold-gradient text-primary-foreground">
              {registrarPagamentoParcela.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Editar Despesa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-muted-foreground">Descrição *</Label><Input value={editForm.descricao} onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))} className="bg-secondary/50 border-border" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-muted-foreground">Categoria</Label>
                <Select value={editForm.categoria} onValueChange={v => setEditForm(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-muted-foreground">Tipo</Label>
                <Select value={editForm.tipo_despesa} onValueChange={v => setEditForm(f => ({ ...f, tipo_despesa: v }))}>
                  <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Fixa">Fixa</SelectItem><SelectItem value="Variável">Variável</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-muted-foreground">Valor *</Label><Input type="number" value={editForm.valor_original} onChange={e => setEditForm(f => ({ ...f, valor_original: e.target.value }))} className="bg-secondary/50 border-border" /></div>
              <div><Label className="text-muted-foreground">Data Vencimento</Label><Input type="date" value={editForm.data_vencimento} onChange={e => setEditForm(f => ({ ...f, data_vencimento: e.target.value }))} className="bg-secondary/50 border-border" /></div>
            </div>
            <div><Label className="text-muted-foreground">Forma de Pagamento</Label><Input value={editForm.forma_pagamento} onChange={e => setEditForm(f => ({ ...f, forma_pagamento: e.target.value }))} className="bg-secondary/50 border-border" /></div>
            <div>
              <Label className="text-muted-foreground">Prioridade</Label>
              <Select value={editForm.prioridade} onValueChange={v => setEditForm(f => ({ ...f, prioridade: v as any }))}>
                <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alta">🔴 Alta</SelectItem>
                  <SelectItem value="Média">🟡 Média</SelectItem>
                  <SelectItem value="Baixa">⚪ Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-muted-foreground">Observação</Label><Textarea value={editForm.observacao} onChange={e => setEditForm(f => ({ ...f, observacao: e.target.value }))} className="bg-secondary/50 border-border" rows={2} /></div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setEditItem(null)} className="border-border">Cancelar</Button>
            <Button onClick={() => editMutation.mutate("single")} disabled={editMutation.isPending} className="gold-gradient text-primary-foreground">
              {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar somente esta"}
            </Button>
            <Button onClick={() => editMutation.mutate("future")} disabled={editMutation.isPending} variant="secondary">
              {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar esta e futuras"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation modal */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Excluir Despesa</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Como deseja excluir <strong className="text-foreground">"{deleteTarget?.descricao}"</strong>?
          </p>
          <div className="flex flex-col gap-2 mt-2">
            <Button variant="outline" className="border-border justify-start"
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id, mode: "single" })}
              disabled={deleteMutation.isPending}>
              Excluir somente esta
            </Button>
            <Button variant="destructive" className="justify-start"
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id, mode: "future" })}
              disabled={deleteMutation.isPending}>
              Excluir esta e todas futuras com mesmo nome
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="text-muted-foreground">Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
