import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, getMonthRange } from "@/lib/format";
import { toast } from "sonner";
import { Loader2, PiggyBank, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import MonthNavigator, { getCurrentMonthKey, type DateFilter, getDateRange } from "@/components/MonthNavigator";

export default function Cofrinho() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [dateFilter, setDateFilter] = useState<DateFilter>({ type: "month", key: getCurrentMonthKey() });
  const { start: mesInicio, end: mesFim } = getDateRange(dateFilter);

  const [showAdd, setShowAdd] = useState(false);
  const [addData, setAddData] = useState(now.toISOString().split("T")[0]);
  const [addValor, setAddValor] = useState("");

  const { data: entries, isLoading } = useQuery({
    queryKey: ["cofrinho", mesInicio, mesFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cofrinho")
        .select("*")
        .gte("data", mesInicio)
        .lte("data", mesFim)
        .order("data", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Get all cofrinho entries to compute current balance
  const { data: allEntries } = useQuery({
    queryKey: ["cofrinho-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cofrinho").select("*").order("data", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Get priority expenses for the month that are not paid
  const { data: despEmpresa } = useQuery({
    queryKey: ["desp-empresa-cofrinho", mesInicio, mesFim],
    queryFn: async () => {
      const { data } = await supabase.from("despesas_empresa").select("*")
        .gte("data_vencimento", mesInicio).lte("data_vencimento", mesFim);
      return data ?? [];
    },
  });

  const { data: despPessoal } = useQuery({
    queryKey: ["desp-pessoal-cofrinho", mesInicio, mesFim],
    queryFn: async () => {
      const { data } = await supabase.from("despesas_pessoal").select("*")
        .gte("data_vencimento", mesInicio).lte("data_vencimento", mesFim);
      return data ?? [];
    },
  });

  const addEntry = useMutation({
    mutationFn: async () => {
      const valor = parseFloat(addValor);
      if (isNaN(valor) || valor <= 0) throw new Error("Valor inválido");
      // Upsert by date
      const { error } = await supabase.from("cofrinho").upsert(
        { data: addData, valor },
        { onConflict: "data" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cofrinho"] });
      queryClient.invalidateQueries({ queryKey: ["cofrinho-all"] });
      toast.success("Valor adicionado ao cofrinho");
      setShowAdd(false);
      setAddValor("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cofrinho").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cofrinho"] });
      queryClient.invalidateQueries({ queryKey: ["cofrinho-all"] });
      toast.success("Entrada removida");
    },
  });

  const totalMes = (entries ?? []).reduce((s, e) => s + (e.valor ?? 0), 0);
  const saldoAtual = (allEntries ?? []).reduce((s, e) => s + (e.valor ?? 0), 0);

  // Priority expenses not paid
  const allDesp = [...(despEmpresa ?? []), ...(despPessoal ?? [])];
  const prioridadeAlta = allDesp.filter((d: any) => d.prioridade === "Alta" && d.status !== "Pago");
  const totalPrioridade = prioridadeAlta.reduce((s, d) => s + (d.saldo_pendente ?? d.valor_original ?? 0), 0);
  const progressoPct = totalPrioridade > 0 ? Math.min(100, (saldoAtual / totalPrioridade) * 100) : 100;
  const faltaCofrinho = Math.max(0, totalPrioridade - saldoAtual);

  // Build calendar grid
  const periodDate = new Date(mesInicio + "T00:00:00");
  const year = periodDate.getFullYear();
  const month = periodDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const entryMap = new Map<string, { id: string; valor: number }>();
  (entries ?? []).forEach(e => {
    entryMap.set(e.data, { id: e.id, valor: e.valor });
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-primary" /> Cofrinho
        </h1>
        <Button onClick={() => setShowAdd(true)} className="gold-gradient text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Adicionar valor
        </Button>
      </div>

      <MonthNavigator filter={dateFilter} onChange={setDateFilter} />

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Saldo atual no cofrinho</p>
          <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(saldoAtual)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Juntado neste mês</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totalMes)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Contas prioridade alta (mês)</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totalPrioridade)}</p>
          <div className="mt-3">
            <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progressoPct >= 100 ? "bg-emerald-500" : progressoPct >= 50 ? "bg-yellow-500" : "bg-destructive"}`}
                style={{ width: `${progressoPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {progressoPct >= 100 ? "✅ Cofrinho cobre todas as contas prioritárias!" : `Falta ${formatCurrency(faltaCofrinho)} para cobrir as prioridades`}
            </p>
          </div>
        </div>
      </div>

      {/* Calendar view */}
      {isLoading ? (
        <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const entry = entryMap.get(ds);
              const isToday = ds === now.toISOString().split("T")[0];
              return (
                <button
                  key={day}
                  onClick={() => { setAddData(ds); setAddValor(entry ? String(entry.valor) : ""); setShowAdd(true); }}
                  className={`relative rounded-lg p-2 min-h-[60px] text-left transition-colors border ${
                    entry ? "border-primary/30 bg-primary/5 hover:bg-primary/10" : "border-transparent hover:bg-secondary/50"
                  } ${isToday ? "ring-1 ring-primary" : ""}`}
                >
                  <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day}</span>
                  {entry && (
                    <p className="text-xs font-bold text-primary mt-1">{formatCurrency(entry.valor)}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Entries list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">Entradas do mês</h3>
        </div>
        <div className="divide-y divide-border">
          {(entries ?? []).length === 0 && <p className="p-8 text-center text-muted-foreground text-sm">Nenhuma entrada neste mês</p>}
          {(entries ?? []).map(e => (
            <div key={e.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{formatDate(e.data)}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-primary">{formatCurrency(e.valor)}</p>
                <button onClick={() => { if (confirm("Remover esta entrada?")) deleteEntry.mutate(e.id); }} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Adicionar ao Cofrinho</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Data</Label>
              <Input type="date" value={addData} onChange={e => setAddData(e.target.value)} className="bg-secondary/50 border-border" />
            </div>
            <div>
              <Label className="text-muted-foreground">Valor (R$)</Label>
              <Input type="number" value={addValor} onChange={e => setAddValor(e.target.value)} className="bg-secondary/50 border-border" autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} className="border-border">Cancelar</Button>
            <Button onClick={() => addEntry.mutate()} disabled={addEntry.isPending} className="gold-gradient text-primary-foreground">
              {addEntry.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
