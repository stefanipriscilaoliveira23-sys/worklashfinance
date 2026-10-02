import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Grupo } from "./shared";

type Linha = { id?: string; nome: string; jid: string; ativo: boolean };
const daLinha = (g: Grupo): Linha => ({ id: g.id, nome: g.nome, jid: g.jid ?? "", ativo: g.ativo });

/** Cadastro dos grupos de WhatsApp que recebem as campanhas. O JID pode ficar vazio por enquanto. */
export function GruposDialog({ open, onOpenChange, grupos }: { open: boolean; onOpenChange: (o: boolean) => void; grupos: Grupo[] }) {
  const qc = useQueryClient();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (open) setLinhas(grupos.map(daLinha)); }, [open, grupos]);

  const original = (id?: string) => grupos.find((g) => g.id === id);
  const mudou = (l: Linha) => {
    const g = original(l.id);
    return !g || g.nome !== l.nome.trim() || (g.jid ?? "") !== l.jid.trim() || g.ativo !== l.ativo;
  };
  const pendentes = linhas.filter((l) => mudou(l) && l.nome.trim());
  const set = (i: number, p: Partial<Linha>) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  async function salvar() {
    setSalvando(true);
    try {
      for (const l of pendentes) {
        const dados = { nome: l.nome.trim(), jid: l.jid.trim() || null, ativo: l.ativo };
        const { error } = l.id
          ? await supabase.from("campanha_grupos").update(dados).eq("id", l.id)
          : await supabase.from("campanha_grupos").insert(dados);
        if (error) throw new Error(error.code === "23505" ? `O JID de "${dados.nome}" já está em outro grupo` : error.message);
      }
      toast.success("Grupos salvos");
      qc.invalidateQueries({ queryKey: ["campanha-grupos"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(i: number) {
    const l = linhas[i];
    if (!l.id) return setLinhas((ls) => ls.filter((_, j) => j !== i));
    if (!confirm(`Excluir o grupo "${l.nome}"? Mensagens que escolheram só ele vão ficar sem esse destino.`)) return;
    const { error } = await supabase.from("campanha_grupos").delete().eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success("Grupo excluído");
    qc.invalidateQueries({ queryKey: ["campanha-grupos"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Grupos de WhatsApp</DialogTitle>
          <DialogDescription>
            Os grupos que recebem as campanhas. O JID (ex.: 1203...@g.us) é o endereço do grupo para o disparo e pode ficar vazio por enquanto.
            Grupo inativo não entra em "Todos os grupos".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_1fr_56px_36px] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
            <span>Nome</span><span>JID</span><span>Ativo</span><span />
          </div>
          {linhas.map((l, i) => (
            <div key={l.id ?? `novo-${i}`} className="grid grid-cols-[1fr_auto_36px] gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_1fr_56px_36px] sm:border-0 sm:p-0">
              <Input value={l.nome} placeholder="Nome do grupo" onChange={(e) => set(i, { nome: e.target.value })} />
              <Input value={l.jid} placeholder="sem JID" className="col-span-3 row-start-2 font-mono text-xs sm:col-span-1 sm:row-start-auto"
                onChange={(e) => set(i, { jid: e.target.value })} />
              <div className="flex items-center justify-center"><Switch checked={l.ativo} onCheckedChange={(v) => set(i, { ativo: v })} /></div>
              <Button size="icon" variant="ghost" className="text-red-500" title="Excluir" onClick={() => remover(i)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setLinhas([...linhas, { nome: "", jid: "", ativo: true }])}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar grupo
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={salvar} disabled={salvando || pendentes.length === 0}>
            {salvando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Salvar{pendentes.length ? ` (${pendentes.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
