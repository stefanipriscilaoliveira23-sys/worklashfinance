import { useState, useMemo, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClienteSheet from "@/components/clientes/ClienteSheet";
import GerenciarTagsDialog from "@/components/clientes/GerenciarTagsDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { EditarReceitaModal } from "@/components/receitas/EditarReceitaModal";
import type { Tables } from "@/integrations/supabase/types";

export default function Clientes() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [tagsFiltro, setTagsFiltro] = useState<string[]>([]);
  const [produtoFiltro, setProdutoFiltro] = useState("");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [selectedCliente, setSelectedCliente] = useState<Tables<"clientes"> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editCliente, setEditCliente] = useState<Tables<"clientes"> | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", whatsapp: "", instagram: "", observacao: "" });
  const [editContrato, setEditContrato] = useState<Tables<"parcelas_mentoria"> | null>(null);
  const [editReceita, setEditReceita] = useState<any>(null);
  const [showTags, setShowTags] = useState(false);

  // debounce da busca
  useEffect(() => {
    const t = setTimeout(() => { setBuscaAtiva(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [tagsFiltro, produtoFiltro, dataDe, dataAte, pageSize]);

  const { data: tagOptions } = useQuery({
    queryKey: ["clientes-tags"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("clientes_tags");
      if (error) throw error;
      return (data ?? []) as { tag: string; total: number }[];
    },
  });

  const { data: produtoOptions } = useQuery({
    queryKey: ["clientes-produtos-opcoes"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos_catalogo").select("nome").order("nome");
      return [...new Set((data ?? []).map((p: any) => p.nome as string).filter(Boolean))];
    },
  });

  const { data: pagina, isLoading, isFetching } = useQuery({
    queryKey: ["clientes-busca", buscaAtiva, tagsFiltro, produtoFiltro, dataDe, dataAte, page, pageSize],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("buscar_clientes", {
        p_busca: buscaAtiva || null,
        p_tags: tagsFiltro.length ? tagsFiltro : null,
        p_produto: produtoFiltro || null,
        p_de: dataDe || null,
        p_ate: dataAte || null,
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
      });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      return { rows, total: rows.length ? Number(rows[0].total_count) : 0 };
    },
    placeholderData: (prev: any) => prev,
  });

  const clientes = pagina?.rows ?? [];
  const total = pagina?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filtrosAtivos = Boolean(buscaAtiva || (tagsFiltro && tagsFiltro.length) || produtoFiltro || dataDe || dataAte);

  const { data: totalGeral } = useQuery({
    queryKey: ["clientes-total-geral"],
    queryFn: async () => {
      const { count } = await supabase.from("clientes").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: totalMentoradas } = useQuery({
    queryKey: ["clientes-total-mentoradas"],
    queryFn: async () => {
      const { count } = await supabase.from("mentoradas").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });



  const { data: allContratos } = useQuery({
    queryKey: ["clientes-contratos-all"],
    queryFn: async () => {
      const { data } = await supabase.from("parcelas_mentoria").select("*, parcelas_mentoria_detalhe(*)").order("criado_em", { ascending: false });
      return data as any[] ?? [];
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clientes-busca"] }); toast.success("Cliente criada"); closeForm(); },
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clientes-busca"] }); toast.success("Cliente atualizada"); closeForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCliente = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("clientes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clientes-busca"] }); toast.success("Cliente excluída"); },
    onError: () => toast.error("Erro ao excluir — apenas administradores"),
  });

  const closeForm = () => { setShowForm(false); setEditCliente(null); setForm({ nome: "", email: "", telefone: "", whatsapp: "", instagram: "", observacao: "" }); };
  const openEdit = (c: Tables<"clientes">) => {
    setForm({ nome: c.nome, email: c.email ?? "", telefone: c.telefone ?? "", whatsapp: (c as any).whatsapp ?? "", instagram: (c as any).instagram ?? "", observacao: c.observacao ?? "" });
    setEditCliente(c); setShowForm(true);
  };

  const filtered = clientes;


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
            {total.toLocaleString("pt-BR")} cliente{total !== 1 ? "s" : ""}
          </Badge>

          <Button variant="outline" className="border-border" onClick={() => setShowTags(true)}>
            <Plus className="h-4 w-4 mr-2" /> Tags
          </Button>
          <Button onClick={() => { setEditCliente(null); setShowForm(true); }} className="gold-gradient text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Nova cliente
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Total de clientes</p>
            <p className="text-lg font-bold text-foreground">{(totalGeral ?? 0).toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Mentoradas</p>
            <p className="text-lg font-bold text-primary">{(totalMentoradas ?? 0).toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        {filtrosAtivos && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase text-primary tracking-wider">Filtradas</p>
              <p className="text-lg font-bold text-primary">{total.toLocaleString("pt-BR")}</p>
            </CardContent>
          </Card>
        )}
      </div>


      {/* Filtros */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, email, telefone ou @instagram..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border" />
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Produto</Label>
              <select
                value={produtoFiltro}
                onChange={e => setProdutoFiltro(e.target.value)}
                className="h-9 rounded-md border border-border bg-secondary/50 px-2 text-sm max-w-[180px]"
              >
                <option value="">Todos</option>
                {(produtoOptions ?? []).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Cadastro</Label>
              <Input type="date" value={dataDe} onChange={e => setDataDe(e.target.value)} className="h-9 w-[140px] bg-secondary/50 border-border text-xs" />
              <span className="text-xs text-muted-foreground">até</span>
              <Input type="date" value={dataAte} onChange={e => setDataAte(e.target.value)} className="h-9 w-[140px] bg-secondary/50 border-border text-xs" />
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Label className="text-xs text-muted-foreground pt-1.5 whitespace-nowrap">Tags</Label>
          <div className="flex-1">
            <select
              value=""
              onChange={e => { const v = e.target.value; if (v && !tagsFiltro.includes(v)) setTagsFiltro(t => [...t, v]); }}
              className="h-9 rounded-md border border-border bg-secondary/50 px-2 text-sm max-w-full"
            >
              <option value="">Adicionar tag ao filtro...</option>
              {(tagOptions ?? []).map(t => <option key={t.tag} value={t.tag}>{t.tag} ({t.total})</option>)}
            </select>
            {tagsFiltro.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tagsFiltro.map(t => (
                  <button key={t} onClick={() => setTagsFiltro(x => x.filter(y => y !== t))}
                    className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/20">
                    {t} ✕
                  </button>
                ))}
              </div>
            )}
          </div>
          {(tagsFiltro.length > 0 || produtoFiltro || dataDe || dataAte || search) && (
            <Button variant="outline" size="sm" className="border-border"
              onClick={() => { setTagsFiltro([]); setProdutoFiltro(""); setDataDe(""); setDataAte(""); setSearch(""); }}>
              Limpar filtros
            </Button>
          )}
        </div>
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
                  <th className="p-3 text-xs font-medium text-muted-foreground text-left">Tags</th>
                  <th className="p-3 text-xs font-medium text-muted-foreground text-left">Cadastro</th>
                  <th className="p-3 text-xs font-medium text-muted-foreground text-left">Ações</th>
                  <th className="p-3 text-xs font-medium text-muted-foreground text-left"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">Nenhum cliente encontrado</td></tr>
                )}
                {filtered.map(c => (
                  <tr
                    key={c.id}
                    className="border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer"
                    onClick={() => setSelectedCliente(c)}
                  >
                    <td className="p-3 font-medium">{c.nome}</td>
                    <td className="p-3 text-muted-foreground text-xs">{c.email || "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs">{(c as any).whatsapp || c.telefone || "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs">{(c as any).instagram || "—"}</td>
                    <td className="p-3 max-w-[260px]" onClick={e => e.stopPropagation()}>
                      {((c as any).tags ?? []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="flex flex-wrap gap-1 text-left">
                              {[...new Set((c as any).tags as string[])].slice(0, 3).map((t, i) => (
                                <span key={`${t}-${i}`} className="rounded-full border border-border bg-secondary/50 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-primary">{t}</span>
                              ))}
                              {[...new Set((c as any).tags as string[])].length > 3 && (
                                <span className="text-[10px] text-primary">+{[...new Set((c as any).tags as string[])].length - 3}</span>
                              )}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="max-h-72 w-72 overflow-y-auto bg-card border-border">
                            <p className="text-xs font-semibold mb-2">Tags de {c.nome}</p>
                            <div className="flex flex-wrap gap-1">
                              {[...new Set((c as any).tags as string[])].map((t, i) => (
                                <span key={`${t}-${i}`} className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{t}</span>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </td>
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

        {/* Paginação */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Mostrar</span>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="h-8 rounded-md border border-border bg-secondary/50 px-2 text-xs"
            >
              {[20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>por página · {total.toLocaleString("pt-BR")} no total {isFetching && "· carregando..."}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-border" disabled={page <= 1} onClick={() => setPage(1)}>«</Button>
            <Button variant="outline" size="sm" className="border-border" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" className="border-border" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            <Button variant="outline" size="sm" className="border-border" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>»</Button>
          </div>
        </div>
      </div>


      {/* Ficha completa da cliente */}
      <ClienteSheet
        cliente={selectedCliente as any}
        onClose={() => setSelectedCliente(null)}
        onEditContrato={(c) => setEditContrato(c)}
        onEditReceita={(r) => setEditReceita(r)}
      />

      <GerenciarTagsDialog open={showTags} onOpenChange={setShowTags} podeExcluir={role === "admin"} />

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
