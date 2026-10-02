import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp, Info, Loader2, Megaphone, Plus, Users } from "lucide-react";
import { MensagemCard } from "@/components/campanhas/MensagemCard";
import { MensagemEditor, EditorAlvo } from "@/components/campanhas/MensagemEditor";
import { CampanhaSheet, NovaCampanhaDialog } from "@/components/campanhas/CampanhaSheet";
import { GruposDialog } from "@/components/campanhas/GruposDialog";
import {
  Campanha, Grupo, Mensagem, STATUS_CAMPANHA, hojeBR, ordenarMensagens, rotuloDia, rotuloPeriodo,
} from "@/components/campanhas/shared";

// Campanhas dos grupos de WhatsApp da Worklash: cada oferta tem mensagens com dia e hora.
// O disparo automático ainda não existe; esta tela só organiza e agenda (status "agendada").
export default function Campanhas() {
  const [verAnteriores, setVerAnteriores] = useState(false);
  const [editor, setEditor] = useState<EditorAlvo>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [nova, setNova] = useState(false);
  const [gruposAberto, setGruposAberto] = useState(false);

  const { data: campanhas = [], isLoading: l1 } = useQuery({
    queryKey: ["campanhas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campanhas").select("*").order("data_inicio", { ascending: false, nullsFirst: true }).order("criado_em", { ascending: false });
      if (error) throw error;
      return data as Campanha[];
    },
  });
  const { data: mensagens = [], isLoading: l2 } = useQuery({
    queryKey: ["campanha-mensagens"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campanha_mensagens").select("*").order("dia").order("hora").order("ordem");
      if (error) throw error;
      return data as Mensagem[];
    },
  });
  const { data: grupos = [] } = useQuery({
    queryKey: ["campanha-grupos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campanha_grupos").select("*").order("nome");
      if (error) throw error;
      return data as Grupo[];
    },
  });

  const hoje = hojeBR();
  const porId = useMemo(() => new Map(campanhas.map((c) => [c.id, c])), [campanhas]);

  const dias = useMemo(() => {
    const mapa = new Map<string, Mensagem[]>();
    [...mensagens].sort(ordenarMensagens).forEach((m) => mapa.set(m.dia, [...(mapa.get(m.dia) ?? []), m]));
    const todos = [...mapa.entries()];
    return { proximos: todos.filter(([d]) => d >= hoje), anteriores: todos.filter(([d]) => d < hoje).reverse() };
  }, [mensagens, hoje]);

  const contagem = {
    agendadas: mensagens.filter((m) => m.status === "agendada").length,
    enviadas: mensagens.filter((m) => m.status === "enviada").length,
  };

  const campanhaAberta = aberta ? porId.get(aberta) ?? null : null;
  const novaMensagem = (campanha_id?: string, dia?: string) => setEditor({ campanha_id, dia });

  const blocoDia = ([dia, lista]: [string, Mensagem[]]) => (
    <section key={dia} className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        {rotuloDia(dia)}
        {dia === hoje && <Badge className="text-[10px]">Hoje</Badge>}
        <span className="text-xs font-normal">· {lista.length} {lista.length === 1 ? "mensagem" : "mensagens"}</span>
      </h2>
      <div className="grid gap-2 lg:grid-cols-2">
        {lista.map((m) => (
          <MensagemCard key={m.id} m={m} campanha={porId.get(m.campanha_id)} grupos={grupos} onClick={() => setEditor({ mensagem: m })} />
        ))}
      </div>
    </section>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Megaphone className="h-6 w-6 text-primary" /> Campanhas
          </h1>
          <p className="text-sm text-muted-foreground">Ofertas divulgadas nos grupos de WhatsApp da Worklash, dia a dia.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-lg border border-border bg-card px-3 py-1.5"><strong>{contagem.agendadas}</strong> agendadas</span>
          <span className="rounded-lg border border-border bg-card px-3 py-1.5"><strong>{contagem.enviadas}</strong> enviadas</span>
          <Button variant="outline" onClick={() => setGruposAberto(true)}>
            <Users className="mr-1 h-4 w-4" /> Grupos
          </Button>
          <Button onClick={() => setNova(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nova campanha
          </Button>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        O envio automático ainda não está ligado. As mensagens agendadas ficam prontas para o disparo.
      </p>

      {l1 || l2 ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <Tabs defaultValue="dia">
          <TabsList>
            <TabsTrigger value="dia">Por dia</TabsTrigger>
            <TabsTrigger value="oferta">Por oferta</TabsTrigger>
          </TabsList>

          <TabsContent value="dia" className="mt-4 space-y-6">
            {dias.proximos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhuma mensagem de hoje em diante.
                {campanhas.length > 0 ? (
                  <div className="mt-3"><Button size="sm" variant="outline" onClick={() => novaMensagem()}><Plus className="mr-1 h-4 w-4" /> Nova mensagem</Button></div>
                ) : (
                  <div className="mt-3"><Button size="sm" onClick={() => setNova(true)}><Plus className="mr-1 h-4 w-4" /> Criar a primeira campanha</Button></div>
                )}
              </div>
            ) : (
              <>
                {campanhas.length > 0 && (
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => novaMensagem()}><Plus className="mr-1 h-4 w-4" /> Nova mensagem</Button>
                  </div>
                )}
                {dias.proximos.map(blocoDia)}
              </>
            )}

            {dias.anteriores.length > 0 && (
              <div className="space-y-6 border-t border-border pt-4">
                <Button variant="ghost" size="sm" onClick={() => setVerAnteriores((v) => !v)}>
                  {verAnteriores ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
                  {verAnteriores ? "Esconder dias anteriores" : `Ver dias anteriores (${dias.anteriores.length})`}
                </Button>
                {verAnteriores && dias.anteriores.map(blocoDia)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="oferta" className="mt-4">
            {campanhas.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhuma campanha ainda.
                <div className="mt-3"><Button size="sm" onClick={() => setNova(true)}><Plus className="mr-1 h-4 w-4" /> Nova campanha</Button></div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {campanhas.map((c) => {
                  const msgs = mensagens.filter((m) => m.campanha_id === c.id);
                  const enviadas = msgs.filter((m) => m.status === "enviada").length;
                  const st = STATUS_CAMPANHA[c.status] ?? { rotulo: c.status, cor: "" };
                  return (
                    <button key={c.id} type="button" onClick={() => setAberta(c.id)}
                      className="flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50"
                      style={{ borderLeft: `4px solid ${c.cor}` }}>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold leading-tight">{c.oferta}</h3>
                        <Badge variant="outline" className={`shrink-0 text-[11px] ${st.cor}`}>{st.rotulo}</Badge>
                      </div>
                      {c.descricao && <p className="line-clamp-2 text-xs text-muted-foreground">{c.descricao}</p>}
                      <p className="text-sm text-muted-foreground">{rotuloPeriodo(c, msgs)}</p>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{msgs.length} {msgs.length === 1 ? "mensagem" : "mensagens"}</span>
                          <span>{enviadas} {enviadas === 1 ? "enviada" : "enviadas"}</span>
                        </div>
                        <Progress value={msgs.length ? (enviadas / msgs.length) * 100 : 0} className="h-1.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <NovaCampanhaDialog open={nova} onOpenChange={setNova} onCriada={(c) => setAberta(c.id)} />
      <GruposDialog open={gruposAberto} onOpenChange={setGruposAberto} grupos={grupos} />
      <CampanhaSheet
        campanha={campanhaAberta}
        onClose={() => setAberta(null)}
        onAbrirCampanha={(c) => setAberta(c.id)}
        mensagens={mensagens}
        grupos={grupos}
        onNovaMensagem={(id, dia) => novaMensagem(id, dia)}
        onAbrirMensagem={(m) => setEditor({ mensagem: m })}
      />
      <MensagemEditor
        alvo={editor}
        onClose={() => setEditor(null)}
        onAbrir={(m) => setEditor({ mensagem: m })}
        campanhas={campanhas}
        grupos={grupos}
        mensagens={mensagens}
      />
    </div>
  );
}
