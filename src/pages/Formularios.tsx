import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ClipboardList, Copy, ExternalLink, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

type Form = { id?: string; titulo: string; descricao: string; link: string; ordem: string };
const vazio: Form = { titulo: "", descricao: "", link: "", ordem: "0" };

export default function Formularios() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);

  const { data: formularios, isLoading } = useQuery({
    queryKey: ["formularios"],
    queryFn: async () => {
      const { data, error } = await supabase.from("formularios").select("*").order("ordem").order("titulo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form?.titulo.trim()) throw new Error("Informe o título");
      const payload = {
        titulo: form.titulo.trim(),
        descricao: form.descricao || null,
        link: form.link,
        ordem: Number(form.ordem) || 0,
      };
      const { error } = form.id
        ? await supabase.from("formularios").update(payload).eq("id", form.id)
        : await supabase.from("formularios").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { setForm(null); qc.invalidateQueries({ queryKey: ["formularios"] }); toast.success("Formulário salvo"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("formularios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["formularios"] }); toast.success("Formulário excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" /> Formulários
          </h1>
          <p className="text-sm text-muted-foreground">Links dos formulários usados pela equipe.</p>
        </div>
        <Button onClick={() => setForm({ ...vazio })}>
          <Plus className="h-4 w-4 mr-1" /> Novo formulário
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (formularios ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum formulário cadastrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {(formularios ?? []).map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{f.titulo}</p>
                {f.descricao && <p className="text-xs text-muted-foreground">{f.descricao}</p>}
                {f.link && <p className="text-[11px] text-muted-foreground truncate">{f.link}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={!f.link} onClick={() => window.open(f.link, "_blank")}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
                </Button>
                <Button size="sm" variant="ghost" disabled={!f.link} onClick={() => { navigator.clipboard.writeText(f.link); toast.success("Link copiado"); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setForm({
                  id: f.id, titulo: f.titulo, descricao: f.descricao ?? "", link: f.link ?? "", ordem: String(f.ordem),
                })}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => excluir.mutate(f.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Editar formulário" : "Novo formulário"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Título *</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição</Label>
                <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Link</Label>
                <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
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
