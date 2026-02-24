import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate, getMonthRange, getWeekRange } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Search, Loader2, DollarSign, Lock, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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

const CATEGORIAS = Constants.public.Enums.despesa_categoria_pessoal;
const PRO_LABORE = 30000;

const STATUS_STYLE: Record<string, string> = {
  "A Vencer": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "Pago": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Em Atraso": "bg-destructive/10 text-destructive border-destructive/20",
  "Parcialmente Pago": "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

export default function DespesasPessoal() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("fixas");
  const [search, setSearch] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");

  const [showNova, setShowNova] = useState(false);
  const [novaForm, setNovaForm] = useState({
    descricao: "", categoria: "" as any, tipo_despesa: "Fixa" as "Fixa" | "Variável",
    valor_original: "", data_vencimento: "", forma_pagamento: "", observacao: "",
  });

  const [showPagamento, setShowPagamento] = useState<Tables<"despesas_pessoal"> | null>(null);
  const [pgValor, setPgValor] = useState("");
  const [pgData, setPgData] = useState(new Date().toISOString().split("T")[0]);
  const [pgObs, setPgObs] = useState("");

  // Edit modal
  const [editItem, setEditItem] = useState<Tables<"despesas_pessoal"> | null>(null);
  const [editForm, setEditForm] = useState({ descricao: "", categoria: "" as any, tipo_despesa: "Fixa" as any, valor_original: "", data_vencimento: "", forma_pagamento: "", observacao: "" });

  // Fetch pro_labore from configuracoes
  const { data: configProLabore } = useQuery({
    queryKey: ["config-prolabore"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes").select("valor").eq("chave", "pro_labore").single();
      return data?.valor ? parseFloat(data.valor) : PRO_LABORE;
    },
  });

  const proLaboreValue = configProLabore ?? PRO_LABORE;

  const { data: despesas, isLoading } = useQuery({
    queryKey: ["despesas-pessoal"],
    queryFn: async () => {
      const { data, error } = await supabase.from("despesas_pessoal").select("*").order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const criarDespesa = useMutation({
    mutationFn: async () => {
      const valor = parseFloat(novaForm.valor_original);
      if (!novaForm.descricao || !novaForm.categoria || isNaN(valor)) throw new Error("Preencha todos os campos obrigatórios");
      const { error } = await supabase.from("despesas_pessoal").insert({
        descricao: novaForm.descricao,
        categoria: novaForm.categoria,
        tipo_despesa: novaForm.tipo_despesa,
        valor_original: valor,
        saldo_pendente: valor,
        data_vencimento: novaForm.data_vencimento || null,
        forma_pagamento: novaForm.forma_pagamento || null,
        observacao: novaForm.observacao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas-pessoal"] });
      toast.success("Despesa criada");
      setShowNova(false);
      setNovaForm({ descricao: "", categoria: "" as any, tipo_despesa: "Fixa", valor_original: "", data_vencimento: "", forma_pagamento: "", observacao: "" });
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
        referencia_tipo: "despesa_pessoal",
        valor_pago: valor,
        data_pagamento: pgData,
        observacao: pgObs || null,
      });

      const novoPago = (showPagamento.valor_pago_total ?? 0) + valor;
      const novoSaldo = Math.max(0, (showPagamento.valor_original ?? 0) - novoPago);
      const novoStatus = novoSaldo <= 0 ? "Pago" : "Parcialmente Pago";

      await supabase.from("despesas_pessoal").update({
        valor_pago_total: novoPago,
        saldo_pendente: novoSaldo,
        status: novoStatus as any,
        data_pagamento: novoSaldo <= 0 ? pgData : showPagamento.data_pagamento,
      }).eq("id", showPagamento.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas-pessoal"] });
      toast.success("Pagamento registrado");
      setShowPagamento(null);
      setPgValor("");
      setPgObs("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("despesas_pessoal").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas-pessoal"] });
      toast.success("Despesa excluída");
    },
    onError: () => toast.error("Erro ao excluir — apenas administradores"),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editItem) return;
      const valor = parseFloat(editForm.valor_original);
      if (!editForm.descricao || isNaN(valor)) throw new Error("Preencha campos obrigatórios");
      const novoSaldo = valor - (editItem.valor_pago_total ?? 0);
      const { error } = await supabase.from("despesas_pessoal").update({
        descricao: editForm.descricao, categoria: editForm.categoria, tipo_despesa: editForm.tipo_despesa,
        valor_original: valor, saldo_pendente: Math.max(0, novoSaldo),
        data_vencimento: editForm.data_vencimento || null, forma_pagamento: editForm.forma_pagamento || null, observacao: editForm.observacao || null,
      }).eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["despesas-pessoal"] }); toast.success("Despesa atualizada"); setEditItem(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (d: Tables<"despesas_pessoal">) => {
    setEditForm({ descricao: d.descricao, categoria: d.categoria, tipo_despesa: d.tipo_despesa, valor_original: String(d.valor_original), data_vencimento: d.data_vencimento ?? "", forma_pagamento: d.forma_pagamento ?? "", observacao: d.observacao ?? "" });
    setEditItem(d);
  };

  const tipoFiltro = tab === "fixas" ? "Fixa" : "Variável";
  const filtered = (despesas ?? []).filter(d => {
    if (d.tipo_despesa !== tipoFiltro) return false;
    if (filtroCategoria !== "all" && d.categoria !== filtroCategoria) return false;
    if (filtroStatus !== "all" && d.status !== filtroStatus) return false;
    if (search) return d.descricao.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const now = new Date();
  const { start: mesStart, end: mesEnd } = getMonthRange(now.getFullYear(), now.getMonth());
  const mesAtual = (despesas ?? []).filter(d => d.data_vencimento && d.data_vencimento >= mesStart && d.data_vencimento <= mesEnd);
  const totalMes = mesAtual.reduce((s, d) => s + (d.valor_original ?? 0), 0) + (tab === "fixas" ? proLaboreValue : 0);
  const pagoMes = mesAtual.reduce((s, d) => s + (d.valor_pago_total ?? 0), 0);
  const emAtraso = (despesas ?? []).filter(d => d.status === "Em Atraso").reduce((s, d) => s + (d.saldo_pendente ?? 0), 0);
  const weekRange = getWeekRange();
  const aVencerSemana = (despesas ?? []).filter(d => d.status === "A Vencer" && d.data_vencimento && d.data_vencimento >= weekRange.start && d.data_vencimento <= weekRange.end)
    .reduce((s, d) => s + (d.saldo_pendente ?? 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Despesas — Pessoal</h1>
        <Button onClick={() => setShowNova(true)} className="gold-gradient text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Nova despesa
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total do mês", value: formatCurrency(totalMes) },
          { label: "Pago", value: formatCurrency(pagoMes) },
          { label: "Em atraso", value: formatCurrency(emAtraso), alert: emAtraso > 0 },
          { label: "Vence esta semana", value: formatCurrency(aVencerSemana) },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.alert ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"}`}>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</p>
            <p className={`text-lg font-bold mt-1 ${c.alert ? "text-destructive" : "text-foreground"}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="fixas">Fixas</TabsTrigger>
          <TabsTrigger value="variaveis">Variáveis</TabsTrigger>
        </TabsList>

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

        <TabsContent value="fixas">
          {/* Pro-labore fixed row */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Pró-labore</p>
                <p className="text-xs text-muted-foreground">Valor fixo mensal (Configurações)</p>
              </div>
            </div>
            <p className="text-lg font-bold text-primary">{formatCurrency(proLaboreValue)}</p>
          </div>
          {isLoading ? <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      {["Descrição", "Categoria", "Valor", "Pago", "Saldo", "Vencimento", "Pagamento", "Status", "Ações"].map(h => (
                        <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${["Valor", "Pago", "Saldo"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr><td colSpan={9} className="p-12 text-center text-muted-foreground">Nenhuma despesa encontrada</td></tr>
                    )}
                    {filtered.map(d => (
                      <tr key={d.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                        <td className="p-3 font-medium max-w-[200px] truncate">{d.descricao}</td>
                        <td className="p-3 text-xs text-muted-foreground">{d.categoria}</td>
                        <td className="p-3 text-right">{formatCurrency(d.valor_original)}</td>
                        <td className="p-3 text-right text-muted-foreground">{formatCurrency(d.valor_pago_total)}</td>
                        <td className="p-3 text-right text-primary">{formatCurrency(d.saldo_pendente)}</td>
                        <td className="p-3 text-muted-foreground">{formatDate(d.data_vencimento)}</td>
                        <td className="p-3 text-muted-foreground">{formatDate(d.data_pagamento)}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={STATUS_STYLE[d.status ?? "A Vencer"] ?? STATUS_STYLE["A Vencer"]}>{d.status}</Badge>
                        </td>
                        <td className="p-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><button className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><MoreHorizontal className="h-4 w-4" /></button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-card border-border">
                              <DropdownMenuItem onClick={() => openEdit(d)} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Editar</DropdownMenuItem>
                              {d.status !== "Pago" && <DropdownMenuItem onClick={() => { setShowPagamento(d); setPgValor(String(d.saldo_pendente ?? 0)); }} className="gap-2"><DollarSign className="h-3.5 w-3.5" /> Registrar pagamento</DropdownMenuItem>}
                              {role === "admin" && <DropdownMenuItem onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(d.id); }} className="gap-2 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Excluir</DropdownMenuItem>}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="variaveis">
          {isLoading ? <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      {["Descrição", "Categoria", "Valor", "Pago", "Saldo", "Vencimento", "Pagamento", "Status", "Ações"].map(h => (
                        <th key={h} className={`p-3 text-xs font-medium text-muted-foreground ${["Valor", "Pago", "Saldo"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr><td colSpan={9} className="p-12 text-center text-muted-foreground">Nenhuma despesa encontrada</td></tr>
                    )}
                    {filtered.map(d => (
                      <tr key={d.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                        <td className="p-3 font-medium max-w-[200px] truncate">{d.descricao}</td>
                        <td className="p-3 text-xs text-muted-foreground">{d.categoria}</td>
                        <td className="p-3 text-right">{formatCurrency(d.valor_original)}</td>
                        <td className="p-3 text-right text-muted-foreground">{formatCurrency(d.valor_pago_total)}</td>
                        <td className="p-3 text-right text-primary">{formatCurrency(d.saldo_pendente)}</td>
                        <td className="p-3 text-muted-foreground">{formatDate(d.data_vencimento)}</td>
                        <td className="p-3 text-muted-foreground">{formatDate(d.data_pagamento)}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={STATUS_STYLE[d.status ?? "A Vencer"] ?? STATUS_STYLE["A Vencer"]}>{d.status}</Badge>
                        </td>
                        <td className="p-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><button className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><MoreHorizontal className="h-4 w-4" /></button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-card border-border">
                              <DropdownMenuItem onClick={() => openEdit(d)} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Editar</DropdownMenuItem>
                              {d.status !== "Pago" && <DropdownMenuItem onClick={() => { setShowPagamento(d); setPgValor(String(d.saldo_pendente ?? 0)); }} className="gap-2"><DollarSign className="h-3.5 w-3.5" /> Registrar pagamento</DropdownMenuItem>}
                              {role === "admin" && <DropdownMenuItem onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(d.id); }} className="gap-2 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Excluir</DropdownMenuItem>}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* New expense modal */}
      <Dialog open={showNova} onOpenChange={setShowNova}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Nova Despesa — Pessoal</DialogTitle></DialogHeader>
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
                <Label className="text-muted-foreground">Tipo</Label>
                <Select value={novaForm.tipo_despesa} onValueChange={v => setNovaForm(f => ({ ...f, tipo_despesa: v as any }))}>
                  <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fixa">Fixa</SelectItem>
                    <SelectItem value="Variável">Variável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground">Valor *</Label>
                <Input type="number" value={novaForm.valor_original} onChange={e => setNovaForm(f => ({ ...f, valor_original: e.target.value }))} className="bg-secondary/50 border-border" />
              </div>
              <div>
                <Label className="text-muted-foreground">Data Vencimento</Label>
                <Input type="date" value={novaForm.data_vencimento} onChange={e => setNovaForm(f => ({ ...f, data_vencimento: e.target.value }))} className="bg-secondary/50 border-border" />
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Forma de Pagamento</Label>
              <Input value={novaForm.forma_pagamento} onChange={e => setNovaForm(f => ({ ...f, forma_pagamento: e.target.value }))} className="bg-secondary/50 border-border" />
            </div>
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

      {/* Payment modal */}
      <Dialog open={!!showPagamento} onOpenChange={() => setShowPagamento(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Registrar Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Valor</Label>
              <Input type="number" value={pgValor} onChange={e => setPgValor(e.target.value)} className="bg-secondary/50 border-border" />
            </div>
            <div>
              <Label className="text-muted-foreground">Data</Label>
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
            <div><Label className="text-muted-foreground">Observação</Label><Textarea value={editForm.observacao} onChange={e => setEditForm(f => ({ ...f, observacao: e.target.value }))} className="bg-secondary/50 border-border" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)} className="border-border">Cancelar</Button>
            <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending} className="gold-gradient text-primary-foreground">
              {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
