import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

type Etapa = { id: string; pipeline_id: string; nome: string; ordem: number };
type Processo = {
  id: string; etapa: string; titulo: string; descricao: string | null;
  ordem: number; ativo: boolean; pipeline_id: string | null;
};

export default function PipelineEditorDialog({
  pipeline, open, onClose,
}: {
  pipeline: { id: string; nome: string } | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [novaEtapa, setNovaEtapa] = useState("");
  const [expandida, setExpandida] = useState<string | null>(null);
  const [tarefaForm, setTarefaForm] = useState<{ etapa: string; id?: string; titulo: string; descricao: string } | null>(null);

  useEffect(() => { setNome(pipeline?.nome ?? ""); }, [pipeline?.id, pipeline?.nome]);

  const { data: etapas, isLoading } = useQuery({
    queryKey: ["pipeline-etapas", pipeline?.id],
    enabled: !!pipeline?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_etapas" as any).select("*")
        .eq("pipeline_id", pipeline!.id).order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Etapa[];
    },
  });

  const { data: processos } = useQuery({
    queryKey: ["processos-pipeline", pipeline?.id],
    enabled: !!pipeline?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_etapa").select("*")
        .eq("pipeline_id", pipeline!.id).order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Processo[];
    },
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["pipeline-etapas"] });
    qc.invalidateQueries({ queryKey: ["processos-pipeline"] });
    qc.invalidateQueries({ queryKey: ["pipelines"] });
    qc.invalidateQueries({ queryKey: ["mentoradas"] });
  };

  const salvarNome = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pipelines").update({ nome: nome.trim() }).eq("id", pipeline!.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success("Pipeline atualizada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirPipeline = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pipelines").delete().eq("id", pipeline!.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success("Pipeline excluída"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const criarEtapa = useMutation({
    mutationFn: async () => {
      const n = novaEtapa.trim();
      if (!n) throw new Error("Informe o nome da etapa");
      const { error } = await supabase.from("pipeline_etapas" as any).insert({
        pipeline_id: pipeline!.id, nome: n, ordem: (etapas ?? []).length + 1,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { setNovaEtapa(""); invalidar(); toast.success("Etapa criada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const renomearEtapa = useMutation({
    mutationFn: async ({ etapa, novo }: { etapa: Etapa; novo: string }) => {
      const { error } = await supabase.from("pipeline_etapas" as any).update({ nome: novo } as any).eq("id", etapa.id);
      if (error) throw error;
      // mantém alunas e tarefas coerentes com o novo nome
      await supabase.from("mentoradas").update({ status_jornada: novo })
        .eq("pipeline_id", pipeline!.id).eq("status_jornada", etapa.nome);
      await supabase.from("processos_etapa").update({ etapa: novo })
        .eq("pipeline_id", pipeline!.id).eq("etapa", etapa.nome);
    },
    onSuccess: () => { invalidar(); toast.success("Etapa renomeada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirEtapa = useMutation({
    mutationFn: async (etapa: Etapa) => {
      const { count } = await supabase.from("mentoradas")
        .select("id", { count: "exact", head: true })
        .eq("pipeline_id", pipeline!.id).eq("status_jornada", etapa.nome);
      if ((count ?? 0) > 0) throw new Error(`Existem ${count} aluna(s) nessa etapa. Mova-as antes de excluir.`);
      await supabase.from("processos_etapa").delete().eq("pipeline_id", pipeline!.id).eq("etapa", etapa.nome);
      const { error } = await supabase.from("pipeline_etapas" as any).delete().eq("id", etapa.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success("Etapa excluída"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const moverEtapa = useMutation({
    mutationFn: async ({ etapa, dir }: { etapa: Etapa; dir: -1 | 1 }) => {
      const lista = [...(etapas ?? [])];
      const i = lista.findIndex((e) => e.id === etapa.id);
      const j = i + dir;
      if (j < 0 || j >= lista.length) return;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      for (let k = 0; k < lista.length; k++) {
        await supabase.from("pipeline_etapas" as any).update({ ordem: k + 1 } as any).eq("id", lista[k].id);
      }
    },
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarTarefa = useMutation({
    mutationFn: async () => {
      const f = tarefaForm!;
      if (!f.titulo.trim()) throw new Error("Informe o título da tarefa");
      if (f.id) {
        const { error } = await supabase.from("processos_etapa")
          .update({ titulo: f.titulo.trim(), descricao: f.descricao || null }).eq("id", f.id);
        if (error) throw error;
      } else {
        const qtd = (processos ?? []).filter((p) => p.etapa === f.etapa).length;
        const { error } = await supabase.from("processos_etapa").insert({
          etapa: f.etapa, titulo: f.titulo.trim(), descricao: f.descricao || null,
          ordem: qtd + 1, pipeline_id: pipeline!.id,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { setTarefaForm(null); invalidar(); toast.success("Tarefa salva"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirTarefa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("processos_etapa").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success("Tarefa removida"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!pipeline) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar pipeline</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome da pipeline</Label>
            <div className="flex gap-2">
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              <Button onClick={() => salvarNome.mutate()} disabled={salvarNome.isPending || !nome.trim()}>
                Salvar
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Etapas</Label>
              <Badge variant="secondary">{(etapas ?? []).length}</Badge>
            </div>

            {isLoading ? (
              <div className="flex h-20 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <ul className="space-y-2">
                {(etapas ?? []).map((e) => {
                  const tarefas = (processos ?? []).filter((p) => p.etapa === e.nome);
                  const aberta = expandida === e.id;
                  return (
                    <li key={e.id} className="rounded-lg border border-border">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button type="button" className="min-w-0 flex-1 text-left text-sm font-medium truncate"
                          onClick={() => setExpandida(aberta ? null : e.id)}>
                          {e.nome}
                          <span className="ml-2 text-[11px] text-muted-foreground">{tarefas.length} tarefa(s)</span>
                        </button>
                        <button className="text-muted-foreground hover:text-foreground" title="Subir"
                          onClick={() => moverEtapa.mutate({ etapa: e, dir: -1 })}>
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button className="text-muted-foreground hover:text-foreground" title="Descer"
                          onClick={() => moverEtapa.mutate({ etapa: e, dir: 1 })}>
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button className="text-muted-foreground hover:text-primary" title="Renomear"
                          onClick={() => {
                            const novo = window.prompt("Novo nome da etapa", e.nome);
                            if (novo?.trim() && novo.trim() !== e.nome) renomearEtapa.mutate({ etapa: e, novo: novo.trim() });
                          }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button className="text-muted-foreground hover:text-destructive" title="Excluir etapa"
                          onClick={() => { if (confirm(`Excluir a etapa "${e.nome}"?`)) excluirEtapa.mutate(e); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {aberta && (
                        <div className="border-t border-border px-3 py-2 space-y-2">
                          {tarefas.map((t) => (
                            <div key={t.id} className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm truncate">{t.titulo}</p>
                                {t.descricao && <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{t.descricao}</p>}
                              </div>
                              <button className="text-muted-foreground hover:text-primary"
                                onClick={() => setTarefaForm({ etapa: e.nome, id: t.id, titulo: t.titulo, descricao: t.descricao ?? "" })}>
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button className="text-muted-foreground hover:text-destructive"
                                onClick={() => excluirTarefa.mutate(t.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          {tarefas.length === 0 && (
                            <p className="text-xs text-muted-foreground">Nenhuma tarefa nesta etapa.</p>
                          )}
                          <Button size="sm" variant="outline"
                            onClick={() => setTarefaForm({ etapa: e.nome, titulo: "", descricao: "" })}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Nova tarefa
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex gap-2 pt-1">
              <Input placeholder="Nome da nova etapa" value={novaEtapa}
                onChange={(ev) => setNovaEtapa(ev.target.value)}
                onKeyDown={(ev) => { if (ev.key === "Enter") criarEtapa.mutate(); }} />
              <Button variant="outline" onClick={() => criarEtapa.mutate()} disabled={criarEtapa.isPending}>
                <Plus className="h-4 w-4 mr-1" /> Etapa
              </Button>
            </div>
          </div>

          <div className="flex justify-between pt-2 border-t border-border">
            <Button variant="ghost" className="text-destructive"
              onClick={() => { if (confirm("Excluir esta pipeline e suas etapas?")) excluirPipeline.mutate(); }}>
              <Trash2 className="h-4 w-4 mr-1" /> Excluir pipeline
            </Button>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </div>
        </div>

        <Dialog open={!!tarefaForm} onOpenChange={(o) => { if (!o) setTarefaForm(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tarefaForm?.id ? "Editar tarefa" : `Nova tarefa em ${tarefaForm?.etapa}`}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Título</Label>
                <Input value={tarefaForm?.titulo ?? ""}
                  onChange={(e) => setTarefaForm((f) => f && { ...f, titulo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição ou script</Label>
                <Textarea rows={4} value={tarefaForm?.descricao ?? ""}
                  onChange={(e) => setTarefaForm((f) => f && { ...f, descricao: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setTarefaForm(null)}>Cancelar</Button>
                <Button onClick={() => salvarTarefa.mutate()} disabled={salvarTarefa.isPending}>Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
