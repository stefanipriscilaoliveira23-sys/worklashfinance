import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Search, Loader2, ChevronRight, Users, Plus, MoreHorizontal, Pencil, Trash2, AlertTriangle, CheckCircle2, Clock, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import EditarContratoDialog from "@/components/parcelas/EditarContratoDialog";
import { EditarReceitaModal } from "@/components/receitas/EditarReceitaModal";
import type { Tables } from "@/integrations/supabase/types";

export default function Clientes() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Tables<"clientes"> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editCliente, setEditCliente] = useState<Tables<"clientes"> | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", whatsapp: "", instagram: "", observacao: "" });
  const [editContrato, setEditContrato] = useState<Tables<"parcelas_mentoria"> | null>(null);
  const [editReceita, setEditReceita] = useState<any>(null);

  const { data: clientes, isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: allContratos } = useQuery({
    queryKey: ["clientes-contratos-all"],
    queryFn: async () => {
      const { data } = await supabase.from("parcelas_mentoria").select("*, parcelas_mentoria_detalhe(*)").order("criado_em", { ascending: false });
      return data as any[] ?? [];
    },
  });

  const { data: contratos } = useQuery({
    queryKey: ["cliente-contratos", selectedCliente?.id, selectedCliente?.nome],
    enabled: !!selectedCliente,
    queryFn: async () => {
      // Match by cliente_id OR by cliente_nome (many imported contracts only have nome)
      const { data: byId } = await supabase.from("parcelas_mentoria").select("*, parcelas_mentoria_detalhe(*)").eq("cliente_id", selectedCliente!.id).order("criado_em", { ascending: false });
      const { data: byNome } = await supabase.from("parcelas_mentoria").select("*, parcelas_mentoria_detalhe(*)").eq("cliente_nome", selectedCliente!.nome).is("cliente_id", null).order("criado_em", { ascending: false });
      const merged = [...(byId ?? []), ...(byNome ?? [])];
      // Deduplicate by id
      const seen = new Set<string>();
      return merged.filter((c: any) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; }) as any[];
    },
  });

  const { data: receitas } = useQuery({
    queryKey: ["cliente-receitas", selectedCliente?.nome, selectedCliente?.email],
    enabled: !!selectedCliente,
    queryFn: async () => {
      // Match by nome OR email
      let query = supabase.from("receitas").select("*").order("data", { ascending: false });
      const conditions = [`cliente_nome.eq.${selectedCliente!.nome}`];
      if (selectedCliente!.email) conditions.push(`cliente_email.eq.${selectedCliente!.email}`);
      const { data } = await query.or(conditions.join(","));
      return data ?? [];
    },
  });

  const criarCliente = useMutation({
    mutationFn: async () => {
      if (!form.nome) throw new Error("Nome obrigatório");
      const { error } = await supabase.from("clientes").insert({
        nome: form.nome, email: form.email || null, telefone: form.telefone || null,
        whatsapp: (form as any).whatsapp || null, instagram: (form as any).instagram || null, observacao: form.observacao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clientes"] }); toast.success("Cliente criada"); closeForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const editarCliente = useMutation({
    mutationFn: async () => {
      if (!editCliente || !form.nome) throw new Error("Nome obrigatório");
      const { error } = await supabase.from("clientes").update({
        nome: form.nome, email: form.email || null, telefone: form.telefone || null,
        whatsapp: (form as any).whatsapp || null, instagram: (form as any).instagram || null, observacao: form.observacao || null,
      }).eq("id", editCliente.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clientes"] }); toast.success("Cliente atualizada"); closeForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCliente = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("clientes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clientes"] }); toast.success("Cliente excluída"); },
    onError: () => toast.error("Erro ao excluir — apenas administradores"),
  });

  const closeForm = () => { setShowForm(false); setEditCliente(null); setForm({ nome: "", email: "", telefone: "", whatsapp: "", instagram: "", observacao: "" }); };
  const openEdit = (c: Tables<"clientes">) => {
    setForm({ nome: c.nome, email: c.email ?? "", telefone: c.telefone ?? "", whatsapp: (c as any).whatsapp ?? "", instagram: (c as any).instagram ?? "", observacao: c.observacao ?? "" });
    setEditCliente(c); setShowForm(true);
  };

  const filtered = (clientes ?? []).filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.nome.toLowerCase().includes(s) || (c.email ?? "").toLowerCase().includes(s);
  });

  // Metrics
  const metrics = useMemo(() => {
    const contracts = allContratos ?? [];
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const mesKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const mesStart = `${mesKey}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const mesEnd = `${mesKey}-${String(lastDay).padStart(2, "0")}`;

    const mentoriaTypes: Record<string, number> = {};
    const atrasados = new Set<string>();
    let vencidas = 0, pagando = 0, quitadasAtivas = 0, vencemEsteMes = 0;

    contracts.forEach((c: any) => {
      mentoriaTypes[c.tipo_mentoria] = (mentoriaTypes[c.tipo_mentoria] ?? 0) + 1;
      const detalhes = c.parcelas_mentoria_detalhe ?? [];
      const hasAtraso = detalhes.some((d: any) => d.status === "Atraso" || (d.data_vencimento < today && d.status === "Pendente"));
      if (hasAtraso) atrasados.add(c.cliente_nome);
      if (c.data_fim_prevista && c.data_fim_prevista < today) vencidas++;
      else if (c.data_fim_prevista && c.data_fim_prevista >= mesStart && c.data_fim_prevista <= mesEnd) vencemEsteMes++;
      
      const allQuitado = detalhes.length > 0 && detalhes.every((d: any) => d.status === "Quitado");
      const hasPendente = detalhes.some((d: any) => d.status !== "Quitado");
      if (allQuitado && c.data_fim_prevista && c.data_fim_prevista >= today) quitadasAtivas++;
      else if (hasPendente && c.data_fim_prevista && c.data_fim_prevista >= today) pagando++;
    });

    return { mentoriaTypes, atrasados: atrasados.size, vencidas, pagando, quitadasAtivas, vencemEsteMes };
  }, [allContratos]);

  // Client detail helper
  const getClienteStatus = (contratos: any[]) => {
    const today = new Date().toISOString().split("T")[0];
    const activeContracts = contratos.filter((c: any) => !c.data_fim_prevista || c.data_fim_prevista >= today);
    if (activeContracts.length === 0) return { label: "Sem contrato ativo", className: "bg-muted text-muted-foreground" };
    const hasAtraso = activeContracts.some((c: any) => (c.parcelas_mentoria_detalhe ?? []).some((d: any) => d.status === "Atraso" || (d.data_vencimento < today && d.status === "Pendente")));
    if (hasAtraso) return { label: "Em atraso", className: "bg-destructive/10 text-destructive border-destructive/20" };
    const allQuitado = activeContracts.every((c: any) => (c.parcelas_mentoria_detalhe ?? []).every((d: any) => d.status === "Quitado"));
    if (allQuitado) return { label: "Quitada", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
    return { label: "Em dia", className: "bg-primary/10 text-primary border-primary/20" };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Clientes</h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-muted-foreground border-border">
            {filtered.length} cliente{filtered.length !== 1 ? "s" : ""}
          </Badge>
          <Button onClick={() => { setEditCliente(null); setShowForm(true); }} className="gold-gradient text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Nova cliente
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {Object.entries(metrics.mentoriaTypes).map(([tipo, qtd]) => (
          <Card key={tipo} className="border-border bg-card">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider truncate">{tipo}</p>
              <p className="text-lg font-bold text-foreground">{qtd}</p>
            </CardContent>
          </Card>
        ))}
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-destructive tracking-wider">Com atraso</p>
            <p className="text-lg font-bold text-destructive">{metrics.atrasados}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Pagando</p>
            <p className="text-lg font-bold text-foreground">{metrics.pagando}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Vencidas</p>
            <p className="text-lg font-bold text-foreground">{metrics.vencidas}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Vencem este mês</p>
            <p className="text-lg font-bold text-primary">{metrics.vencemEsteMes}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Quitadas (ativas)</p>
            <p className="text-lg font-bold text-emerald-400">{metrics.quitadasAtivas}</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="p-3 text-xs font-medium text-muted-foreground text-left">Nome</th>
                  <th className="p-3 text-xs font-medium text-muted-foreground text-left">Email</th>
                  <th className="p-3 text-xs font-medium text-muted-foreground text-left">WhatsApp</th>
                  <th className="p-3 text-xs font-medium text-muted-foreground text-left">Instagram</th>
                  <th className="p-3 text-xs font-medium text-muted-foreground text-left">Cadastro</th>
                  <th className="p-3 text-xs font-medium text-muted-foreground text-left">Ações</th>
                  <th className="p-3 text-xs font-medium text-muted-foreground text-left"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">Nenhum cliente encontrado</td></tr>
                )}
                {filtered.map(c => (
                  <tr
                    key={c.id}
                    className="border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer"
                    onClick={() => setSelectedCliente(c)}
                  >
                    <td className="p-3 font-medium">{c.nome}</td>
                    <td className="p-3 text-muted-foreground text-xs">{c.email || "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs">{(c as any).whatsapp || "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs">{(c as any).instagram || "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs">{formatDate(c.criado_em)}</td>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><button className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><MoreHorizontal className="h-4 w-4" /></button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border">
                          <DropdownMenuItem onClick={() => openEdit(c)} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Editar</DropdownMenuItem>
                          {role === "admin" && <DropdownMenuItem onClick={() => { if (confirm("Excluir cliente?")) deleteCliente.mutate(c.id); }} className="gap-2 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Excluir</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                    <td className="p-3"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Client detail sheet */}
      <Sheet open={!!selectedCliente} onOpenChange={() => setSelectedCliente(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl bg-card border-border overflow-y-auto">
          {selectedCliente && (
            <div className="space-y-6">
              <SheetHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SheetTitle className="text-foreground">{selectedCliente.nome}</SheetTitle>
                    <div className="space-y-1 mt-1">
                      <p className="text-sm text-muted-foreground">{selectedCliente.email || "Sem email"}</p>
                      {(selectedCliente as any).whatsapp && <p className="text-xs text-muted-foreground">📱 {(selectedCliente as any).whatsapp}</p>}
                      {(selectedCliente as any).instagram && <p className="text-xs text-muted-foreground">📸 {(selectedCliente as any).instagram}</p>}
                      {selectedCliente.observacao && <p className="text-xs text-muted-foreground italic mt-2">{selectedCliente.observacao}</p>}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => openEdit(selectedCliente)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Editar perfil
                  </Button>
                </div>
              </SheetHeader>

              {/* Total gasto */}
              <div className="rounded-lg border border-border bg-secondary/20 p-4">
                <p className="text-xs text-muted-foreground uppercase">Total gasto conosco</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(
                  (receitas ?? []).reduce((s, r) => s + (r.valor_bruto ?? 0), 0) +
                  (contratos ?? []).reduce((s: number, c: any) => s + (c.entrada_valor ?? 0) + ((c.parcelas_mentoria_detalhe ?? []).filter((d: any) => d.status === "Quitado").reduce((a: number, d: any) => a + (d.valor_real ?? d.valor_sugerido ?? 0), 0)), 0)
                )}</p>
              </div>

              {/* Contracts */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Contratos de Mentoria</h3>
                {(contratos ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum contrato encontrado</p>
                ) : (
                  <div className="space-y-3">
                    {(contratos ?? []).map((contrato: any) => {
                      const detalhes = contrato.parcelas_mentoria_detalhe ?? [];
                      const totalPago = detalhes.reduce((acc: number, d: any) => acc + (d.valor_pago_parcial ?? 0), 0);
                      const saldoRestante = detalhes.reduce((acc: number, d: any) => acc + (d.saldo_parcela ?? 0), 0);
                      const parcelasQuitadas = detalhes.filter((d: any) => d.status === "Quitado").length;
                      const today = new Date().toISOString().split("T")[0];
                      
                      // Mentoria status
                      const fimPrevista = contrato.data_fim_prevista;
                      const vencida = fimPrevista && fimPrevista < today;
                      const diasParaFim = fimPrevista ? Math.ceil((new Date(fimPrevista + "T00:00:00").getTime() - new Date().getTime()) / 86400000) : null;
                      
                      // Next parcela
                      const proxParcela = detalhes.filter((d: any) => d.status !== "Quitado" && d.data_vencimento >= today).sort((a: any, b: any) => a.data_vencimento.localeCompare(b.data_vencimento))[0];
                      const diasProxParcela = proxParcela ? Math.ceil((new Date(proxParcela.data_vencimento + "T00:00:00").getTime() - new Date().getTime()) / 86400000) : null;

                      return (
                        <div key={contrato.id} className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                             <p className="text-sm font-medium text-foreground">{contrato.tipo_mentoria}</p>
                              <p className="text-xs text-muted-foreground">Início: {formatDate(contrato.data_inicio)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                onClick={(e) => { e.stopPropagation(); setEditContrato(contrato); }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            <Badge variant="outline" className={
                              contrato.status_geral === "Quitado" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                              contrato.status_geral === "Atraso" ? "bg-destructive/10 text-destructive border-destructive/20" :
                              "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                            }>
                              {contrato.status_geral}
                            </Badge>
                            </div>
                          </div>
                          {/* Mentoria timing */}
                          <div className="rounded-lg bg-secondary/30 p-2 space-y-1">
                            {fimPrevista && (
                              <div className="flex items-center gap-2 text-xs">
                                {vencida ? (
                                  <><AlertTriangle className="h-3 w-3 text-destructive" /><span className="text-destructive">Vencida há {Math.abs(diasParaFim!)} dias ({formatDate(fimPrevista)})</span></>
                                ) : (
                                  <><Clock className="h-3 w-3 text-primary" /><span className="text-primary">Vence em {diasParaFim} dias ({formatDate(fimPrevista)})</span></>
                                )}
                              </div>
                            )}
                            {proxParcela && (
                              <div className="flex items-center gap-2 text-xs">
                                <DollarSign className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">Próx. parcela em {diasProxParcela} dia{diasProxParcela !== 1 ? "s" : ""} ({formatDate(proxParcela.data_vencimento)})</span>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><span className="text-muted-foreground">Valor Total: </span><span className="text-foreground">{formatCurrency(contrato.valor_total)}</span></div>
                            <div><span className="text-muted-foreground">Entrada: </span><span className="text-foreground">{formatCurrency(contrato.entrada_valor)}</span></div>
                            <div><span className="text-muted-foreground">Total Pago: </span><span className="text-emerald-400">{formatCurrency(totalPago + (contrato.entrada_valor ?? 0))}</span></div>
                            <div><span className="text-muted-foreground">Saldo: </span><span className="text-primary">{formatCurrency(saldoRestante)}</span></div>
                            <div><span className="text-muted-foreground">Parcelas: </span><span className="text-foreground">{parcelasQuitadas}/{detalhes.length}</span></div>
                          </div>

                          {/* Individual parcels */}
                          <div className="space-y-1 pt-2 border-t border-border/50">
                            {detalhes.sort((a: any, b: any) => a.numero_parcela - b.numero_parcela).map((d: any) => (
                              <div key={d.id} className="flex items-center justify-between text-xs py-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-primary font-medium">#{d.numero_parcela}</span>
                                  <span className="text-muted-foreground">{formatDate(d.data_vencimento)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-foreground">{formatCurrency(d.valor_real ?? d.valor_sugerido)}</span>
                                  <Badge variant="outline" className={`text-[10px] py-0 ${
                                    d.status === "Quitado" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                    d.status === "Atraso" ? "bg-destructive/10 text-destructive border-destructive/20" :
                                    "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                  }`}>
                                    {d.status}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Receitas */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Receitas</h3>
                {(receitas ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma receita encontrada</p>
                ) : (
                  <div className="space-y-2">
                    {(receitas ?? []).map(r => (
                      <div key={r.id} className="rounded-lg border border-border bg-secondary/20 p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-foreground">{r.produto_nome}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(r.data)} • {r.plataforma}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-emerald-400">{formatCurrency(r.valor_bruto)}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            onClick={(e) => { e.stopPropagation(); setEditReceita(r); }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add/Edit dialog */}
      <Dialog open={showForm} onOpenChange={() => closeForm()}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">{editCliente ? "Editar Cliente" : "Nova Cliente"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-muted-foreground">Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="bg-secondary/50 border-border" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-muted-foreground">Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="bg-secondary/50 border-border" /></div>
              <div><Label className="text-muted-foreground">Telefone</Label><Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} className="bg-secondary/50 border-border" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-muted-foreground">WhatsApp</Label><Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} className="bg-secondary/50 border-border" /></div>
              <div><Label className="text-muted-foreground">Instagram</Label><Input value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} className="bg-secondary/50 border-border" placeholder="@usuario" /></div>
            </div>
            <div><Label className="text-muted-foreground">Observação</Label><Textarea value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} className="bg-secondary/50 border-border" rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm} className="border-border">Cancelar</Button>
            <Button onClick={() => editCliente ? editarCliente.mutate() : criarCliente.mutate()} disabled={criarCliente.isPending || editarCliente.isPending} className="gold-gradient text-primary-foreground">
              {(criarCliente.isPending || editarCliente.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditarContratoDialog
        contrato={editContrato}
        onClose={() => setEditContrato(null)}
      />

      <EditarReceitaModal
        receita={editReceita}
        open={!!editReceita}
        onClose={() => {
          setEditReceita(null);
          queryClient.invalidateQueries({ queryKey: ["cliente-receitas"] });
        }}
      />
    </div>
  );
}
