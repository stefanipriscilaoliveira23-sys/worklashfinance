import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Package, Loader2, Plus, Trash2, ExternalLink } from "lucide-react";

type Produto = {
  id: string;
  nome: string;
  o_que_e: string | null;
  como_funciona: string | null;
  para_quem: string | null;
  para_quem_nao: string | null;
  entregaveis: string | null;
  modulos_aulas: string | null;
  diferenciais: string | null;
  explicacao_comercial: string | null;
  link_pagamento: string | null;
  persona: string | null;
  ativo: boolean;
};

const CAMPOS: { key: keyof Produto; label: string }[] = [
  { key: "o_que_e", label: "O que é" },
  { key: "como_funciona", label: "Como funciona" },
  { key: "para_quem", label: "Para quem é" },
  { key: "para_quem_nao", label: "Para quem não é" },
  { key: "entregaveis", label: "Entregáveis" },
  { key: "modulos_aulas", label: "Módulos e aulas" },
  { key: "diferenciais", label: "Diferenciais" },
  { key: "explicacao_comercial", label: "Explicação comercial" },
  { key: "persona", label: "Persona" },
];

export default function ProdutosCursos() {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState<Produto | null>(null);

  const { data: produtos, isLoading } = useQuery({
    queryKey: ["produtos-cursos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos_cursos").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Produto[];
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("produtos_cursos")
        .insert({ nome: "Novo produto ou curso" }).select("*").single();
      if (error) throw error;
      return data as Produto;
    },
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: ["produtos-cursos"] }); setAberto(p); },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvar = useMutation({
    mutationFn: async (p: Produto) => {
      const { id, ...rest } = p;
      const { error } = await supabase.from("produtos_cursos")
        .update({ ...rest, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["produtos-cursos"] }); toast.success("Produto salvo"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos_cursos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["produtos-cursos"] }); setAberto(null); toast.success("Produto excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> Produtos e Cursos
          </h1>
          <p className="text-sm text-muted-foreground">
            Tudo que a equipe precisa saber para explicar e vender cada produto.
          </p>
        </div>
        <Button onClick={() => criar.mutate()}>
          <Plus className="h-4 w-4 mr-1" /> Novo produto ou curso
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (produtos ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum produto cadastrado ainda.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(produtos ?? []).map((p) => (
            <button
              key={p.id}
              onClick={() => setAberto(p)}
              className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{p.nome}</p>
                <Badge variant={p.ativo ? "secondary" : "outline"} className="text-[10px]">
                  {p.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{p.o_que_e || "Sem descrição ainda."}</p>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {aberto && (
            <>
              <SheetHeader><SheetTitle>Ficha do produto</SheetTitle></SheetHeader>
              <div className="space-y-3 pt-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome</Label>
                  <Input value={aberto.nome} onChange={(e) => setAberto({ ...aberto, nome: e.target.value })} />
                </div>
                {CAMPOS.map((c) => (
                  <div key={c.key} className="space-y-1.5">
                    <Label className="text-xs">{c.label}</Label>
                    <Textarea
                      rows={3}
                      value={(aberto[c.key] as string) ?? ""}
                      onChange={(e) => setAberto({ ...aberto, [c.key]: e.target.value } as Produto)}
                    />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label className="text-xs">Link de pagamento</Label>
                  <Input value={aberto.link_pagamento ?? ""} onChange={(e) => setAberto({ ...aberto, link_pagamento: e.target.value })} />
                  {aberto.link_pagamento && (
                    <a href={aberto.link_pagamento} target="_blank" rel="noreferrer" className="text-xs text-primary underline inline-flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> Abrir link
                    </a>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <Label className="text-xs">Produto ativo</Label>
                  <Switch checked={aberto.ativo} onCheckedChange={(v) => setAberto({ ...aberto, ativo: v })} />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" onClick={() => salvar.mutate(aberto)}>Salvar</Button>
                  <Button variant="ghost" className="text-destructive" onClick={() => excluir.mutate(aberto.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
