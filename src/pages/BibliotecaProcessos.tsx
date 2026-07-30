import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, ChevronDown, Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

type Form = { id?: string; titulo: string; categoria: string; conteudo: string; ordem: string };
const vazio: Form = { titulo: "", categoria: "", conteudo: "", ordem: "0" };

export default function BibliotecaProcessos() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  const { data: itens, isLoading } = useQuery({
    queryKey: ["biblioteca-processos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("biblioteca_processos").select("*")
        .order("categoria").order("ordem").order("titulo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form?.titulo.trim()) throw new Error("Informe o título");
      const payload = {
        titulo: form.titulo.trim(),
        categoria: form.categoria || null,
        conteudo: form.conteudo,
        ordem: Number(form.ordem) || 0,
      };
      const { error } = form.id
        ? await supabase.from("biblioteca_processos").update(payload).eq("id", form.id)
        : await supabase.from("biblioteca_processos").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { setForm(null); qc.invalidateQueries({ queryKey: ["biblioteca-processos"] }); toast.success("Processo salvo"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("biblioteca_processos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["biblioteca-processos"] }); toast.success("Processo excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const categorias = Array.from(new Set((itens ?? []).map((i) => i.categoria || "Sem categoria")));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> Biblioteca de Processos
          </h1>
          <p className="text-sm text-muted-foreground">Como cada coisa é feita aqui dentro, documentada em um só lugar.</p>
        </div>
        <Button onClick={() => setForm({ ...vazio })}>
          <Plus className="h-4 w-4 mr-1" /> Novo processo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (itens ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum processo cadastrado ainda.</p>
      ) : (
        <div className="space-y-6">
          {categorias.map((cat) => (
            <div key={cat} className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat}</p>
                <Badge variant="secondary">
                  {(itens ?? []).filter((i) => (i.categoria || "Sem categoria") === cat).length}
                </Badge>
              </div>
              {(itens ?? []).filter((i) => (i.categoria || "Sem categoria") === cat).map((i) => {
                const open = aberto === i.id;
                return (
                  <div key={i.id} className="rounded-xl border border-border bg-card">
                    <button onClick={() => setAberto(open ? null : i.id)} className="w-full flex items-center gap-2 px-4 py-3 text-left">
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                      <span className="text-sm font-medium flex-1 truncate">{i.titulo}</span>
                    </button>
                    {open && (
                      <div className="px-4 pb-4 space-y-3">
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground rounded-lg bg-muted/50 p-3">{i.conteudo}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(i.conteudo ?? ""); toast.success("Conteúdo copiado"); }}>
                            <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setForm({
                            id: i.id, titulo: i.titulo, categoria: i.categoria ?? "", conteudo: i.conteudo ?? "", ordem: String(i.ordem),
                          })}>
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => excluir.mutate(i.id)}>
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Editar processo" : "Novo processo"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Título *</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Conteúdo</Label>
                <Textarea rows={10} value={form.conteudo} onChange={(e) => setForm({ ...form, conteudo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ordem</Label>
                <Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
