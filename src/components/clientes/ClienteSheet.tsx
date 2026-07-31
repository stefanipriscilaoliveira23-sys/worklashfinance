import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, DollarSign, Pencil, Save, ShoppingBag } from "lucide-react";
import TagsEditor from "@/components/clientes/TagsEditor";
import { ClienteInteracoes, ClienteDocumentos } from "@/components/clientes/ClienteExtras";

type Cliente = Record<string, any>;

export function produtosDasTags(tags: string[]) {
  return [...new Set(
    (tags ?? [])
      .filter((t) => t.toLowerCase().includes("comprou"))
      .map((t) =>
        t
          .replace(/\[|\]/g, " ")
          .replace(/comprou/gi, " ")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean)
  )];
}

export default function ClienteSheet({ cliente, onClose, onEditContrato, onEditReceita }: {
  cliente: Cliente | null;
  onClose: () => void;
  onEditContrato: (c: any) => void;
  onEditReceita: (r: any) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", whatsapp: "", instagram: "", observacao: "" });
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (!cliente) return;
    setForm({
      nome: cliente.nome ?? "", email: cliente.email ?? "", telefone: "",
      whatsapp: cliente.whatsapp || cliente.telefone || "",
      instagram: cliente.instagram ?? "", observacao: cliente.observacao ?? "",
    });
    setTags([...new Set((cliente.tags ?? []) as string[])]);
  }, [cliente?.id]);

  const { data: contratos } = useQuery({
    queryKey: ["cliente-contratos", cliente?.id, cliente?.nome],
    enabled: !!cliente,
    queryFn: async () => {
      const { data: byId } = await supabase.from("parcelas_mentoria")
        .select("*, parcelas_mentoria_detalhe(*)").eq("cliente_id", cliente!.id).order("criado_em", { ascending: false });
      const { data: byNome } = await supabase.from("parcelas_mentoria")
        .select("*, parcelas_mentoria_detalhe(*)").eq("cliente_nome", cliente!.nome).is("cliente_id", null)
        .order("criado_em", { ascending: false });
      const seen = new Set<string>();
      return [...(byId ?? []), ...(byNome ?? [])].filter((c: any) => {
        if (seen.has(c.id)) return false; seen.add(c.id); return true;
      }) as any[];
    },
  });

  const { data: receitas } = useQuery({
    queryKey: ["cliente-receitas", cliente?.id, cliente?.nome, cliente?.email],
    enabled: !!cliente,
    queryFn: async () => {
      const conditions = [`cliente_id.eq.${cliente!.id}`, `cliente_nome.eq.${cliente!.nome}`];
      if (cliente!.email) conditions.push(`cliente_email.eq.${cliente!.email}`);
      const { data } = await supabase.from("receitas").select("*").or(conditions.join(",")).order("data", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Nome obrigatório");
      const { error } = await supabase.from("clientes").update({
        nome: form.nome.trim(),
        email: form.email || null,
        telefone: form.telefone || null,
        whatsapp: form.whatsapp || null,
        instagram: form.instagram || null,
        observacao: form.observacao || null,
        tags,
      } as any).eq("id", cliente!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clientes-busca"] });
      qc.invalidateQueries({ queryKey: ["clientes-tags"] });
      toast.success("Ficha atualizada");
    },
    onError: (e: Error) =>
      toast.error(`${e.message}`.toLowerCase().includes("duplicate")
        ? "Já existe outra cliente com esse nome e contato"
        : e.message),
  });

  const hoje = new Date().toISOString().slice(0, 10);
  const atrasada = (d: any) => d.status !== "Quitado" && (d.status === "Atraso" || (d.data_vencimento && d.data_vencimento < hoje));
  const todasParcelas = (contratos ?? []).flatMap((c: any) => c.parcelas_mentoria_detalhe ?? []);
  const emAtraso = todasParcelas.filter(atrasada);

  const produtosTags = produtosDasTags(tags);
  const produtosReceitas = [...new Set((receitas ?? []).map((r: any) => r.produto_nome).filter(Boolean))];
  const produtosContratos = [...new Set((contratos ?? []).map((c: any) => c.tipo_mentoria).filter(Boolean))];

  return (
    <Sheet open={!!cliente} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl bg-card border-border overflow-y-auto">
        {cliente && (
          <div className="space-y-5">
            <SheetHeader>
              <SheetTitle className="text-foreground flex items-center gap-2">
                {form.nome || cliente.nome}
                {emAtraso.length > 0 && (
                  <span className="rounded-full border border-destructive/40 bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                    Inadimplente
                  </span>
                )}
              </SheetTitle>
              {cliente.criado_em && (
                <p className="text-xs text-muted-foreground">Cliente desde {formatDate(String(cliente.criado_em).slice(0, 10))}</p>
              )}
            </SheetHeader>

            <Tabs defaultValue="perfil">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="perfil">Perfil</TabsTrigger>
                <TabsTrigger value="produtos">Produtos</TabsTrigger>
                <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                <TabsTrigger value="interacoes">Interações</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
              </TabsList>

              {/* PERFIL — tudo editável */}
              <TabsContent value="perfil" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Nome</Label>
                    <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} className="bg-secondary/50 border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">E-mail</Label>
                    <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="bg-secondary/50 border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">WhatsApp</Label>
                    <Input value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} className="bg-secondary/50 border-border" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Instagram</Label>
                    <Input value={form.instagram} onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))} className="bg-secondary/50 border-border" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Observação</Label>
                  <Textarea value={form.observacao} onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))} className="bg-secondary/50 border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tags</Label>
                  <TagsEditor tags={tags} onChange={setTags} />
                </div>
              </TabsContent>

              {/* PRODUTOS */}
              <TabsContent value="produtos" className="space-y-4 pt-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Comprou (identificado pelas tags)</p>
                  {produtosTags.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma compra identificada nas tags.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {produtosTags.map((p) => (
                        <span key={p} className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-500">
                          <ShoppingBag className="h-3 w-3" /> {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Compras lançadas no financeiro</p>
                  {produtosReceitas.length === 0 && produtosContratos.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum lançamento.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {[...produtosReceitas, ...produtosContratos].map((p, i) => (
                        <Badge key={`${p}-${i}`} variant="outline" className="text-[11px]">{p as string}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* FINANCEIRO */}
              <TabsContent value="financeiro" className="space-y-5 pt-4">
                <div className="rounded-lg border border-border bg-secondary/20 p-4">
                  <p className="text-xs text-muted-foreground uppercase">Total gasto conosco</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(
                    (receitas ?? []).reduce((s: number, r: any) => s + (r.valor_bruto ?? 0), 0) +
                    (contratos ?? []).reduce((s: number, c: any) => s + ((c.parcelas_mentoria_detalhe ?? [])
                      .filter((d: any) => d.status === "Quitado")
                      .reduce((a: number, d: any) => a + (d.valor_real ?? d.valor_sugerido ?? 0), 0)), 0)
                  )}</p>
                </div>

                {emAtraso.length > 0 && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                    <p className="text-xs font-semibold text-destructive mb-2">
                      Parcelas em atraso ({emAtraso.length})
                    </p>
                    <ul className="space-y-1">
                      {emAtraso.sort((a: any, b: any) => a.data_vencimento.localeCompare(b.data_vencimento)).map((d: any) => {
                        const dias = Math.floor((new Date(hoje + "T00:00:00").getTime() - new Date(d.data_vencimento + "T00:00:00").getTime()) / 86400000);
                        return (
                          <li key={d.id} className="flex items-center justify-between text-xs text-destructive">
                            <span>{d.numero_parcela}ª · venceu em {formatDate(d.data_vencimento)} ({dias} dias)</span>
                            <span className="font-medium">{formatCurrency(d.valor_real ?? d.valor_sugerido ?? 0)}</span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-2 text-xs font-semibold text-destructive">
                      Total em atraso: {formatCurrency(emAtraso.reduce((s: number, d: any) => s + (d.valor_real ?? d.valor_sugerido ?? 0), 0))}
                    </p>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Contratos de mentoria</h3>
                  {(contratos ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum contrato encontrado</p>
                  ) : (
                    <div className="space-y-3">
                      {(contratos ?? []).map((contrato: any) => {
                        const detalhes = [...(contrato.parcelas_mentoria_detalhe ?? [])].sort((a: any, b: any) => a.numero_parcela - b.numero_parcela);
                        const totalPago = detalhes.reduce((acc: number, d: any) => acc + (d.valor_pago_parcial ?? 0), 0);
                        const saldo = detalhes.reduce((acc: number, d: any) => acc + (d.saldo_parcela ?? 0), 0);
                        const quitadas = detalhes.filter((d: any) => d.status === "Quitado").length;
                        const fim = contrato.data_fim_prevista;
                        const diasFim = fim ? Math.ceil((new Date(fim + "T00:00:00").getTime() - Date.now()) / 86400000) : null;
                        const prox = detalhes.filter((d: any) => d.status !== "Quitado" && d.data_vencimento >= hoje)[0];
                        return (
                          <div key={contrato.id} className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-foreground">{contrato.tipo_mentoria}</p>
                                <p className="text-xs text-muted-foreground">
                                  {contrato.numero_contrato ? `${contrato.numero_contrato} · ` : ""}Início: {formatDate(contrato.data_inicio)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                  onClick={() => onEditContrato(contrato)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Badge variant="outline" className={
                                  contrato.status_geral === "Quitado" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                  contrato.status_geral === "Atraso" ? "bg-destructive/10 text-destructive border-destructive/20" :
                                  "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                }>{contrato.status_geral}</Badge>
                              </div>
                            </div>
                            <div className="rounded-lg bg-secondary/30 p-2 space-y-1">
                              {fim && (
                                <div className="flex items-center gap-2 text-xs">
                                  {diasFim! < 0 ? (
                                    <><AlertTriangle className="h-3 w-3 text-destructive" /><span className="text-destructive">Vencida há {Math.abs(diasFim!)} dias ({formatDate(fim)})</span></>
                                  ) : (
                                    <><Clock className="h-3 w-3 text-primary" /><span className="text-primary">Vence em {diasFim} dias ({formatDate(fim)})</span></>
                                  )}
                                </div>
                              )}
                              {prox && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <DollarSign className="h-3 w-3" /> Próxima parcela em {formatDate(prox.data_vencimento)}
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div><span className="text-muted-foreground">Valor total: </span>{formatCurrency(contrato.valor_total)}</div>
                              <div><span className="text-muted-foreground">Entrada: </span>{formatCurrency(contrato.entrada_valor)}</div>
                              <div><span className="text-muted-foreground">Total pago: </span><span className="text-emerald-400">{formatCurrency(totalPago + (contrato.entrada_valor ?? 0))}</span></div>
                              <div><span className="text-muted-foreground">Saldo: </span><span className="text-primary">{formatCurrency(saldo)}</span></div>
                              <div><span className="text-muted-foreground">Parcelas: </span>{quitadas}/{detalhes.length}</div>
                            </div>
                            <div className="space-y-1 pt-2 border-t border-border/50">
                              {detalhes.map((d: any) => {
                                const late = atrasada(d);
                                return (
                                  <div key={d.id} className={`flex items-center justify-between rounded px-1 text-xs py-1 ${late ? "bg-destructive/10" : ""}`}>
                                    <div className="flex items-center gap-2">
                                      <span className={late ? "font-medium text-destructive" : "font-medium text-primary"}>#{d.numero_parcela}</span>
                                      <span className={late ? "text-destructive" : "text-muted-foreground"}>{formatDate(d.data_vencimento)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={late ? "text-destructive font-medium" : "text-foreground"}>{formatCurrency(d.valor_real ?? d.valor_sugerido)}</span>
                                      <Badge variant="outline" className={`text-[10px] py-0 ${
                                        d.status === "Quitado" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                        late ? "bg-destructive/10 text-destructive border-destructive/20" :
                                        "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                      }`}>{late ? "Atraso" : d.status}</Badge>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Receitas</h3>
                  {(receitas ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma receita encontrada</p>
                  ) : (
                    <div className="space-y-2">
                      {(receitas ?? []).map((r: any) => (
                        <div key={r.id} className="rounded-lg border border-border bg-secondary/20 p-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm text-foreground">{r.produto_nome}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(r.data)} • {r.plataforma}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-emerald-400">{formatCurrency(r.valor_bruto)}</span>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                              onClick={() => onEditReceita(r)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="interacoes" className="pt-4">
                <ClienteInteracoes clienteId={cliente.id} />
              </TabsContent>

              <TabsContent value="documentos" className="pt-4">
                <ClienteDocumentos clienteId={cliente.id} />
              </TabsContent>
            </Tabs>

            <div className="sticky bottom-0 -mx-6 border-t border-border bg-card px-6 py-3">
              <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}
                className="w-full gold-gradient text-primary-foreground">
                <Save className="h-4 w-4 mr-2" /> {salvar.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
