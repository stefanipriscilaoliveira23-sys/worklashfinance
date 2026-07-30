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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronDown, Copy, Loader2, MessageSquareText, Pencil, Plus, Trash2 } from "lucide-react";

const CATEGORIAS = [
  "Qualificação",
  "Condução do direct para o WhatsApp",
  "Quebra de objeção",
  "Follow up",
  "Social selling",
  "Roteiro de reunião de venda",
  "Pós venda",
  "Reativação",
];

type Form = { id?: string; categoria: string; titulo: string; texto: string; ordem: string };
const vazio: Form = { categoria: CATEGORIAS[0], titulo: "", texto: "", ordem: "0" };

export default function Scripts() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  const { data: scripts, isLoading } = useQuery({
    queryKey: ["scripts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("scripts").select("*")
        .order("categoria").order("ordem").order("titulo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form?.titulo.trim()) throw new Error("Informe o título");
      const payload = {
        categoria: form.categoria,
        titulo: form.titulo.trim(),
        texto: form.texto,
        ordem: Number(form.ordem) || 0,
      };
      const { error } = form.id
        ? await supabase.from("scripts").update(payload).eq("id", form.id)
        : await supabase.from("scripts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      setForm(null);
      qc.invalidateQueries({ queryKey: ["scripts"] });
      toast.success("Script salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scripts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scripts"] }); toast.success("Script excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const copiar = (texto: string) => {
    navigator.clipboard.writeText(texto);
    toast.success("Script copiado");
  };

  const usadas = CATEGORIAS.filter((c) => (scripts ?? []).some((s) => s.categoria === c));
  const extras = Array.from(new Set((scripts ?? []).map((s) => s.categoria))).filter((c) => !CATEGORIAS.includes(c));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquareText className="h-6 w-6 text-primary" /> Scripts
          </h1>
          <p className="text-sm text-muted-foreground">Textos prontos para copiar e colar no atendimento.</p>
        </div>
        <Button onClick={() => setForm({ ...vazio })}>
          <Plus className="h-4 w-4 mr-1" /> Novo script
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (scripts ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum script cadastrado ainda.</p>
      ) : (
        <div className="space-y-6">
          {[...usadas, ...extras].map((cat) => (
            <div key={cat} className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat}</p>
                <Badge variant="secondary">{(scripts ?? []).filter((s) => s.categoria === cat).length}</Badge>
              </div>
              <div className="space-y-2">
                {(scripts ?? []).filter((s) => s.categoria === cat).map((s) => {
                  const open = aberto === s.id;
                  return (
                    <div key={s.id} className="rounded-xl border border-border bg-card">
                      <button
                        onClick={() => setAberto(open ? null : s.id)}
                        className="w-full flex items-center gap-2 px-4 py-3 text-left"
                      >
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                        <span className="text-sm font-medium flex-1 truncate">{s.titulo}</span>
                      </button>
                      {open && (
                        <div className="px-4 pb-4 space-y-3">
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground rounded-lg bg-muted/50 p-3">{s.texto}</p>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => copiar(s.texto)}>
                              <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setForm({
                              id: s.id, categoria: s.categoria, titulo: s.titulo, texto: s.texto, ordem: String(s.ordem),
                            })}>
                              <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => excluir.mutate(s.id)}>
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Editar script" : "Novo script"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Título *</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Texto</Label>
                <Textarea rows={8} value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} />
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
