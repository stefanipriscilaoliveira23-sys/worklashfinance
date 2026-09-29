// Atualiza as telas de despesas sozinho quando o banco muda (ex.: robô do grupo
// "Financeiro do casal" lança um gasto pelo WhatsApp). Invalida as consultas do
// react-query que começam com despesas-pessoal / despesas-empresa.
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDespesasRealtime(ativo: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!ativo) return;
    const invalidar = (prefixo: string) =>
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith(prefixo) });
    const canal = supabase
      .channel("despesas-tempo-real")
      .on("postgres_changes", { event: "*", schema: "public", table: "despesas_pessoal" }, () => invalidar("despesas-pessoal"))
      .on("postgres_changes", { event: "*", schema: "public", table: "despesas_empresa" }, () => invalidar("despesas-empresa"))
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [ativo, queryClient]);
}
