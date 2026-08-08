import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Busca telefones/WhatsApp dos clientes por id, para uso em botões de WhatsApp. */
export function useTelefonesClientes(ids: (string | null | undefined)[]) {
  const unique = Array.from(new Set(ids.filter(Boolean) as string[])).sort();

  const { data } = useQuery({
    queryKey: ["telefones-clientes", unique.join(",")],
    enabled: unique.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, whatsapp, telefone")
        .in("id", unique);
      if (error) throw error;
      return data ?? [];
    },
  });

  const map = new Map<string, string | null>();
  (data ?? []).forEach((c: any) => map.set(c.id, c.whatsapp || c.telefone || null));
  return map;
}
