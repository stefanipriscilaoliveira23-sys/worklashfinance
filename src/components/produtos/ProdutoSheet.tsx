import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ExternalLink, Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type ProdutoCategoria = Database["public"]["Enums"]["produto_categoria"];

const CATEGORIAS: ProdutoCategoria[] = ["Mentorias", "Renovações", "Digitais", "Físicos"];

const CAMPOS_TEXTO = [
  { key: "o_que_e", label: "O que é" },
  { key: "como_funciona", label: "Como funciona" },
  { key: "para_quem", label: "Para quem é" },
  { key: "para_quem_nao", label: "Para quem não é" },
  { key: "entregaveis", label: "Entregáveis" },
  { key: "modulos_aulas", label: "Módulos e aulas" },
  { key: "diferenciais", label: "Diferenciais" },
  { key: "explicacao_comercial", label: "Explicação comercial" },
  { key: "persona", label: "Persona" },
] as const;

type FormState = {
  nome: string;
  categoria: ProdutoCategoria;
  preco_venda: number;
  ativo: boolean;
  link_pagamento: string;
  observacao: string;
} & Record<(typeof CAMPOS_TEXTO)[number]["key"], string>;

const vazio = (): FormState => ({
  nome: "",
  categoria: "Digitais",
  preco_venda: 0,
  ativo: true,
  link_pagamento: "",
  observacao: "",
  o_que_e: "", como_funciona: "", para_quem: "", para_quem_nao: "",
  entregaveis: "", modulos_aulas: "", diferenciais: "", explicacao_comercial: "", persona: "",
});

export default function ProdutoSheet({
  open, produto, onClose,
}: { open: boolean; produto: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(vazio());

  useEffect(() => {
    if (!open) return;
    if (produto) {
      const base = vazio();
      const next: FormState = { ...base };
      (Object.keys(base) as (keyof FormState)[]).forEach((k) => {
        const v = produto[k];
        if (v !== undefined && v !== null) (next as any)[k] = v;
      });
      setForm(next);
    } else {
      setForm(vazio());
    }
  }, [open, produto]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Nome obrigatório");
      const payload: Record<string, any> = {
        nome: form.nome.trim(),
        categoria: form.categoria,
        preco_venda: form.preco_venda,
        ativo: form.ativo,
        link_pagamento: form.link_pagamento || null,
        observacao: form.observacao || null,
      };
      CAMPOS_TEXTO.forEach((c) => { payload[c.key] = form[c.key] || null; });
      if (produto) {
        const { error } = await supabase.from("produtos_catalogo").update(payload).eq("id", produto.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("produtos_catalogo").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["produtos-catalogo"] });
      toast.success(produto ? "Produto atualizado" : "Produto criado");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader><SheetTitle>{produto ? "Editar produto" : "Novo produto"}</SheetTitle></SheetHeader>
        <div className="space-y-3 pt-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v as ProdutoCategoria })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Preço de venda (R$)</Label>
              <Input type="number" step="0.01" value={form.preco_venda || ""} onChange={(e) => setForm({ ...form, preco_venda: Number(e.target.value) })} />
            </div>
          </div>

          {CAMPOS_TEXTO.map((c) => (
            <div key={c.key} className="space-y-1.5">
              <Label className="text-xs">{c.label}</Label>
              <Textarea rows={3} value={form[c.key]} onChange={(e) => setForm({ ...form, [c.key]: e.target.value } as FormState)} />
            </div>
          ))}

          <div className="space-y-1.5">
            <Label className="text-xs">Link de pagamento</Label>
            <Input value={form.link_pagamento} onChange={(e) => setForm({ ...form, link_pagamento: e.target.value })} />
            {form.link_pagamento && (
              <a href={form.link_pagamento} target="_blank" rel="noreferrer" className="text-xs text-primary underline inline-flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> Abrir link
              </a>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observação</Label>
            <Textarea rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <Label className="text-xs">Produto ativo</Label>
            <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
          </div>

          <div className="flex gap-2 pt-2 pb-6">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 gold-gradient text-primary-foreground" disabled={salvar.isPending} onClick={() => salvar.mutate()}>
              {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
