import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import { STATUS_JORNADA, diasRestantes, gerarTarefasDaEtapa } from "@/lib/mentoria";
import { notificarProprio } from "@/lib/notificacoes";
import MentoradaSheet from "@/components/mentoria/MentoradaSheet";
import ProcessosTab from "@/components/mentoria/ProcessosTab";
import TagsAluna from "@/components/mentoria/TagsAluna";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, GraduationCap, Loader2, Search } from "lucide-react";

const COLUNAS = STATUS_JORNADA;

export default function Mentoria() {
  const qc = useQueryClient();
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [colunaAlvo, setColunaAlvo] = useState<string | null>(null);
  const [soPendencias, setSoPendencias] = useState(false);
  const [pipelineId, setPipelineId] = useState<string>("todas");

  const { data: pipelines } = useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines").select("*").order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: mentoradas, isLoading } = useQuery({
    queryKey: ["mentoradas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentoradas").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tarefas } = useQuery({
    queryKey: ["mentorada-tarefas-todas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentorada_tarefas").select("mentorada_id, etapa, concluida");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Clientes com parcelas de mentoria em atraso (não quitadas e vencidas)
  const { data: financeiro } = useQuery({
    queryKey: ["clientes-inadimplentes"],
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data: contratos } = await supabase
        .from("parcelas_mentoria").select("id, cliente_id");
      const mapa = new Map<string, string>();
      const comContrato = new Set<string>();
      (contratos ?? []).forEach((c) => {
        if (c.cliente_id) { mapa.set(c.id, c.cliente_id); comContrato.add(c.cliente_id); }
      });
      const ids = [...mapa.keys()];
      const inadimplentes = new Set<string>();
      if (!ids.length) return { inadimplentes, comContrato };
      const { data: det } = await supabase
        .from("parcelas_mentoria_detalhe")
        .select("parcela_mentoria_id, status, data_vencimento")
        .in("parcela_mentoria_id", ids);
      (det ?? []).forEach((d: any) => {
        const atrasada = d.status === "Atraso" || (d.status !== "Quitado" && d.data_vencimento && d.data_vencimento < hoje);
        const cid = mapa.get(d.parcela_mentoria_id);
        if (atrasada && cid) inadimplentes.add(cid);
      });
      return { inadimplentes, comContrato };
    },
  });
  const inadimplentes = financeiro?.inadimplentes;
  const comContrato = financeiro?.comContrato;



  // Mostra INADIMPLENTE apenas quando há parcela vencida de verdade.
  // Se a aluna já tem contrato lançado e está em dia, a tag antiga da importação é ocultada.
  const tagsExibidas = (m: any) => {
    const tags = ((m.tags ?? []) as string[]);
    const atrasada = !!m.cliente_id && !!inadimplentes?.has(m.cliente_id);
    const temContrato = !!m.cliente_id && !!comContrato?.has(m.cliente_id);
    const base = temContrato && !atrasada
      ? tags.filter((t) => !t.toUpperCase().includes("INADIMPL"))
      : tags;
    return atrasada && !base.some((t) => t.toUpperCase().includes("INADIMPL"))
      ? [...base, "INADIMPLENTE"]
      : base;
  };

  const progressoDe = (mentoradaId: string, etapa: string) => {
    const itens = (tarefas ?? []).filter((t) => t.mentorada_id === mentoradaId && t.etapa === etapa);
    return { total: itens.length, feitas: itens.filter((t) => t.concluida).length };
  };

  const moverEtapa = useMutation({
    mutationFn: async ({ id, etapa }: { id: string; etapa: string }) => {
      const { error } = await supabase.from("mentoradas").update({ status_jornada: etapa }).eq("id", id);
      if (error) throw error;
      await gerarTarefasDaEtapa(id, etapa);
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["mentoradas"] });
      qc.invalidateQueries({ queryKey: ["mentorada-tarefas-todas"] });
      qc.invalidateQueries({ queryKey: ["mentorada-tarefas"] });
      toast.success(`Aluna movida para ${v.etapa}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const criarPipeline = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase.from("pipelines").insert({ nome, ordem: (pipelines ?? []).length + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipelines"] });
      toast.success("Pipeline criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doPipeline = (mentoradas ?? []).filter(
    (m) => pipelineId === "todas" || m.pipeline_id === pipelineId
  );

  const pendencias = doPipeline.filter((m) => !!m.motivo_cancelamento);

  const filtradas = doPipeline.filter(
    (m) =>
      m.nome.toLowerCase().includes(busca.toLowerCase()) &&
      (!soPendencias || !!m.motivo_cancelamento)
  );

  const ativas = doPipeline.filter((m) => !["Concluída", "Cancelada", "Inativa"].includes(m.status_jornada));
  const emRenovacao = doPipeline.filter((m) => {
    const d = diasRestantes(m.data_termino);
    return d !== null && d <= 30 && d >= 0 && m.status_jornada !== "Cancelada";
  });


  useEffect(() => {
    if (!mentoradas || pendencias.length === 0) return;
    const chave = `mentoria-pendencias-${new Date().toISOString().slice(0, 10)}`;
    if (localStorage.getItem(chave)) return;
    localStorage.setItem(chave, "1");
    const juridico = pendencias.filter((m) => (m.motivo_cancelamento ?? "").toLowerCase().includes("jur")).length;
    notificarProprio({
      titulo: `${pendencias.length} pendências jurídicas / inadimplência`,
      descricao: `${juridico} no jurídico e ${pendencias.length - juridico} com parcelas em atraso. Acompanhe a cobrança.`,
      tipo: "mentoria",
      link_interno: "/mentoria",
    });
  }, [mentoradas, pendencias.length]);


  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" /> Mentoria
        </h1>
        <p className="text-sm text-muted-foreground">
          Jornada das alunas, do onboarding à renovação. Novas mentoradas nascem no lançamento da receita.
        </p>
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        </TabsList>


        <TabsContent value="pipeline" className="space-y-4 pt-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPipelineId("todas")}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                pipelineId === "todas" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-surface-hover"
              }`}
            >
              Todas
            </button>
            {(pipelines ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPipelineId(p.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  pipelineId === p.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-surface-hover"
                }`}
              >
                {p.nome}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const nome = window.prompt("Nome da nova pipeline");
                if (nome?.trim()) criarPipeline.mutate(nome.trim());
              }}
              className="rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-surface-hover"
            >
              + Nova pipeline
            </button>
          </div>


          <div className="grid gap-4 sm:grid-cols-3">
            <CardResumo titulo="Mentoradas ativas" valor={String(ativas.length)} />
            <CardResumo titulo="Renovação em até 30 dias" valor={String(emRenovacao.length)} />
            <CardResumo titulo="Total cadastradas" valor={String(doPipeline.length)} />
          </div>


          {pendencias.length > 0 && (
            <button
              type="button"
              onClick={() => setSoPendencias((v) => !v)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                soPendencias
                  ? "border-destructive bg-destructive/10"
                  : "border-destructive/40 bg-destructive/5 hover:bg-destructive/10"
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <p className="text-sm font-semibold text-destructive">
                  Pendências jurídicas / inadimplência ({pendencias.length})
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {soPendencias
                  ? "Mostrando apenas essas alunas. Clique para ver todas."
                  : "Clique para filtrar e acompanhar essas alunas."}
              </p>
            </button>
          )}

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar mentorada" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>


          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-4 min-w-max">
                {COLUNAS.map((coluna) => {
                  const itens = filtradas.filter((m) => m.status_jornada === coluna);
                  return (
                    <div
                      key={coluna}
                      onDragOver={(e) => { e.preventDefault(); setColunaAlvo(coluna); }}
                      onDragLeave={() => setColunaAlvo((c) => (c === coluna ? null : c))}
                      onDrop={(e) => {
                        e.preventDefault();
                        setColunaAlvo(null);
                        const id = arrastando ?? e.dataTransfer.getData("text/plain");
                        setArrastando(null);
                        if (!id) return;
                        const atual = (mentoradas ?? []).find((m) => m.id === id);
                        if (!atual || atual.status_jornada === coluna) return;
                        moverEtapa.mutate({ id, etapa: coluna });
                      }}
                      className={`w-72 shrink-0 rounded-xl border bg-card p-3 transition-colors ${
                        colunaAlvo === coluna ? "border-primary bg-surface-hover" : "border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold">{coluna}</p>
                        <Badge variant="secondary">{itens.length}</Badge>
                      </div>
                      <div className="space-y-2 min-h-[80px] max-h-[60vh] overflow-y-auto pr-1 thin-scroll">
                        {itens.map((m) => {
                          const dias = diasRestantes(m.data_termino);
                          const { total, feitas } = progressoDe(m.id, m.status_jornada);
                          const pct = total ? Math.round((feitas / total) * 100) : 0;
                          return (
                            <div
                              key={m.id}
                              draggable
                              onDragStart={(e) => {
                                setArrastando(m.id);
                                e.dataTransfer.setData("text/plain", m.id);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onDragEnd={() => { setArrastando(null); setColunaAlvo(null); }}
                              onClick={() => setSelecionada(m.id)}
                              className={`cursor-grab active:cursor-grabbing rounded-lg border border-border p-3 hover:bg-surface-hover transition-colors ${
                                arrastando === m.id ? "opacity-50" : ""
                              }`}
                            >
                              <p className="text-sm font-medium truncate">{m.nome}</p>
                              <TagsAluna tags={tagsExibidas(m)} />


                              <p className="text-[11px] text-muted-foreground truncate">{m.programa}</p>
                              <p className={`text-[11px] ${
                                dias === null ? "text-muted-foreground"
                                  : dias < 0 ? "text-destructive"
                                  : dias <= 30 ? "text-amber-500" : "text-muted-foreground"
                              }`}>
                                {dias === null
                                  ? "Sem data de término"
                                  : dias < 0
                                    ? `Encerrada há ${Math.abs(dias)} dias`
                                    : dias === 0
                                      ? "Termina hoje"
                                      : `Faltam ${dias} dias para terminar`}
                              </p>

                              {m.valor_mentoria ? (
                                <p className="text-[11px] font-medium mt-1">{formatCurrency(m.valor_mentoria)}</p>
                              ) : null}
                              <div className="mt-2">
                                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                  <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  {total ? `${feitas}/${total} tarefas` : "Sem tarefas na etapa"}
                                </p>
                              </div>
                              {dias !== null && dias >= 0 && dias <= 30 && (
                                <Badge variant="outline" className="mt-1 text-[10px]">Renovar em {dias}d</Badge>
                              )}
                            </div>
                          );
                        })}
                        {itens.length === 0 && (
                          <p className="text-xs text-muted-foreground py-4 text-center">Arraste alunas para cá.</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="processos" className="pt-4">
          <ProcessosTab />
        </TabsContent>
      </Tabs>

      <MentoradaSheet id={selecionada} onClose={() => setSelecionada(null)} />
    </div>
  );
}

function CardResumo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="text-2xl font-bold mt-1">{valor}</p>
    </div>
  );
}
