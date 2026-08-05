import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isAdmin } from "@/contexts/AuthContext";

export type Permissao = {
  modulo: string;
  pode_ver: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
};

/**
 * Permissões granulares por usuário/módulo.
 * Regras:
 *  - admin sempre pode tudo;
 *  - sem registro salvo para o módulo, mantém o comportamento padrão (liberado).
 */
export function usePermissions() {
  const { user, role } = useAuth();
  const admin = isAdmin(role);

  const { data, isLoading } = useQuery({
    queryKey: ["minhas-permissoes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_permissions")
        .select("modulo, pode_ver, pode_editar, pode_excluir")
        .eq("user_id", user!.id);
      return (data ?? []) as Permissao[];
    },
  });

  const find = (modulo: string) => (data ?? []).find((p) => p.modulo === modulo);

  return {
    loading: isLoading,
    permissoes: data ?? [],
    podeVer: (modulo: string) => admin || (find(modulo)?.pode_ver ?? true),
    podeEditar: (modulo: string) => admin || (find(modulo)?.pode_editar ?? true),
    podeExcluir: (modulo: string) => admin || (find(modulo)?.pode_excluir ?? true),
  };
}
