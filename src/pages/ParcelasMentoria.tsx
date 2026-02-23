import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Search, Loader2, AlertTriangle, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/integrations/supabase/types";

const TIPOS_MENTORIA = [
  "Mentoria Outsider", "Mentoria Digital Beauty", "Consultoria Premium",
  "Consultoria Express", "Renovação Mentoria"
] as const;

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  Pendente: { label: "Pendente", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  Quitado: { label: "Quitada", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  Atraso: { label: "Atrasada", className: "bg-destructive/10 text-destructive border-destructive/20" },
  "Parcialmente Pago": { label: "Parcial", className: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
};

function statusBadge(status: string | null) {
  const s = STATUS_LABELS[status ?? "Pendente"] ?? STATUS_LABELS["Pendente"];
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}

export default function ParcelasMentoria() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [selectedAluna, setSelectedAluna] = useState<Tables<"parcelas_mentoria"> | null>(null);
  const [showPagamento, setShowPagamento] = useState<Tables<"parcelas_mentoria_detalhe"> | null>(null);
  const [pgValor, setPgValor] = useState("");
  const [pgData, setPgData] = useState(new Date().toISOString().split("T")[0]);
  const [pgObs, setPgObs] = useState("");

  const { data: parcelas, isLoading } = useQuery({
    queryKey: ["parcelas-mentoria"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parcelas_mentoria").select("*").order("criado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: detalhes } = useQuery({
    queryKey: ["parcelas-detalhe", selectedAluna?.id],
    enabled: !!selectedAluna,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas_mentoria_detalhe")
        .select("*")
        .eq("parcela_mentoria_id", selectedAluna!.id)
        .order("numero_parcela");
      if (error) throw error;
      return data;
    },
  });

  const { data: historicoPagamentos } = useQuery({
    queryKey: ["pagamentos-parciais-mentoria", selectedAluna?.id],
    enabled: !!selectedAluna,
    queryFn: async () => {
      if (!detalhes) return [];
      const ids = detalhes.map(d => d.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("pagamentos_parciais")
        .select("*")
        .eq("referencia_tipo", "parcela_mentoria_detalhe")
        .in("referencia_id", ids)
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const registrarPagamento = useMutation({
    mutationFn: async () => {
      if (!showPagamento) return;
      const valor = parseFloat(pgValor);
      if (isNaN(valor) || valor <= 0) throw new Error("Valor inválido");

      // Insert partial payment
      const { error: pgError } = await supabase.from("pagamentos_parciais").insert({
        referencia_id: showPagamento.id,
        referencia_tipo: "parcela_mentoria_detalhe",
        valor_pago: valor,
        data_pagamento: pgData,
        observacao: pgObs || null,
      });
      if (pgError) throw pgError;

      // Update detalhe
      const novoPago = (showPagamento.valor_pago_parcial ?? 0) + valor;
      const valorReal = showPagamento.valor_real ?? showPagamento.valor_sugerido ?? 0;
      const novoSaldo = Math.max(0, valorReal - novoPago);
      const novoStatus = novoSaldo <= 0 ? "Quitado" : "Parcialmente Pago";

      const { error: upError } = await supabase
        .from("parcelas_mentoria_detalhe")
        .update({
          valor_pago_parcial: novoPago,
          saldo_parcela: novoSaldo,
          status: novoStatus as any,
          data_pagamento: novoSaldo <= 0 ? pgData : showPagamento.data_pagamento,
        })
        .eq("id", showPagamento.id);
      if (upError) throw upError;

      // Check if all parcelas are paid to update parent status
      const { data: allDetalhes } = await supabase
        .from("parcelas_mentoria_detalhe")
        .select("status")
        .eq("parcela_mentoria_id", showPagamento.parcela_mentoria_id);

      if (allDetalhes) {
        const allQuitado = allDetalhes.every(d => d.status === "Quitado");
        const anyAtraso = allDetalhes.some(d => d.status === "Atraso");
        const parentStatus = allQuitado ? "Quitado" : anyAtraso ? "Atraso" : "Pendente";
        await supabase.from("parcelas_mentoria").update({ status_geral: parentStatus as any }).eq("id", showPagamento.parcela_mentoria_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parcelas-mentoria"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-detalhe"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-parciais-mentoria"] });
      toast.success("Pagamento registrado");
      setShowPagamento(null);
      setPgValor("");
      setPgObs("");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar pagamento"),
  });

  const filtered = (parcelas ?? []).filter((p) => {
    if (filtroTipo !== "all" && p.tipo_mentoria !== filtroTipo) return false;
    if (filtroStatus !== "all" && p.status_geral !== filtroStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      return p.cliente_nome.toLowerCase().includes(s) || (p.cliente_email ?? "").toLowerCase().includes(s);
    }
    return true;
  });

  const inadimplentes = (parcelas ?? []).filter(p => p.status_geral === "Atraso");
  const totalAtraso = inadimplentes.length; // simplified — would need detail query for real value

  const getQuitadas = (p: Tables<"parcelas_mentoria">) => {
    // We'd need detalhes for accurate count — use a heuristic for the table
    return p.status_geral === "Quitado" ? p.quant_parcelas : 0;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Parcelas de Mentoria</h1>
      </div>

      {/* Alert card */}
      {totalAtraso > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {totalAtraso} aluna{totalAtraso > 1 ? "s" : ""} inadimplente{totalAtraso > 1 ? "s" : ""}
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
          <SelectTrigger className="w-[160px] bg-secondary/50 border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Pendente">Pendente</SelectItem>
            <SelectItem value="Quitado">Quitada</SelectItem>
            <SelectItem value="Atraso">Atrasada</SelectItem>
            <SelectItem value="Parcialmente Pago">Parcial</SelectItem>
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
                  {["Nome", "Email", "Tipo", "Valor Total", "Entrada", "Parcelas", "Próx. Vencimento", "Saldo", "Status", ""].map(h => (
                    <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${["Valor Total", "Entrada", "Saldo"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="p-12 text-center text-muted-foreground">Nenhuma parcela encontrada</td></tr>
                )}
                {filtered.map(p => {
                  const saldoRestante = (p.valor_total ?? 0) - (p.entrada_valor ?? 0); // simplified
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer"
                      onClick={() => setSelectedAluna(p)}
                    >
                      <td className="p-3 font-medium">{p.cliente_nome}</td>
                      <td className="p-3 text-muted-foreground text-xs">{p.cliente_email || "—"}</td>
                      <td className="p-3 text-muted-foreground text-xs">{p.tipo_mentoria}</td>
                      <td className="p-3 text-right">{formatCurrency(p.valor_total)}</td>
                      <td className="p-3 text-right text-muted-foreground">{formatCurrency(p.entrada_valor)}</td>
                      <td className="p-3 text-center">{p.quant_parcelas}</td>
                      <td className="p-3 text-muted-foreground">{formatDate(p.data_inicio)}</td>
                      <td className="p-3 text-right text-primary">{formatCurrency(saldoRestante)}</td>
                      <td className="p-3">{statusBadge(p.status_geral)}</td>
                      <td className="p-3"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Side panel */}
      <Sheet open={!!selectedAluna} onOpenChange={() => setSelectedAluna(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl bg-card border-border overflow-y-auto">
          {selectedAluna && (
            <div className="space-y-6">
              <SheetHeader>
                <SheetTitle className="text-foreground">{selectedAluna.cliente_nome}</SheetTitle>
                <p className="text-sm text-muted-foreground">{selectedAluna.cliente_email}</p>
              </SheetHeader>

              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Valor Total", value: formatCurrency(selectedAluna.valor_total) },
                  { label: "Entrada", value: formatCurrency(selectedAluna.entrada_valor) },
                  { label: "Periodicidade", value: selectedAluna.periodicidade },
                  { label: "Data Início", value: formatDate(selectedAluna.data_inicio) },
                  { label: "Data Fim Prevista", value: formatDate(selectedAluna.data_fim_prevista) },
                  { label: "Status", value: selectedAluna.status_geral },
                ].map(item => (
                  <div key={item.label} className="rounded-lg border border-border bg-secondary/30 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm font-medium text-foreground mt-1">{item.value || "—"}</p>
                  </div>
                ))}
              </div>

              {/* Parcelas detail */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Parcelas</h3>
                <div className="space-y-2">
                  {(detalhes ?? []).map(d => {
                    const pagamentos = (historicoPagamentos ?? []).filter(hp => hp.referencia_id === d.id);
                    return (
                      <div key={d.id} className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">#{d.numero_parcela}</span>
                            <span className="text-sm text-foreground">{formatCurrency(d.valor_real ?? d.valor_sugerido)}</span>
                            {statusBadge(d.status)}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{formatDate(d.data_vencimento)}</span>
                            {d.status !== "Quitado" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"
                                onClick={() => {
                                  setShowPagamento(d);
                                  setPgValor(String(d.saldo_parcela ?? d.valor_real ?? d.valor_sugerido ?? 0));
                                }}
                              >
                                Registrar pgto
                              </Button>
                            )}
                          </div>
                        </div>
                        {(d.valor_pago_parcial ?? 0) > 0 && (
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Pago: {formatCurrency(d.valor_pago_parcial)}</span>
                            <span>Saldo: {formatCurrency(d.saldo_parcela)}</span>
                          </div>
                        )}
                        {d.data_pagamento && (
                          <p className="text-xs text-muted-foreground">Pago em: {formatDate(d.data_pagamento)}</p>
                        )}
                        {pagamentos.length > 0 && (
                          <div className="mt-1 pl-3 border-l-2 border-border space-y-1">
                            {pagamentos.map(pg => (
                              <p key={pg.id} className="text-[10px] text-muted-foreground">
                                {formatDate(pg.data_pagamento)} — {formatCurrency(pg.valor_pago)} {pg.observacao ? `• ${pg.observacao}` : ""}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedAluna.is_renovacao && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
                  <p className="text-xs font-medium text-primary">Renovação de Mentoria</p>
                  <p className="text-xs text-muted-foreground">Término anterior: {formatDate(selectedAluna.data_termino_mentoria_anterior)}</p>
                  <p className="text-xs text-muted-foreground">Último acesso: {formatDate(selectedAluna.data_ultimo_acesso_anterior)}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Payment modal */}
      <Dialog open={!!showPagamento} onOpenChange={() => setShowPagamento(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Registrar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Valor</Label>
              <Input type="number" value={pgValor} onChange={e => setPgValor(e.target.value)} className="bg-secondary/50 border-border" />
            </div>
            <div>
              <Label className="text-muted-foreground">Data do Pagamento</Label>
              <Input type="date" value={pgData} onChange={e => setPgData(e.target.value)} className="bg-secondary/50 border-border" />
            </div>
            <div>
              <Label className="text-muted-foreground">Observação</Label>
              <Textarea value={pgObs} onChange={e => setPgObs(e.target.value)} className="bg-secondary/50 border-border" rows={2} />
            </div>
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
