import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarClock, Clapperboard, ExternalLink, FlaskConical, Loader2, Pencil, XCircle } from "lucide-react";

// Fila de publicação do Instagram. Quem publica é o robô do servidor do CRM (/opt/agenda-reels),
// que lê esta mesma tabela a cada minuto. Horário sempre de Brasília.
type Reel = {
  id: string; titulo: string; arquivo: string; capa_url: string | null; quando: string;
  modo: "feed" | "teste"; legenda: string; status: string; link: string | null; erro: string | null;
  publicado_em: string | null;
};

const TZ = "America/Sao_Paulo";
const STATUS: Record<string, { rotulo: string; cor: string }> = {
  agendado: { rotulo: "Agendado", cor: "bg-sky-500/15 text-sky-500 border-sky-500/30" },
  enviado: { rotulo: "Publicando", cor: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  publicado: { rotulo: "Publicado", cor: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  erro: { rotulo: "Erro", cor: "bg-red-500/15 text-red-500 border-red-500/30" },
  cancelado: { rotulo: "Cancelado", cor: "bg-muted text-muted-foreground border-border" },
};

const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "2-digit", month: "long" });
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const chaveDia = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
// "AAAA-MM-DDTHH:MM" em Brasília <-> ISO
const paraCampo = (iso: string) => `${chaveDia(iso)}T${hora(iso)}`;
const doCampo = (v: string) => new Date(`${v}:00-03:00`).toISOString();

export default function AgendaReels() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<"proximos" | "publicados" | "todos">("proximos");
  const [edit, setEdit] = useState<{ grupo: Reel[]; quando: string; legenda: string } | null>(null);

  const { data: reels, isLoading } = useQuery({
    queryKey: ["agenda-reels"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("agenda_reels").select("*").order("quando").order("modo");
      if (error) throw error;
      return (data ?? []) as Reel[];
    },
  });

  // feed e teste do mesmo vídeo no mesmo horário viram um cartão só
  const grupos = useMemo(() => {
    const lista = (reels ?? []).filter((r) => {
      if (filtro === "proximos") return ["agendado", "enviado", "erro"].includes(r.status);
      if (filtro === "publicados") return r.status === "publicado";
      return true;
    });
    const mapa = new Map<string, Reel[]>();
    lista.forEach((r) => {
      const k = `${r.arquivo}|${r.quando}`;
      mapa.set(k, [...(mapa.get(k) ?? []), r]);
    });
    const ordenados = [...mapa.values()].sort((a, b) => a[0].quando.localeCompare(b[0].quando));
    if (filtro === "publicados") ordenados.reverse();
    const porDia = new Map<string, Reel[][]>();
    ordenados.forEach((g) => porDia.set(chaveDia(g[0].quando), [...(porDia.get(chaveDia(g[0].quando)) ?? []), g]));
    return [...porDia.entries()];
  }, [reels, filtro]);

  const contagem = useMemo(() => ({
    agendados: (reels ?? []).filter((r) => r.status === "agendado").length,
    publicados: (reels ?? []).filter((r) => r.status === "publicado").length,
  }), [reels]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!edit) return;
      const quando = doCampo(edit.quando);
      if (new Date(quando).getTime() < Date.now() + 10 * 60 * 1000) throw new Error("Escolha um horário pelo menos 10 minutos à frente");
      const ids = edit.grupo.filter((r) => r.status === "agendado").map((r) => r.id);
      const { error } = await (supabase as any).from("agenda_reels").update({ quando, legenda: edit.legenda }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Programação atualizada"); setEdit(null); qc.invalidateQueries({ queryKey: ["agenda-reels"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelar = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await (supabase as any).from("agenda_reels").update({ status: "cancelado" }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Postagem cancelada"); qc.invalidateQueries({ queryKey: ["agenda-reels"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-primary" /> Agenda de Reels
          </h1>
          <p className="text-sm text-muted-foreground">
            Tudo que está programado pro Instagram. O robô publica sozinho na hora marcada (horário de Brasília), no feed e como reel de teste.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <span className="rounded-lg border border-border bg-card px-3 py-1.5"><strong>{contagem.agendados}</strong> agendados</span>
          <span className="rounded-lg border border-border bg-card px-3 py-1.5"><strong>{contagem.publicados}</strong> publicados</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {([["proximos", "Próximos"], ["publicados", "Publicados"], ["todos", "Todos"]] as const).map(([k, rot]) => (
          <Button key={k} size="sm" variant={filtro === k ? "default" : "outline"} onClick={() => setFiltro(k)}>{rot}</Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : grupos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>
      ) : (
        grupos.map(([k, cartoes]) => (
          <section key={k} className="space-y-3">
            <h2 className="text-sm font-semibold capitalize text-muted-foreground">{dia(cartoes[0][0].quando)}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {cartoes.map((g) => {
                const r = g[0];
                const pendentes = g.filter((x) => x.status === "agendado");
                return (
                  <div key={r.id} className="flex gap-4 rounded-xl border border-border bg-card p-4">
                    <div className="w-24 shrink-0 overflow-hidden rounded-lg bg-muted aspect-[9/16]">
                      {r.capa_url ? <img src={r.capa_url} alt="" className="h-full w-full object-cover" /> : <Clapperboard className="m-auto mt-10 h-6 w-6 text-muted-foreground" />}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-lg font-bold tabular-nums">{hora(r.quando)}</span>
                        {pendentes.length > 0 && (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Mudar horário ou legenda"
                              onClick={() => setEdit({ grupo: g, quando: paraCampo(r.quando), legenda: r.legenda })}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" title="Cancelar"
                              onClick={() => { if (confirm(`Cancelar "${r.titulo}" das ${hora(r.quando)}?`)) cancelar.mutate(pendentes.map((x) => x.id)); }}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <h3 className="font-semibold leading-tight">{r.titulo}</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {g.map((x) => (
                          <span key={x.id} className="flex items-center gap-1">
                            <Badge variant="secondary" className="text-[11px] gap-1">
                              {x.modo === "teste" ? <FlaskConical className="h-3 w-3" /> : <Clapperboard className="h-3 w-3" />}
                              {x.modo === "teste" ? "Teste" : "Feed"}
                            </Badge>
                            <Badge variant="outline" className={`text-[11px] ${STATUS[x.status]?.cor ?? ""}`}>{STATUS[x.status]?.rotulo ?? x.status}</Badge>
                            {x.link && (
                              <a href={x.link} target="_blank" rel="noreferrer" className="text-primary" title="Abrir no Instagram"><ExternalLink className="h-3.5 w-3.5" /></a>
                            )}
                          </span>
                        ))}
                      </div>
                      <p className="line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">{r.legenda}</p>
                      {g.some((x) => x.erro) && <p className="text-xs text-red-500">{g.find((x) => x.erro)?.erro}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Mudar programação</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Dia e hora (Brasília)</Label>
                <Input type="datetime-local" value={edit.quando} onChange={(e) => setEdit({ ...edit, quando: e.target.value })} />
                <p className="text-xs text-muted-foreground">Vale para o feed e o teste deste vídeo.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Legenda</Label>
                <Textarea rows={10} value={edit.legenda} onChange={(e) => setEdit({ ...edit, legenda: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Fechar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
