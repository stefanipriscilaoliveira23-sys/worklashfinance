import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Loader2, ArrowLeft, DollarSign, Trash2, CalendarDays, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/integrations/supabase/types";

const STATUS_STYLE: Record<string, string> = {
  "A Vencer": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "Pago": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Em Atraso": "bg-destructive/10 text-destructive border-destructive/20",
  "Parcialmente Pago": "bg-orange-500/10 text-orange-400 border-orange-500/20",
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

  // New event modal
  const [showNovoEvento, setShowNovoEvento] = useState(false);
  const [eventoForm, setEventoForm] = useState({ nome: "", data_evento: "", descricao: "" });

  // New expense modal
  const [showNovaDespesa, setShowNovaDespesa] = useState(false);
  const [despesaForm, setDespesaForm] = useState({ descricao: "", valor_original: "", data_vencimento: "", observacao: "" });

  // Payment modal
  const [showPagamento, setShowPagamento] = useState<Tables<"eventos_despesas"> | null>(null);
  const [pgValor, setPgValor] = useState("");
  const [pgData, setPgData] = useState(new Date().toISOString().split("T")[0]);
  const [pgObs, setPgObs] = useState("");

  const { data: eventos, isLoading } = useQuery({
    queryKey: ["eventos-especiais"],
    queryFn: async () => {
      const { data, error } = await supabase.from("eventos_especiais").select("*").order("data_evento", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: todasDespesas } = useQuery({
    queryKey: ["eventos-despesas-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("eventos_despesas").select("*");
      if (error) throw error;
      return data;
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

  const criarEvento = useMutation({
    mutationFn: async () => {
      if (!eventoForm.nome) throw new Error("Nome obrigatório");
      const { error } = await supabase.from("eventos_especiais").insert({
        nome: eventoForm.nome,
        data_evento: eventoForm.data_evento || null,
        descricao: eventoForm.descricao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventos-especiais"] });
      toast.success("Evento criado");
      setShowNovoEvento(false);
      setEventoForm({ nome: "", data_evento: "", descricao: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const criarDespesaEvento = useMutation({
    mutationFn: async () => {
      if (!selectedEvento) return;
      const valor = parseFloat(despesaForm.valor_original);
      if (!despesaForm.descricao || isNaN(valor)) throw new Error("Preencha campos obrigatórios");
      const { error } = await supabase.from("eventos_despesas").insert({
        evento_id: selectedEvento.id,
        descricao: despesaForm.descricao,
        valor_original: valor,
        saldo_pendente: valor,
        data_vencimento: despesaForm.data_vencimento || null,
        observacao: despesaForm.observacao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventos-despesas"] });
      queryClient.invalidateQueries({ queryKey: ["eventos-despesas-all"] });
      toast.success("Despesa adicionada");
      setShowNovaDespesa(false);
      setDespesaForm({ descricao: "", valor_original: "", data_vencimento: "", observacao: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const registrarPagamento = useMutation({
    mutationFn: async () => {
      if (!showPagamento) return;
      const valor = parseFloat(pgValor);
      if (isNaN(valor) || valor <= 0) throw new Error("Valor inválido");

      await supabase.from("pagamentos_parciais").insert({
        referencia_id: showPagamento.id,
        referencia_tipo: "evento_despesa",
        valor_pago: valor,
        data_pagamento: pgData,
        observacao: pgObs || null,
      });

      const novoPago = (showPagamento.valor_pago_total ?? 0) + valor;
      const novoSaldo = Math.max(0, (showPagamento.valor_original ?? 0) - novoPago);
      const novoStatus = novoSaldo <= 0 ? "Pago" : "Parcialmente Pago";

      await supabase.from("eventos_despesas").update({
        valor_pago_total: novoPago,
        saldo_pendente: novoSaldo,
        status: novoStatus as any,
        data_pagamento: novoSaldo <= 0 ? pgData : showPagamento.data_pagamento,
      }).eq("id", showPagamento.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventos-despesas"] });
      queryClient.invalidateQueries({ queryKey: ["eventos-despesas-all"] });
      toast.success("Pagamento registrado");
      setShowPagamento(null);
      setPgValor("");
      setPgObs("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteEvento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("eventos_especiais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventos-especiais"] });
      toast.success("Evento excluído");
    },
    onError: () => toast.error("Erro ao excluir — apenas administradores"),
  });

  // Get totals per event
  const getEventTotals = (eventoId: string) => {
    const deps = (todasDespesas ?? []).filter(d => d.evento_id === eventoId);
    const total = deps.reduce((s, d) => s + (d.valor_original ?? 0), 0);
    const pago = deps.reduce((s, d) => s + (d.valor_pago_total ?? 0), 0);
    return { total, pago, falta: total - pago, progresso: total > 0 ? (pago / total) * 100 : 0 };
  };

  // Detail view
  if (selectedEvento) {
    const deps = despesasEvento ?? [];
    const totalPrevisto = deps.reduce((s, d) => s + (d.valor_original ?? 0), 0);
    const totalPago = deps.reduce((s, d) => s + (d.valor_pago_total ?? 0), 0);
    const falta = totalPrevisto - totalPago;

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

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total previsto", value: formatCurrency(totalPrevisto) },
            { label: "Pago até agora", value: formatCurrency(totalPago) },
            { label: "Falta pagar", value: formatCurrency(falta), alert: falta > 0 },
          ].map(c => (
            <div key={c.label} className={`rounded-xl border p-4 ${c.alert ? "border-primary/20 bg-primary/5" : "border-border bg-card"}`}>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</p>
              <p className={`text-lg font-bold mt-1 ${c.alert ? "text-primary" : "text-foreground"}`}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Despesas do Evento</h2>
          <Button onClick={() => setShowNovaDespesa(true)} size="sm" className="gold-gradient text-primary-foreground">
            <Plus className="h-4 w-4 mr-1" /> Nova despesa
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  {["Descrição", "Valor Previsto", "Pago", "Saldo", "Vencimento", "Status", "Ações"].map(h => (
                    <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${["Valor Previsto", "Pago", "Saldo"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deps.length === 0 && (
                  <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">Nenhuma despesa cadastrada</td></tr>
                )}
                {deps.map(d => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                    <td className="p-3 font-medium">{d.descricao}</td>
                    <td className="p-3 text-right">{formatCurrency(d.valor_original)}</td>
                    <td className="p-3 text-right text-muted-foreground">{formatCurrency(d.valor_pago_total)}</td>
                    <td className="p-3 text-right text-primary">{formatCurrency(d.saldo_pendente)}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(d.data_vencimento)}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={STATUS_STYLE[d.status ?? "A Vencer"] ?? STATUS_STYLE["A Vencer"]}>{d.status}</Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {d.status !== "Pago" && (
                          <button onClick={() => { setShowPagamento(d); setPgValor(String(d.saldo_pendente ?? 0)); }} className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"><DollarSign className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* New expense for event */}
        <Dialog open={showNovaDespesa} onOpenChange={setShowNovaDespesa}>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle className="text-foreground">Nova Despesa do Evento</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label className="text-muted-foreground">Descrição *</Label><Input value={despesaForm.descricao} onChange={e => setDespesaForm(f => ({ ...f, descricao: e.target.value }))} className="bg-secondary/50 border-border" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground">Valor previsto *</Label><Input type="number" value={despesaForm.valor_original} onChange={e => setDespesaForm(f => ({ ...f, valor_original: e.target.value }))} className="bg-secondary/50 border-border" /></div>
                <div><Label className="text-muted-foreground">Data vencimento</Label><Input type="date" value={despesaForm.data_vencimento} onChange={e => setDespesaForm(f => ({ ...f, data_vencimento: e.target.value }))} className="bg-secondary/50 border-border" /></div>
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

        {/* Payment modal */}
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
      </div>
    );
  }

  // Grid view
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Eventos Especiais</h1>
        <Button onClick={() => setShowNovoEvento(true)} className="gold-gradient text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Novo evento
        </Button>
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
              <div
                key={ev.id}
                className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors cursor-pointer space-y-4"
                onClick={() => setSelectedEvento(ev)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{ev.nome}</h3>
                    {ev.data_evento && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <CalendarDays className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{formatDate(ev.data_evento)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={status.className}>{status.label}</Badge>
                    {role === "admin" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm("Excluir evento?")) deleteEvento.mutate(ev.id); }}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
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

      {/* New event modal */}
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
