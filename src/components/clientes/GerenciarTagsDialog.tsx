import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { useTagsCatalogo, criarTagCatalogo } from "./TagsEditor";

export default function GerenciarTagsDialog({ open, onOpenChange, podeExcluir }: {
  open: boolean; onOpenChange: (o: boolean) => void; podeExcluir: boolean;
}) {
  const qc = useQueryClient();
  const { data: tags } = useTagsCatalogo();
  const [nova, setNova] = useState("");
  const [busca, setBusca] = useState("");

  const criar = async () => {
    try {
      await criarTagCatalogo(nova);
      setNova("");
      qc.invalidateQueries({ queryKey: ["tags-catalogo"] });
      toast.success("Tag criada");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const excluir = async (id: string) => {
    const { error } = await (supabase as any).from("tags_catalogo").delete().eq("id", id);
    if (error) return toast.error("Apenas administradores podem excluir tags");
    qc.invalidateQueries({ queryKey: ["tags-catalogo"] });
    toast.success("Tag removida do catálogo");
  };

  const lista = (tags ?? []).filter((t) => t.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle className="text-foreground">Tags</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Nome da nova tag"
              onKeyDown={(e) => e.key === "Enter" && criar()} className="bg-secondary/50 border-border" />
            <Button onClick={criar} className="gold-gradient text-primary-foreground"><Plus className="h-4 w-4" /></Button>
          </div>
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar tag..."
            className="bg-secondary/50 border-border h-9 text-sm" />
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {lista.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                <span className="text-xs">{t.nome}</span>
                {podeExcluir && (
                  <button onClick={() => excluir(t.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {lista.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tag encontrada.</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
