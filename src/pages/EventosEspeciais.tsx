import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Loader2, ArrowLeft, DollarSign, Trash2, CalendarDays, PartyPopper, MoreHorizontal, Pencil, Download, Gift } from "lucide-react";
import { exportCsv } from "@/lib/exportCsv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Tables } from "@/integrations/supabase/types";

const STATUS_STYLE: Record<string, string> = {
  "A Vencer": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "Pago": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Em Atraso": "bg-destructive/10 text-destructive border-destructive/20",
  "Parcialmente Pago": "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const CATEGORIA_STYLE: Record<string, string> = {
  "Fechado": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Precisa Fechar": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "Pago/Presente": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

function getEventStatus(dataEvento: string | null) {
  if (!dataEvento) return { label: "Sem data", className: "bg-muted text-muted-foreground" };
  const d = new Date(dataEvento + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (d > now) return { label: "Futuro", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
  if (d.toDateString() === now.toDateString()) return { label: "Hoje", className: "bg-primary/10 text-primary border-primary/20" };
  return { label: "Concluído", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
}

export default function EventosEspeciais() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEvento, setSelectedEvento] = useState<Tables<"eventos_especiais"> | null>(null);
  const [showNovoEvento, setShowNovoEvento] = useState(false);
  const [eventoForm, setEventoForm] = useState({ nome: "", data_evento: "", descricao: "" });
  const [showNovaDespesa, setShowNovaDespesa] = useState(false);
  const [despesaForm, setDespesaForm] = useState({ descricao: "", valor_original: "", data_vencimento: "", observacao: "", categoria_evento: "Fechado" });
  const [showPagamento, setShowPagamento] = useState<Tables<"eventos_despesas"> | null>(null);
  const [pgValor, setPgValor] = useState("");
  const [pgData, setPgData] = useState(new Date().toISOString().split("T")[0]);
  const [pgObs, setPgObs] = useState("");
  const [pgDestino, setPgDestino] = useState<"empresa" | "pessoal">("empresa");

  // Edit event expense
  const [editDespesa, setEditDespesa] = useState<Tables<"eventos_despesas"> | null>(null);
  const [editDespForm, setEditDespForm] = useState({ descricao: "", valor_original: "", data_vencimento: "", observacao: "", categoria_evento: "Fechado" });

  // Presentes em dinheiro
  const [showNovoPresente, setShowNovoPresente] = useState(false);
  const [presenteForm, setPresenteForm] = useState({ de_quem: "", valor: "", data_recebimento: "", observacao: "" });
  const [editPresente, setEditPresente] = useState<any | null>(null);
  const [editPresenteForm, setEditPresenteForm] = useState({ de_quem: "", valor: "", data_recebimento: "", observacao: "" });

  const { data: eventos, isLoading } = useQuery({
    queryKey: ["eventos-especiais"],
    queryFn: async () => {
      const { data, error } = await supabase.from("eventos_especiais").select("*").order("data_evento", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: todasDespesas } = useQuery({
    queryKey: ["eventos-despesas-all"],
    queryFn: async () => {
      const { data } = await supabase.from("eventos_despesas").select("*");
      return data ?? [];
    },
  });

  const { data: despesasEvento } = useQuery({
    queryKey: ["eventos-despesas", selectedEvento?.id],
    enabled: !!selectedEvento,
    queryFn: async () => {
      const { data, error } = await supabase.from("eventos_despesas").select("*").eq("evento_id", selectedEvento!.id).order("data_vencimento");
      if (error) throw error;
      return data;
    },
  });

  const { data: presentesEvento } = useQuery({
    queryKey: ["eventos-presentes", selectedEvento?.id],
    enabled: !!selectedEvento,
    queryFn: async () => {
      const { data, error } = await supabase.from("eventos_presentes" as any).select("*").eq("evento_id", selectedEvento!.id).order("criado_em");
      if (error) throw error;
      return data as any[];
    },
  });

  const criarEvento = useMutation({
    mutationFn: async () => {
      if (!eventoForm.nome) throw new Error("Nome obrigatório");
      const { error } = await supabase.from("eventos_especiais").insert({ nome: eventoForm.nome, data_evento: eventoForm.data_evento || null, descricao: eventoForm.descricao || null });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["eventos-especiais"] }); toast.success("Evento criado"); setShowNovoEvento(false); setEventoForm({ nome: "", data_evento: "", descricao: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const criarDespesaEvento = useMutation({
    mutationFn: async () => {
      if (!selectedEvento) return;
      const valor = parseFloat(despesaForm.valor_original);
      if (!despesaForm.descricao || isNaN(valor)) throw new Error("Preencha campos obrigatórios");
      const statusInicial = despesaForm.categoria_evento === "Pago/Presente" ? "Pago" : "A Vencer";
      const { error } = await supabase.from("eventos_despesas").insert({
        evento_id: selectedEvento.id, descricao: despesaForm.descricao, valor_original: valor,
        saldo_pendente: despesaForm.categoria_evento === "Pago/Presente" ? 0 : valor,
        valor_pago_total: despesaForm.categoria_evento === "Pago/Presente" ? valor : 0,
        data_vencimento: despesaForm.data_vencimento || null, observacao: despesaForm.observacao || null,
        status: statusInicial as any, categoria_evento: despesaForm.categoria_evento as any,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["eventos-despesas"] }); queryClient.invalidateQueries({ queryKey: ["eventos-despesas-all"] }); toast.success("Item adicionado"); setShowNovaDespesa(false); setDespesaForm({ descricao: "", valor_original: "", data_vencimento: "", observacao: "", categoria_evento: "Fechado" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const registrarPagamento = useMutation({
    mutationFn: async () => {
      if (!showPagamento) return;
      const valor = parseFloat(pgValor);
      if (isNaN(valor) || valor <= 0) throw new Error("Valor inválido");
      await supabase.from("pagamentos_parciais").insert({ referencia_id: showPagamento.id, referencia_tipo: "evento_despesa", valor_pago: valor, data_pagamento: pgData, observacao: pgObs || null });
      const novoPago = (showPagamento.valor_pago_total ?? 0) + valor;
      const novoSaldo = Math.max(0, (showPagamento.valor_original ?? 0) - novoPago);
      const novoStatus = novoSaldo <= 0 ? "Pago" : "Parcialmente Pago";
      await supabase.from("eventos_despesas").update({ valor_pago_total: novoPago, saldo_pendente: novoSaldo, status: novoStatus as any, data_pagamento: novoSaldo <= 0 ? pgData : showPagamento.data_pagamento }).eq("id", showPagamento.id);

      // Lançar como despesa variável na tabela correspondente
      const eventoNome = selectedEvento?.nome ?? "Evento";
      const descDespesa = `${eventoNome} — ${showPagamento.descricao}`;
      if (pgDestino === "empresa") {
        await supabase.from("despesas_empresa").insert({
          descricao: descDespesa, valor_original: valor, valor_pago_total: valor, saldo_pendente: 0,
          tipo_despesa: "Variável", categoria: "Variável" as any, status: "Pago" as any,
          data_vencimento: pgData, data_pagamento: pgData, observacao: pgObs || null,
        });
      } else {
        await supabase.from("despesas_pessoal").insert({
          descricao: descDespesa, valor_original: valor, valor_pago_total: valor, saldo_pendente: 0,
          tipo_despesa: "Variável", categoria: "Outros" as any, status: "Pago" as any,
          data_vencimento: pgData, data_pagamento: pgData, observacao: pgObs || null,
        });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["eventos-despesas"] }); queryClient.invalidateQueries({ queryKey: ["eventos-despesas-all"] }); toast.success("Pagamento registrado e despesa lançada"); setShowPagamento(null); setPgValor(""); setPgObs(""); setPgDestino("empresa"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteEvento = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("eventos_especiais").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["eventos-especiais"] }); toast.success("Evento excluído"); },
    onError: () => toast.error("Erro ao excluir — apenas administradores"),
  });

  const deleteDespEvento = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("eventos_despesas").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["eventos-despesas"] }); queryClient.invalidateQueries({ queryKey: ["eventos-despesas-all"] }); toast.success("Item excluído"); },
    onError: () => toast.error("Erro ao excluir — apenas administradores"),
  });

  const editDespMutation = useMutation({
    mutationFn: async () => {
      if (!editDespesa) return;
      const valor = parseFloat(editDespForm.valor_original);
      if (!editDespForm.descricao || isNaN(valor)) throw new Error("Preencha campos obrigatórios");
      const novoSaldo = valor - (editDespesa.valor_pago_total ?? 0);
      const novoStatus = novoSaldo <= 0 ? "Pago" : (editDespesa.valor_pago_total ?? 0) > 0 ? "Parcialmente Pago" : editDespForm.categoria_evento === "Pago/Presente" ? "Pago" : "A Vencer";
      const { error } = await supabase.from("eventos_despesas").update({
        descricao: editDespForm.descricao, valor_original: valor, saldo_pendente: Math.max(0, novoSaldo),
        data_vencimento: editDespForm.data_vencimento || null, observacao: editDespForm.observacao || null,
        categoria_evento: editDespForm.categoria_evento as any, status: novoStatus as any,
      }).eq("id", editDespesa.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["eventos-despesas"] }); queryClient.invalidateQueries({ queryKey: ["eventos-despesas-all"] }); toast.success("Item atualizado"); setEditDespesa(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEditDesp = (d: Tables<"eventos_despesas">) => {
    setEditDespForm({ descricao: d.descricao, valor_original: String(d.valor_original), data_vencimento: d.data_vencimento ?? "", observacao: d.observacao ?? "", categoria_evento: (d as any).categoria_evento ?? "Fechado" });
    setEditDespesa(d);
  };

  const criarPresente = useMutation({
    mutationFn: async () => {
      if (!selectedEvento) return;
      const valor = parseFloat(presenteForm.valor);
      if (!presenteForm.de_quem || isNaN(valor)) throw new Error("Preencha nome e valor");
      const { error } = await supabase.from("eventos_presentes" as any).insert({
        evento_id: selectedEvento.id, de_quem: presenteForm.de_quem, valor,
        data_recebimento: presenteForm.data_recebimento || null, observacao: presenteForm.observacao || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["eventos-presentes"] }); toast.success("Presente adicionado"); setShowNovoPresente(false); setPresenteForm({ de_quem: "", valor: "", data_recebimento: "", observacao: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const editPresenteMutation = useMutation({
    mutationFn: async () => {
      if (!editPresente) return;
      const valor = parseFloat(editPresenteForm.valor);
      if (!editPresenteForm.de_quem || isNaN(valor)) throw new Error("Preencha nome e valor");
      const { error } = await supabase.from("eventos_presentes" as any).update({
        de_quem: editPresenteForm.de_quem, valor,
        data_recebimento: editPresenteForm.data_recebimento || null, observacao: editPresenteForm.observacao || null,
      } as any).eq("id", editPresente.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["eventos-presentes"] }); toast.success("Presente atualizado"); setEditPresente(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePresente = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("eventos_presentes" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["eventos-presentes"] }); toast.success("Presente excluído"); },
    onError: () => toast.error("Erro ao excluir"),
  });

  const getEventTotals = (eventoId: string) => {
    const deps = (todasDespesas ?? []).filter(d => d.evento_id === eventoId);
    const total = deps.reduce((s, d) => s + (d.valor_original ?? 0), 0);
    const pago = deps.reduce((s, d) => s + (d.valor_pago_total ?? 0), 0);
    return { total, pago, falta: total - pago, progresso: total > 0 ? (pago / total) * 100 : 0 };
  };

  // Detail view
  if (selectedEvento) {
    const deps = despesasEvento ?? [];
    const fechado = deps.filter(d => (d as any).categoria_evento === "Fechado");
    const precisaFechar = deps.filter(d => (d as any).categoria_evento === "Precisa Fechar");
    const pagoPresente = deps.filter(d => (d as any).categoria_evento === "Pago/Presente");

    const totalFechado = fechado.reduce((s, d) => s + (d.valor_original ?? 0), 0);
    const totalPagoFechado = fechado.reduce((s, d) => s + (d.valor_pago_total ?? 0), 0);
    const faltaFechado = totalFechado - totalPagoFechado;
    const totalPrecisaFechar = precisaFechar.reduce((s, d) => s + (d.valor_original ?? 0), 0);
    const totalPago = deps.reduce((s, d) => s + (d.valor_pago_total ?? 0), 0);

    const renderDespesaTable = (items: typeof deps, title: string, badgeCls: string) => (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          {title} <Badge variant="outline" className={badgeCls}>{items.length}</Badge>
        </h3>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground p-4">Nenhum item</p>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-secondary/30">
                {["Descrição", "Data PGT", "Valor Total", "Valor Pago", "Status", ""].map(h => (
                  <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${["Valor Total", "Valor Pago"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {items.map(d => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                    <td className="p-3 font-medium">{d.descricao}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(d.data_vencimento)}</td>
                    <td className="p-3 text-right">{formatCurrency(d.valor_original)}</td>
                    <td className="p-3 text-right text-muted-foreground">{formatCurrency(d.valor_pago_total)}</td>
                    <td className="p-3"><Badge variant="outline" className={STATUS_STYLE[d.status ?? "A Vencer"] ?? STATUS_STYLE["A Vencer"]}>{d.status}</Badge></td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><button className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><MoreHorizontal className="h-4 w-4" /></button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border">
                          <DropdownMenuItem onClick={() => openEditDesp(d)} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Editar</DropdownMenuItem>
                          {d.status !== "Pago" && <DropdownMenuItem onClick={() => { setShowPagamento(d); setPgValor(String(d.saldo_pendente ?? 0)); }} className="gap-2"><DollarSign className="h-3.5 w-3.5" /> Registrar pagamento</DropdownMenuItem>}
                          {role === "admin" && <DropdownMenuItem onClick={() => { if (confirm("Excluir este item?")) deleteDespEvento.mutate(d.id); }} className="gap-2 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Excluir</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedEvento(null)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-xl font-bold text-foreground">{selectedEvento.nome}</h1>
          {selectedEvento.data_evento && <span className="text-sm text-muted-foreground">{formatDate(selectedEvento.data_evento)}</span>}
        </div>

        {selectedEvento.descricao && <p className="text-sm text-muted-foreground">{selectedEvento.descricao}</p>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase">Total Fechado</p>
            <p className="text-lg font-bold text-foreground mt-1">{formatCurrency(totalFechado)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase">Total Pago</p>
            <p className="text-lg font-bold text-emerald-400 mt-1">{formatCurrency(totalPago)}</p>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs text-muted-foreground uppercase">Falta Pagar (fechado)</p>
            <p className="text-lg font-bold text-primary mt-1">{formatCurrency(faltaFechado)}</p>
          </div>
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
            <p className="text-xs text-muted-foreground uppercase">Precisa Fechar</p>
            <p className="text-lg font-bold text-yellow-400 mt-1">{formatCurrency(totalPrecisaFechar)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Itens do Evento</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              className="border-border text-muted-foreground hover:text-foreground"
              onClick={() => {
                const rows = deps.map(d => [
                  d.descricao,
                  (d as any).categoria_evento,
                  d.data_vencimento,
                  d.data_pagamento,
                  d.valor_original,
                  d.valor_pago_total,
                  d.saldo_pendente,
                  d.status,
                  d.observacao,
                ]);
                exportCsv(
                  `evento-${selectedEvento.nome.replace(/\s+/g, "-").toLowerCase()}.csv`,
                  ["Descrição", "Categoria", "Data Vencimento", "Data Pagamento", "Valor Original", "Valor Pago", "Saldo Pendente", "Status", "Observação"],
                  rows
                );
              }}
            >
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
            <Button onClick={() => setShowNovaDespesa(true)} size="sm" className="gold-gradient text-primary-foreground">
              <Plus className="h-4 w-4 mr-1" /> Novo item
            </Button>
          </div>
        </div>

        {renderDespesaTable(fechado, "Fechado", CATEGORIA_STYLE["Fechado"])}
        {renderDespesaTable(precisaFechar, "Precisa Fechar", CATEGORIA_STYLE["Precisa Fechar"])}
        {renderDespesaTable(pagoPresente, "Pago/Presente", CATEGORIA_STYLE["Pago/Presente"])}

        <Dialog open={showNovaDespesa} onOpenChange={setShowNovaDespesa}>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle className="text-foreground">Novo Item do Evento</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label className="text-muted-foreground">Descrição *</Label><Input value={despesaForm.descricao} onChange={e => setDespesaForm(f => ({ ...f, descricao: e.target.value }))} className="bg-secondary/50 border-border" /></div>
              <div><Label className="text-muted-foreground">Categoria *</Label>
                <Select value={despesaForm.categoria_evento} onValueChange={v => setDespesaForm(f => ({ ...f, categoria_evento: v }))}>
                  <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fechado">Fechado</SelectItem>
                    <SelectItem value="Precisa Fechar">Precisa Fechar</SelectItem>
                    <SelectItem value="Pago/Presente">Pago/Presente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground">Valor *</Label><Input type="number" value={despesaForm.valor_original} onChange={e => setDespesaForm(f => ({ ...f, valor_original: e.target.value }))} className="bg-secondary/50 border-border" /></div>
                <div><Label className="text-muted-foreground">Data pagamento</Label><Input type="date" value={despesaForm.data_vencimento} onChange={e => setDespesaForm(f => ({ ...f, data_vencimento: e.target.value }))} className="bg-secondary/50 border-border" /></div>
              </div>
              <div><Label className="text-muted-foreground">Observação</Label><Textarea value={despesaForm.observacao} onChange={e => setDespesaForm(f => ({ ...f, observacao: e.target.value }))} className="bg-secondary/50 border-border" rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNovaDespesa(false)} className="border-border">Cancelar</Button>
              <Button onClick={() => criarDespesaEvento.mutate()} disabled={criarDespesaEvento.isPending} className="gold-gradient text-primary-foreground">
                {criarDespesaEvento.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!showPagamento} onOpenChange={() => setShowPagamento(null)}>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle className="text-foreground">Registrar Pagamento</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label className="text-muted-foreground">Valor</Label><Input type="number" value={pgValor} onChange={e => setPgValor(e.target.value)} className="bg-secondary/50 border-border" /></div>
              <div><Label className="text-muted-foreground">Data</Label><Input type="date" value={pgData} onChange={e => setPgData(e.target.value)} className="bg-secondary/50 border-border" /></div>
              <div>
                <Label className="text-muted-foreground">Lançar despesa em</Label>
                <Select value={pgDestino} onValueChange={v => setPgDestino(v as "empresa" | "pessoal")}>
                  <SelectTrigger className="bg-secondary/50 border-border mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="empresa">Despesas da Empresa (Variável)</SelectItem>
                    <SelectItem value="pessoal">Despesas Pessoais (Variável)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

        {/* Edit event expense modal */}
        <Dialog open={!!editDespesa} onOpenChange={() => setEditDespesa(null)}>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle className="text-foreground">Editar Item do Evento</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label className="text-muted-foreground">Descrição *</Label><Input value={editDespForm.descricao} onChange={e => setEditDespForm(f => ({ ...f, descricao: e.target.value }))} className="bg-secondary/50 border-border" /></div>
              <div><Label className="text-muted-foreground">Categoria *</Label>
                <Select value={editDespForm.categoria_evento} onValueChange={v => setEditDespForm(f => ({ ...f, categoria_evento: v }))}>
                  <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fechado">Fechado</SelectItem>
                    <SelectItem value="Precisa Fechar">Precisa Fechar</SelectItem>
                    <SelectItem value="Pago/Presente">Pago/Presente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground">Valor *</Label><Input type="number" value={editDespForm.valor_original} onChange={e => setEditDespForm(f => ({ ...f, valor_original: e.target.value }))} className="bg-secondary/50 border-border" /></div>
                <div><Label className="text-muted-foreground">Data pagamento</Label><Input type="date" value={editDespForm.data_vencimento} onChange={e => setEditDespForm(f => ({ ...f, data_vencimento: e.target.value }))} className="bg-secondary/50 border-border" /></div>
              </div>
              <div><Label className="text-muted-foreground">Observação</Label><Textarea value={editDespForm.observacao} onChange={e => setEditDespForm(f => ({ ...f, observacao: e.target.value }))} className="bg-secondary/50 border-border" rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDespesa(null)} className="border-border">Cancelar</Button>
              <Button onClick={() => editDespMutation.mutate()} disabled={editDespMutation.isPending} className="gold-gradient text-primary-foreground">
                {editDespMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Grid view
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Eventos Especiais</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              const allEvts = eventos ?? [];
              const allDesp = todasDespesas ?? [];
              const evtRows = allEvts.flatMap(ev => {
                const desp = allDesp.filter(d => d.evento_id === ev.id);
                if (desp.length === 0) return [[ev.nome, ev.data_evento, ev.descricao, "", "", "", "", ""]];
                return desp.map(d => [ev.nome, ev.data_evento, ev.descricao, d.descricao, d.categoria_evento, d.valor_original, d.valor_pago_total, d.status]);
              });
              exportCsv("eventos-especiais.csv",
                ["Evento", "Data Evento", "Descrição Evento", "Despesa", "Categoria", "Valor Original", "Valor Pago", "Status"],
                evtRows
              );
            }}
            variant="outline" size="sm" className="border-border text-muted-foreground hover:text-foreground"
          >
            <Download className="h-4 w-4 mr-1.5" /> CSV
          </Button>
          <Button onClick={() => setShowNovoEvento(true)} className="gold-gradient text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Novo evento
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (eventos ?? []).length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <PartyPopper className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum evento cadastrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(eventos ?? []).map(ev => {
            const { total, pago, falta, progresso } = getEventTotals(ev.id);
            const status = getEventStatus(ev.data_evento);
            return (
              <div key={ev.id} className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors cursor-pointer space-y-4" onClick={() => setSelectedEvento(ev)}>
                  <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{ev.nome}</h3>
                    {ev.data_evento && <div className="flex items-center gap-1.5 mt-1"><CalendarDays className="h-3 w-3 text-muted-foreground" /><span className="text-xs text-muted-foreground">{formatDate(ev.data_evento)}</span></div>}
                    {ev.data_evento && (() => {
                      const eventDate = new Date(ev.data_evento + "T00:00:00");
                      const today = new Date(); today.setHours(0,0,0,0);
                      const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / 86400000);
                      return diffDays > 0 
                        ? <p className="text-xs text-primary mt-0.5">Faltam {diffDays} dia{diffDays !== 1 ? "s" : ""}</p>
                        : diffDays === 0 
                        ? <p className="text-xs text-primary font-medium mt-0.5">Hoje!</p>
                        : <p className="text-xs text-muted-foreground mt-0.5">Há {Math.abs(diffDays)} dia{Math.abs(diffDays) !== 1 ? "s" : ""}</p>;
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={status.className}>{status.label}</Badge>
                    {role === "admin" && <button onClick={e => { e.stopPropagation(); if (confirm("Excluir evento?")) deleteEvento.mutate(ev.id); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Previsto: {formatCurrency(total)}</span>
                    <span className="text-muted-foreground">Pago: {formatCurrency(pago)}</span>
                  </div>
                  <Progress value={progresso} className="h-2" />
                  <p className="text-xs text-primary">Falta: {formatCurrency(falta)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showNovoEvento} onOpenChange={setShowNovoEvento}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Novo Evento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-muted-foreground">Nome *</Label><Input value={eventoForm.nome} onChange={e => setEventoForm(f => ({ ...f, nome: e.target.value }))} className="bg-secondary/50 border-border" /></div>
            <div><Label className="text-muted-foreground">Data do evento</Label><Input type="date" value={eventoForm.data_evento} onChange={e => setEventoForm(f => ({ ...f, data_evento: e.target.value }))} className="bg-secondary/50 border-border" /></div>
            <div><Label className="text-muted-foreground">Descrição</Label><Textarea value={eventoForm.descricao} onChange={e => setEventoForm(f => ({ ...f, descricao: e.target.value }))} className="bg-secondary/50 border-border" rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNovoEvento(false)} className="border-border">Cancelar</Button>
            <Button onClick={() => criarEvento.mutate()} disabled={criarEvento.isPending} className="gold-gradient text-primary-foreground">
              {criarEvento.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar evento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
