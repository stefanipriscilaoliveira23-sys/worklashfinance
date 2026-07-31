import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";

export function useTagsCatalogo() {
  return useQuery({
    queryKey: ["tags-catalogo"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tags_catalogo").select("id, nome").order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });
}

export async function criarTagCatalogo(nome: string) {
  const limpo = nome.trim();
  if (!limpo) throw new Error("Escreva o nome da tag");
  const { error } = await (supabase as any).from("tags_catalogo").insert({ nome: limpo });
  if (error && !`${error.message}`.toLowerCase().includes("duplicate")) throw error;
  return limpo;
}

type Props = {
  tags: string[];
  onChange: (tags: string[]) => void;
};

export default function TagsEditor({ tags, onChange }: Props) {
  const qc = useQueryClient();
  const { data: catalogo } = useTagsCatalogo();
  const [busca, setBusca] = useState("");

  const sugestoes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return [];
    return (catalogo ?? [])
      .map((t) => t.nome)
      .filter((n) => n.toLowerCase().includes(termo) && !tags.some((t) => t.toLowerCase() === n.toLowerCase()))
      .slice(0, 8);
  }, [busca, catalogo, tags]);

  const existeExata = (catalogo ?? []).some((t) => t.nome.toLowerCase() === busca.trim().toLowerCase());

  const adicionar = (nome: string) => {
    const limpo = nome.trim();
    if (!limpo) return;
    if (!tags.some((t) => t.toLowerCase() === limpo.toLowerCase())) onChange([...tags, limpo]);
    setBusca("");
  };

  const criar = async () => {
    try {
      const nome = await criarTagCatalogo(busca);
      qc.invalidateQueries({ queryKey: ["tags-catalogo"] });
      qc.invalidateQueries({ queryKey: ["clientes-tags"] });
      adicionar(nome);
      toast.success(`Tag "${nome}" criada`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma tag</span>}
        {tags.map((t, i) => (
          <span key={`${t}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((_, idx) => idx !== i))} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <Input
          value={busca}
          placeholder="Buscar ou criar tag..."
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (sugestoes.length) adicionar(sugestoes[0]);
              else if (busca.trim()) criar();
            }
          }}
          className="h-9 bg-secondary/50 border-border text-sm"
        />
        {busca.trim() && (
          <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
            {sugestoes.map((s) => (
              <button key={s} type="button" onClick={() => adicionar(s)}
                className="block w-full px-3 py-1.5 text-left text-xs hover:bg-surface-hover">
                {s}
              </button>
            ))}
            {!existeExata && (
              <button type="button" onClick={criar}
                className="flex w-full items-center gap-1 px-3 py-1.5 text-left text-xs font-medium text-primary hover:bg-surface-hover">
                <Plus className="h-3 w-3" /> Criar "{busca.trim()}"
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
