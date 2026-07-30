import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { STATUS_JORNADA, gerarTarefasDaEtapa } from "@/lib/mentoria";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { GripVertical, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";

type Processo = {
  id: string;
  etapa: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
};

export default function ProcessosTab() {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<Processo | null>(null);
  const [novaEtapa, setNovaEtapa] = useState<string | null>(null);
  const [form, setForm] = useState({ titulo: "", descricao: "" });
  const [arrastando, setArrastando] = useState<Processo | null>(null);

  const { data: processos, isLoading } = useQuery({
    queryKey: ["processos-etapa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_etapa").select("*")
        .order("etapa").order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Processo[];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.titulo.trim()) throw new Error("Informe o título da tarefa");
      if (editando) {
        const { error } = await supabase.from("processos_etapa")
          .update({ titulo: form.titulo.trim(), descricao: form.descricao || null })
          .eq("id", editando.id);
        if (error) throw error;
      } else {
        const etapa = novaEtapa!;
        const maior = (processos ?? []).filter((p) => p.etapa === etapa).length;
        const { error } = await supabase.from("processos_etapa").insert({
          etapa, titulo: form.titulo.trim(), descricao: form.descricao || null, ordem: maior + 1,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setEditando(null); setNovaEtapa(null); setForm({ titulo: "", descricao: "" });
      qc.invalidateQueries({ queryKey: ["processos-etapa"] });
      toast.success("Processo salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("processos_etapa").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["processos-etapa"] });
      toast.success("Processo removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reordenar = useMutation({
    mutationFn: async ({ etapa, ids }: { etapa: string; ids: string[] }) => {
      for (let i = 0; i < ids.length; i++) {
        const { error } = await supabase.from("processos_etapa").update({ ordem: i + 1 }).eq("id", ids[i]);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["processos-etapa"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const aplicarNaEtapa = useMutation({
    mutationFn: async (etapa: string) => {
      const { data: alunas, error } = await supabase
        .from("mentoradas").select("id").eq("status_jornada", etapa);
      if (error) throw error;
      let criadas = 0;
      for (const a of alunas ?? []) criadas += await gerarTarefasDaEtapa(a.id, etapa);
      return { alunas: (alunas ?? []).length, criadas };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["mentorada-tarefas-todas"] });
      qc.invalidateQueries({ queryKey: ["mentorada-tarefas"] });
      toast.success(`${r.criadas} tarefa(s) criadas para ${r.alunas} aluna(s)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function soltarSobre(etapa: string, alvo: Processo) {
    if (!arrastando || arrastando.etapa !== etapa || arrastando.id === alvo.id) return;
    const lista = (processos ?? []).filter((p) => p.etapa === etapa);
    const ids = lista.map((p) => p.id).filter((id) => id !== arrastando.id);
    const idx = ids.indexOf(alvo.id);
    ids.splice(idx, 0, arrastando.id);
    setArrastando(null);
    reordenar.mutate({ etapa, ids });
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        As tarefas abaixo são geradas automaticamente para a aluna quando ela entra na etapa.
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {STATUS_JORNADA.map((etapa) => {
          const lista = (processos ?? []).filter((p) => p.etapa === etapa);
          return (
            <div key={etapa} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{etapa}</p>
                <Badge variant="secondary">{lista.length}</Badge>
              </div>

              <ul className="space-y-2">
                {lista.map((p) => {
                  const aberto = expandido === p.id;
                  return (
                    <li
                      key={p.id}
                      draggable
                      onDragStart={() => setArrastando(p)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); soltarSobre(etapa, p); }}
                      className="rounded-lg border border-border"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandido(aberto ? null : p.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                        <span className="min-w-0 flex-1 text-sm truncate">{p.titulo}</span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`} />
                      </button>
                      {aberto && (
                        <div className="border-t border-border px-3 py-2 space-y-2">
                          {p.descricao ? (
                            <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{p.descricao}</p>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">Sem descrição.</p>
                          )}
                          <div className="flex justify-end gap-3">
                            <button className="text-muted-foreground hover:text-primary"
                              onClick={() => { setEditando(p); setForm({ titulo: p.titulo, descricao: p.descricao ?? "" }); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button className="text-muted-foreground hover:text-destructive"
                              onClick={() => excluir.mutate(p.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
                {lista.length === 0 && (
                  <li className="text-xs text-muted-foreground py-2">Nenhum processo nesta etapa.</li>
                )}
              </ul>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline"
                  onClick={() => { setNovaEtapa(etapa); setForm({ titulo: "", descricao: "" }); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Nova tarefa
                </Button>
                <Button size="sm" variant="ghost" disabled={aplicarNaEtapa.isPending}
                  onClick={() => aplicarNaEtapa.mutate(etapa)}>
                  <Users className="h-3.5 w-3.5 mr-1" /> Aplicar às alunas desta etapa
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!editando || !!novaEtapa} onOpenChange={(o) => { if (!o) { setEditando(null); setNovaEtapa(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar processo" : `Nova tarefa em ${novaEtapa}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição ou script</Label>
              <Textarea rows={4} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditando(null); setNovaEtapa(null); }}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
