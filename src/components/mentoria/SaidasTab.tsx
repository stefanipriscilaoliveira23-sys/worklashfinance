/**
 * Saídas — mentoradas cuja mentoria venceu.
 *
 * O caminho de cada uma é sempre o mesmo:
 *   venceu  →  acesso ao app cortado (7 dias depois)  →  tirada do grupo
 *
 * A carência de 7 dias existe porque renovação demora alguns dias pra ser
 * fechada e lançada. Se a aluna renovou, "Ela renovou" dispensa o caso e
 * devolve o acesso na hora.
 *
 * O caso só some daqui quando a Stéfani marca que tirou do grupo. É de
 * propósito: o WhatsApp não tem como a gente tirar sozinho, então a lista
 * fica cobrando até alguém fazer.
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Saida = {
  id: string;
  mentorada_id: string;
  nome: string;
  email: string | null;
  data_termino: string;
  bloqueada_em: string | null;
  removida_em: string | null;
  dispensada_em: string | null;
};

const CARENCIA_DIAS = 7;

const dataBR = (v: string | null) =>
  v ? new Date(`${v.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const diasDesde = (v: string) =>
  Math.floor((Date.now() - new Date(`${v.slice(0, 10)}T12:00:00`).getTime()) / 86400000);

export function SaidasTab() {
  const qc = useQueryClient();

  const { data: saidas = [], isLoading } = useQuery({
    queryKey: ["saidas-mentoria"],
    queryFn: async (): Promise<Saida[]> => {
      const { data, error } = await supabase
        .from("eo_mentoria_saida")
        .select("*")
        .order("data_termino");
      if (error) throw error;
      return (data ?? []) as Saida[];
    },
  });

  const abertas = useMemo(
    () => saidas.filter((s) => !s.removida_em && !s.dispensada_em),
    [saidas],
  );
  const fechadas = useMemo(
    () => saidas.filter((s) => s.removida_em || s.dispensada_em),
    [saidas],
  );

  const marcarRemovida = useMutation({
    mutationFn: async (s: Saida) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("eo_mentoria_saida")
        .update({
          removida_em: new Date().toISOString(),
          removida_por: u.user?.id ?? null,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marcada como removida do grupo.");
      qc.invalidateQueries({ queryKey: ["saidas-mentoria"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dispensar = useMutation({
    mutationFn: async (s: Saida) => {
      const { data: u } = await supabase.auth.getUser();
      // Renovou: desfaz o bloqueio ANTES de fechar o caso, senão ela fica
      // fora do app sem nada na lista pra avisar que ficou.
      if (s.email) {
        const { error: eb } = await supabase
          .from("eo_acesso_bloqueio")
          .delete()
          .eq("email", s.email);
        if (eb) throw eb;
      }
      const { error } = await supabase
        .from("eo_mentoria_saida")
        .update({
          dispensada_em: new Date().toISOString(),
          dispensada_por: u.user?.id ?? null,
          bloqueada_em: null,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Caso dispensado e acesso devolvido.");
      qc.invalidateQueries({ queryKey: ["saidas-mentoria"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reabrir = useMutation({
    mutationFn: async (s: Saida) => {
      const { error } = await supabase
        .from("eo_mentoria_saida")
        .update({ removida_em: null, dispensada_em: null, atualizado_em: new Date().toISOString() })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saidas-mentoria"] }),
  });

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>;
  }

  return (
    <div className="space-y-6 pt-4">
      <p className="text-sm text-muted-foreground">
        Mentoria que venceu aparece aqui no mesmo dia. O acesso ao app é cortado{" "}
        {CARENCIA_DIAS} dias depois, se ninguém dispensar antes. Tirar do grupo do
        WhatsApp continua sendo na mão, e o caso fica aqui até você marcar.
      </p>

      {abertas.length === 0 ? (
        <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          Nenhuma mentoria vencida em aberto.
        </div>
      ) : (
        <div className="space-y-2">
          {abertas.map((s) => {
            const dias = diasDesde(s.data_termino);
            const faltam = CARENCIA_DIAS - dias;
            return (
              <div
                key={s.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Terminou em {dataBR(s.data_termino)} · vencida há {dias} dias
                    {s.email ? ` · ${s.email}` : " · sem e-mail cadastrado"}
                  </p>
                </div>

                <div className="shrink-0">
                  {s.bloqueada_em ? (
                    <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                      Acesso cortado
                    </span>
                  ) : !s.email ? (
                    <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                      Sem e-mail, bloqueie na mão
                    </span>
                  ) : (
                    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600">
                      {faltam > 0 ? `Corta em ${faltam} dia(s)` : "Corta na próxima varredura"}
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => dispensar.mutate(s)}>
                    Ela renovou
                  </Button>
                  <Button size="sm" onClick={() => marcarRemovida.mutate(s)}>
                    Tirei do grupo
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {fechadas.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Já resolvidas ({fechadas.length})
          </h3>
          <div className="space-y-1">
            {fechadas.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate">
                  {s.nome}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {s.dispensada_em ? "renovou" : "tirada do grupo"} em{" "}
                    {dataBR(s.dispensada_em ?? s.removida_em)}
                  </span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => reabrir.mutate(s)}>
                  Reabrir
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
