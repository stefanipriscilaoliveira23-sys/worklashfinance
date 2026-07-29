import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  STATUS_JORNADA, PROGRAMAS, FORMAS_PAGAMENTO, CHECKINS_PADRAO,
  addDias, addMeses, diasRestantes, interpolar, gerarTarefasDaEtapa,
} from "@/lib/mentoria";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Copy, Loader2, Plus, Trash2, Upload, FileText } from "lucide-react";

type Props = { id: string | null; onClose: () => void };

export default function MentoradaSheet({ id, onClose }: Props) {
  const qc = useQueryClient();
  const [novaNota, setNovaNota] = useState("");
  const [novaTarefa, setNovaTarefa] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: m, isLoading } = useQuery({
    queryKey: ["mentorada", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("mentoradas").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: tarefas } = useQuery({
    queryKey: ["mentorada-tarefas", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentorada_tarefas").select("*").eq("mentorada_id", id!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: acomp } = useQuery({
    queryKey: ["mentorada-acomp", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentorada_acompanhamentos").select("*").eq("mentorada_id", id!)
        .order("data_prevista", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: interacoes } = useQuery({
    queryKey: ["mentorada-interacoes", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentorada_interacoes").select("*").eq("mentorada_id", id!)
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: receitas } = useQuery({
    queryKey: ["mentorada-receitas", m?.cliente_id],
    enabled: !!m?.cliente_id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("receitas").select("*").eq("cliente_id", m!.cliente_id!)
        .order("data", { ascending: true });
      return (data ?? []) as Record<string, any>[];
    },

  });

  const { data: modelos } = useQuery({
    queryKey: ["mensagens-modelo"],
    queryFn: async () => {
      const { data } = await supabase.from("mensagens_modelo").select("*").order("tipo");
      return data ?? [];
    },
  });

  const salvar = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from("mentoradas").update(patch).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mentorada", id] });
      qc.invalidateQueries({ queryKey: ["mentoradas"] });
      toast.success("Atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTarefa = useMutation({
    mutationFn: async ({ tid, valor }: { tid: string; valor: boolean }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data: tarefa, error } = await supabase.from("mentorada_tarefas")
        .update({
          concluida: valor,
          concluida_em: valor ? new Date().toISOString() : null,
          responsavel: valor ? auth?.user?.id ?? null : null,
        })
        .eq("id", tid).select("titulo").single();
      if (error) throw error;
      if (valor) {
        await supabase.from("mentorada_interacoes").insert({
          mentorada_id: id!,
          tipo: "Tarefa",
          conteudo: `Tarefa concluída: ${tarefa?.titulo ?? ""}`,
          autor: auth?.user?.email ?? null,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mentorada-tarefas", id] });
      qc.invalidateQueries({ queryKey: ["mentorada-tarefas-todas"] });
      qc.invalidateQueries({ queryKey: ["mentorada-interacoes", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const addTarefa = useMutation({
    mutationFn: async () => {
      if (!novaTarefa.trim()) throw new Error("Descreva a tarefa");
      const { error } = await supabase.from("mentorada_tarefas").insert({
        mentorada_id: id!, titulo: novaTarefa.trim(),
        categoria: "Ação da equipe", ordem: (tarefas?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => { setNovaTarefa(""); qc.invalidateQueries({ queryKey: ["mentorada-tarefas", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removerTarefa = useMutation({
    mutationFn: async (tid: string) => {
      const { error } = await supabase.from("mentorada_tarefas").delete().eq("id", tid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mentorada-tarefas", id] }),
  });

  const toggleAcomp = useMutation({
    mutationFn: async ({ aid, valor }: { aid: string; valor: boolean }) => {
      const { error } = await supabase.from("mentorada_acompanhamentos")
        .update({ feito: valor, feito_em: valor ? new Date().toISOString() : null })
        .eq("id", aid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mentorada-acomp", id] }),
  });

  const gerarCheckins = useMutation({
    mutationFn: async () => {
      if (!m?.data_inicio) throw new Error("Defina a data de início primeiro");
      const existentes = new Set((acomp ?? []).map((a) => a.tipo));
      const novos = CHECKINS_PADRAO.filter((c) => !existentes.has(c.tipo)).map((c) => ({
        mentorada_id: id!, tipo: c.tipo, data_prevista: addDias(m.data_inicio!, c.dias),
      }));
      if (!novos.length) throw new Error("Check-ins já criados");
      const { error } = await supabase.from("mentorada_acompanhamentos").insert(novos);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Check-ins gerados"); qc.invalidateQueries({ queryKey: ["mentorada-acomp", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addNota = useMutation({
    mutationFn: async () => {
      if (!novaNota.trim()) throw new Error("Escreva algo antes de salvar");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("mentorada_interacoes").insert({
        mentorada_id: id!, conteudo: novaNota.trim(), tipo: "Nota",
        autor: auth?.user?.email ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setNovaNota(""); qc.invalidateQueries({ queryKey: ["mentorada-interacoes", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function uploadContrato(file: File) {
    setUploading(true);
    try {
      const path = `${id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("contratos-mentoria").upload(path, file);
      if (error) throw error;
      await salvar.mutateAsync({ contrato_url: path });
      toast.success("Documento enviado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function abrirContrato() {
    if (!m?.contrato_url) return;
    const { data, error } = await supabase.storage
      .from("contratos-mentoria").createSignedUrl(m.contrato_url, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  }

  function copiar(texto: string) {
    navigator.clipboard.writeText(texto);
    toast.success("Mensagem copiada");
  }

  const restantes = diasRestantes(m?.data_termino);

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {isLoading || !m ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-2">
                {m.nome}
                <Badge variant="secondary">{m.status_jornada}</Badge>
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                {m.programa} · {m.prazo_meses} meses
                {restantes !== null && ` · ${restantes >= 0 ? `${restantes} dias restantes` : `encerrada há ${-restantes} dias`}`}
              </p>
            </SheetHeader>

            <Tabs defaultValue="dados">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
                <TabsTrigger value="financeiro">Financeiro</TabsTrigger>

                <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
                <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
                <TabsTrigger value="renovacao">Renovação</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
                <TabsTrigger value="diario">Diário</TabsTrigger>
              </TabsList>

              {/* DADOS */}
              <TabsContent value="dados" className="space-y-3 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Nome" value={m.nome} onSave={(v) => salvar.mutate({ nome: v })} />
                  <Campo label="Instagram" value={m.instagram} onSave={(v) => salvar.mutate({ instagram: v })} />
                  <Campo label="E-mail" value={m.email} onSave={(v) => salvar.mutate({ email: v })} />
                  <Campo label="Telefone" value={m.telefone} onSave={(v) => salvar.mutate({ telefone: v })} />
                  <Campo label="CPF" value={m.cpf} onSave={(v) => salvar.mutate({ cpf: v })} />
                  <div className="space-y-1.5">
                    <Label className="text-xs">Programa</Label>
                    <Select value={m.programa} onValueChange={(v) => salvar.mutate({ programa: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PROGRAMAS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Campo label="Prazo (meses)" type="number" value={String(m.prazo_meses ?? "")}
                    onSave={(v) => salvar.mutate({ prazo_meses: Number(v) || 0 })} />
                  <div className="space-y-1.5">
                    <Label className="text-xs">Etapa da jornada</Label>
                    <Select value={m.status_jornada} onValueChange={(v) => salvar.mutate({ status_jornada: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_JORNADA.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Campo label="Data de início" type="date" value={m.data_inicio}
                    onSave={(v) => salvar.mutate({
                      data_inicio: v || null,
                      data_termino: v ? addMeses(v, m.prazo_meses ?? 0) : null,
                    })} />
                  <Campo label="Data de término" type="date" value={m.data_termino}
                    onSave={(v) => salvar.mutate({ data_termino: v || null })} />
                  <Campo label="Vendedor" value={m.vendedor} onSave={(v) => salvar.mutate({ vendedor: v })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Observação</Label>
                  <Textarea defaultValue={m.observacao ?? ""}
                    onBlur={(e) => e.target.value !== (m.observacao ?? "") && salvar.mutate({ observacao: e.target.value })} />
                </div>
                {m.status_jornada === "Cancelada" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Data de saída" type="date" value={m.data_saida}
                      onSave={(v) => salvar.mutate({ data_saida: v || null })} />
                    <Campo label="Motivo do cancelamento" value={m.motivo_cancelamento}
                      onSave={(v) => salvar.mutate({ motivo_cancelamento: v })} />
                  </div>
                )}
              </TabsContent>

              {/* TAREFAS DA ETAPA */}
              <TabsContent value="tarefas" className="space-y-3 pt-4">
                {(() => {
                  const daEtapa = (tarefas ?? []).filter((t) => t.etapa === m.status_jornada);
                  const feitas = daEtapa.filter((t) => t.concluida).length;
                  const pct = daEtapa.length ? Math.round((feitas / daEtapa.length) * 100) : 0;
                  return (
                    <>
                      <div className="rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium">Etapa atual: {m.status_jornada}</p>
                          <span className="text-xs text-muted-foreground">
                            {feitas}/{daEtapa.length} tarefas concluídas
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <ul className="space-y-2">
                        {daEtapa.map((t) => (
                          <li key={t.id} className="flex items-start gap-2 rounded-lg border border-border px-3 py-2">
                            <Checkbox className="mt-0.5" checked={t.concluida}
                              onCheckedChange={(c) => toggleTarefa.mutate({ tid: t.id, valor: !!c })} />
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm ${t.concluida ? "line-through text-muted-foreground" : ""}`}>{t.titulo}</p>
                              {t.descricao && (
                                <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{t.descricao}</p>
                              )}
                              {t.concluida && t.concluida_em && (
                                <p className="text-[10px] text-muted-foreground">
                                  Concluída em {new Date(t.concluida_em).toLocaleString("pt-BR")}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                        {daEtapa.length === 0 && (
                          <li className="text-sm text-muted-foreground">
                            Nenhuma tarefa gerada para esta etapa. Configure em Mentoria, aba Processos.
                          </li>
                        )}
                      </ul>
                      <Button variant="outline" size="sm" onClick={() => gerarTarefas.mutate()}
                        disabled={gerarTarefas.isPending}>
                        Gerar tarefas da etapa
                      </Button>
                    </>
                  );
                })()}
              </TabsContent>

              {/* FINANCEIRO */}

              <TabsContent value="financeiro" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Valor da mentoria" type="number" value={m.valor_mentoria != null ? String(m.valor_mentoria) : ""}
                    onSave={(v) => salvar.mutate({ valor_mentoria: Number(v) || 0 })} />
                  <Campo label="Próxima parcela" type="date" value={m.proxima_parcela}
                    onSave={(v) => salvar.mutate({ proxima_parcela: v || null })} />
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status de cobrança</Label>
                    <Select value={m.status_cobranca ?? "Em dia"} onValueChange={(v) => salvar.mutate({ status_cobranca: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Em dia", "Aguardando pagamento", "Em atraso", "Quitada"].map((s) =>
                          <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Formas de pagamento</Label>
                  <div className="flex flex-wrap gap-3">
                    {FORMAS_PAGAMENTO.map((f) => {
                      const atual = m.forma_pagamento ?? [];
                      const marcado = atual.includes(f);
                      return (
                        <label key={f} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={marcado} onCheckedChange={(c) => salvar.mutate({
                            forma_pagamento: c ? [...atual, f] : atual.filter((x) => x !== f),
                          })} />
                          {f}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Lançamentos no financeiro {m.cliente_id ? "" : "(vincule um cliente para ver)"}
                  </p>
                  {(receitas ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum lançamento encontrado.</p>
                  ) : (
                    <ul className="divide-y divide-border rounded-lg border border-border">
                      {(receitas ?? []).map((r: Record<string, any>) => (
                        <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="truncate">{formatDate(r.data)} · {r.produto ?? r.descricao ?? "Receita"}</span>
                          <span className="font-medium">{formatCurrency(r.valor_liquido ?? r.valor ?? 0)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>

              {/* ONBOARDING */}
              <TabsContent value="onboarding" className="space-y-3 pt-4">
                <ul className="space-y-2">
                  {(tarefas ?? []).map((t) => (
                    <li key={t.id} className="flex items-start gap-2 rounded-lg border border-border px-3 py-2">
                      <Checkbox className="mt-0.5" checked={t.concluida}
                        onCheckedChange={(c) => toggleTarefa.mutate({ tid: t.id, valor: !!c })} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${t.concluida ? "line-through text-muted-foreground" : ""}`}>{t.titulo}</p>
                        <p className="text-[11px] text-muted-foreground">{t.categoria}</p>
                      </div>
                      <button onClick={() => removerTarefa.mutate(t.id)}
                        className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Input placeholder="Nova tarefa" value={novaTarefa} onChange={(e) => setNovaTarefa(e.target.value)} />
                  <Button onClick={() => addTarefa.mutate()}><Plus className="h-4 w-4" /></Button>
                </div>
              </TabsContent>

              {/* ACOMPANHAMENTO */}
              <TabsContent value="acompanhamento" className="space-y-3 pt-4">
                <Button variant="outline" size="sm" onClick={() => gerarCheckins.mutate()}>
                  Gerar check-ins automáticos
                </Button>
                <ul className="space-y-2">
                  {(acomp ?? []).map((a) => (
                    <li key={a.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                      <Checkbox checked={a.feito} onCheckedChange={(c) => toggleAcomp.mutate({ aid: a.id, valor: !!c })} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${a.feito ? "line-through text-muted-foreground" : ""}`}>{a.tipo}</p>
                        <p className="text-[11px] text-muted-foreground">Previsto para {formatDate(a.data_prevista)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Scripts prontos</p>
                  <div className="space-y-2">
                    {(modelos ?? []).map((mo) => (
                      <div key={mo.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{mo.tipo}</p>
                          <Button variant="ghost" size="sm" onClick={() => copiar(interpolar(mo.texto, m.nome))}>
                            <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                          {interpolar(mo.texto, m.nome)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* RENOVAÇÃO */}
              <TabsContent value="renovacao" className="space-y-3 pt-4">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground">Término previsto</p>
                  <p className="text-lg font-semibold">{formatDate(m.data_termino)}</p>
                  {restantes !== null && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {restantes >= 0 ? `Faltam ${restantes} dias` : `Encerrada há ${-restantes} dias`}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status da renovação</Label>
                    <Select value={m.status_renovacao ?? "Não venceu"} onValueChange={(v) => salvar.mutate({ status_renovacao: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Não venceu", "Em conversa", "Renovou", "Não renovou"].map((s) =>
                          <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Campo label="Renovações" type="number" value={String(m.qtd_renovacoes ?? 0)}
                    onSave={(v) => salvar.mutate({ qtd_renovacoes: Number(v) || 0 })} />
                </div>
                <Button variant="outline" onClick={() => {
                  if (!m.data_termino) return toast.error("Defina a data de término");
                  salvar.mutate({
                    qtd_renovacoes: (m.qtd_renovacoes ?? 0) + 1,
                    data_inicio: m.data_termino,
                    data_termino: addMeses(m.data_termino, m.prazo_meses ?? 0),
                    status_renovacao: "Renovou",
                    status_jornada: "Ativa",
                  });
                }}>
                  Registrar renovação
                </Button>
              </TabsContent>

              {/* DOCUMENTOS */}
              <TabsContent value="documentos" className="space-y-3 pt-4">
                <div className="grid grid-cols-1 gap-3">
                  <Campo label="Link do plano de ação" value={m.link_plano_acao}
                    onSave={(v) => salvar.mutate({ link_plano_acao: v })} />
                  <Campo label="Link do briefing" value={m.link_briefing}
                    onSave={(v) => salvar.mutate({ link_briefing: v })} />
                  <Campo label="Link do formulário de onboarding" value={m.link_formulario_onboarding}
                    onSave={(v) => salvar.mutate({ link_formulario_onboarding: v })} />
                </div>
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <p className="text-sm font-medium">Contrato</p>
                  {m.contrato_url ? (
                    <Button variant="outline" size="sm" onClick={abrirContrato}>
                      <FileText className="h-4 w-4 mr-1" /> Abrir contrato
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum contrato enviado.</p>
                  )}
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer text-primary">
                    <Upload className="h-4 w-4" />
                    {uploading ? "Enviando..." : "Enviar arquivo"}
                    <input type="file" className="hidden" disabled={uploading}
                      onChange={(e) => e.target.files?.[0] && uploadContrato(e.target.files[0])} />
                  </label>
                </div>
              </TabsContent>

              {/* DIÁRIO */}
              <TabsContent value="diario" className="space-y-3 pt-4">
                <Textarea placeholder="Registrar uma interação, call ou observação..."
                  value={novaNota} onChange={(e) => setNovaNota(e.target.value)} />
                <Button onClick={() => addNota.mutate()} size="sm">Salvar registro</Button>
                <ul className="space-y-2">
                  {(interacoes ?? []).map((i) => (
                    <li key={i.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm whitespace-pre-wrap">{i.conteudo}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(i.data).toLocaleString("pt-BR")} {i.autor ? `· ${i.autor}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Campo({ label, value, onSave, type = "text" }: {
  label: string; value?: string | null; onSave: (v: string) => void; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} defaultValue={value ?? ""}
        onBlur={(e) => e.target.value !== (value ?? "") && onSave(e.target.value)} />
    </div>
  );
}
