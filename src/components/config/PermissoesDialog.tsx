import { Fragment, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MODULOS, SETORES_MODULOS } from "@/lib/permissoes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, ShieldCheck } from "lucide-react";

type Estado = Record<string, { pode_ver: boolean; pode_editar: boolean; pode_excluir: boolean }>;

const PADRAO = { pode_ver: true, pode_editar: true, pode_excluir: false };

export default function PermissoesDialog({
  usuario,
  open,
  onClose,
}: {
  usuario: { user_id: string; nome: string } | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [estado, setEstado] = useState<Estado>({});

  const { data, isLoading } = useQuery({
    queryKey: ["user-permissions", usuario?.user_id],
    enabled: !!usuario?.user_id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", usuario!.user_id);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const base: Estado = {};
    MODULOS.forEach((m) => {
      const row = (data ?? []).find((d: any) => d.modulo === m.key);
      base[m.key] = row
        ? { pode_ver: row.pode_ver, pode_editar: row.pode_editar, pode_excluir: row.pode_excluir }
        : { ...PADRAO };
    });
    setEstado(base);
  }, [data, usuario?.user_id]);

  const salvar = useMutation({
    mutationFn: async () => {
      const rows = MODULOS.map((m) => ({
        user_id: usuario!.user_id,
        modulo: m.key,
        ...(estado[m.key] ?? PADRAO),
      }));
      const { error } = await supabase
        .from("user_permissions")
        .upsert(rows, { onConflict: "user_id,modulo" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-permissions"] });
      qc.invalidateQueries({ queryKey: ["minhas-permissoes"] });
      toast.success("Permissões salvas");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (modulo: string, campo: keyof typeof PADRAO, valor: boolean) =>
    setEstado((s) => ({
      ...s,
      [modulo]: { ...(s[modulo] ?? PADRAO), [campo]: valor, ...(campo === "pode_ver" && !valor ? { pode_editar: false, pode_excluir: false } : {}) },
    }));

  const marcarTudo = (campo: keyof typeof PADRAO, valor: boolean) =>
    setEstado((s) => {
      const novo: Estado = { ...s };
      MODULOS.forEach((m) => { novo[m.key] = { ...(novo[m.key] ?? PADRAO), [campo]: valor }; });
      return novo;
    });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Autorizações — {usuario?.nome}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <Button size="sm" variant="outline" onClick={() => marcarTudo("pode_ver", true)}>Ver tudo</Button>
              <Button size="sm" variant="outline" onClick={() => marcarTudo("pode_ver", false)}>Ocultar tudo</Button>
              <Button size="sm" variant="outline" onClick={() => marcarTudo("pode_editar", true)}>Liberar edição</Button>
              <Button size="sm" variant="outline" onClick={() => marcarTudo("pode_editar", false)}>Bloquear edição</Button>
              <Button size="sm" variant="outline" onClick={() => marcarTudo("pode_excluir", false)}>Bloquear exclusão</Button>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">Aba</th>
                    <th className="p-3 text-center text-xs font-medium text-muted-foreground">Visualizar</th>
                    <th className="p-3 text-center text-xs font-medium text-muted-foreground">Alterar</th>
                    <th className="p-3 text-center text-xs font-medium text-muted-foreground">Excluir</th>
                  </tr>
                </thead>
                <tbody>
                  {SETORES_MODULOS.map((setor) => (
                    <Fragment key={setor}>
                      <tr className="bg-secondary/20">
                        <td colSpan={4} className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">{setor}</td>
                      </tr>
                      {MODULOS.filter((m) => m.setor === setor).map((m) => {
                        const e = estado[m.key] ?? PADRAO;
                        return (
                          <tr key={m.key} className="border-b border-border/50">
                            <td className="p-3 font-medium">{m.label}</td>
                            <td className="p-3 text-center"><Switch checked={e.pode_ver} onCheckedChange={(v) => set(m.key, "pode_ver", v)} /></td>
                            <td className="p-3 text-center"><Switch disabled={!e.pode_ver} checked={e.pode_editar} onCheckedChange={(v) => set(m.key, "pode_editar", v)} /></td>
                            <td className="p-3 text-center"><Switch disabled={!e.pode_ver} checked={e.pode_excluir} onCheckedChange={(v) => set(m.key, "pode_excluir", v)} /></td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Administradores têm acesso total e não são afetados por estas configurações.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending} className="gold-gradient text-primary-foreground">
            <Save className="h-4 w-4 mr-2" /> Salvar autorizações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
