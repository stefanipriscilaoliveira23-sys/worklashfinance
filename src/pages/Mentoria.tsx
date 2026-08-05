import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import { STATUS_JORNADA, diasRestantes, gerarTarefasDaEtapa } from "@/lib/mentoria";
import { notificarProprio } from "@/lib/notificacoes";
import MentoradaSheet from "@/components/mentoria/MentoradaSheet";
import PipelineEditorDialog from "@/components/mentoria/PipelineEditorDialog";
import TagsAluna from "@/components/mentoria/TagsAluna";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, GraduationCap, Loader2, Search, Settings2, SlidersHorizontal } from "lucide-react";


export default function Mentoria() {
  const qc = useQueryClient();
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [colunaAlvo, setColunaAlvo] = useState<string | null>(null);
  const [soPendencias, setSoPendencias] = useState(false);
  const [pipelineId, setPipelineId] = useState<string>("todas");
  const [editandoPipeline, setEditandoPipeline] = useState<{ id: string; nome: string } | null>(null);
  const [soRenovacao, setSoRenovacao] = useState(false);
  const [ordem, setOrdem] = useState("padrao");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const FILTROS_PADRAO = {
    programa: "todos", vendedor: "todos", tag: "todas", cobranca: "todos", renovacao: "todos",
    prazo: "todos", atividade: "todas", ativa: "todas", vencerDias: "todos", parcelas: "todas",
    proximaAte: "", valorMin: "", valorMax: "", inicioDe: "", inicioAte: "", terminoDe: "", terminoAte: "",
  };
  const [f, setF] = useState({ ...FILTROS_PADRAO });
  const setFiltro = (k: keyof typeof FILTROS_PADRAO, v: string) => setF((s) => ({ ...s, [k]: v }));

  const { data: pipelines } = useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines").select("*").order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: etapasPipeline } = useQuery({
    queryKey: ["pipeline-etapas", pipelineId],
    enabled: pipelineId !== "todas",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_etapas" as any).select("nome, ordem")
        .eq("pipeline_id", pipelineId).order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as { nome: string; ordem: number }[];
    },
  });

  const COLUNAS: string[] =
    pipelineId !== "todas" && etapasPipeline?.length
      ? etapasPipeline.map((e) => e.nome)
      : [...STATUS_JORNADA];


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

  // Financeiro por cliente: inadimplência, próxima parcela e parcelas restantes
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
      const porCliente = new Map<string, { proxima: string | null; restantes: number; atrasadas: number; valorRestante: number }>();
      if (!ids.length) return { inadimplentes, comContrato, porCliente };
      const { data: det } = await supabase
        .from("parcelas_mentoria_detalhe")
        .select("parcela_mentoria_id, status, data_vencimento, valor_real, valor_sugerido, saldo_parcela")
        .in("parcela_mentoria_id", ids);
      (det ?? []).forEach((d: any) => {
        const cid = mapa.get(d.parcela_mentoria_id);
        if (!cid) return;
        const atrasada = d.status === "Atraso" || (d.status !== "Quitado" && d.data_vencimento && d.data_vencimento < hoje);
        if (atrasada) inadimplentes.add(cid);
        const info = porCliente.get(cid) ?? { proxima: null, restantes: 0, atrasadas: 0, valorRestante: 0 };
        if (d.status !== "Quitado") {
          info.restantes += 1;
          info.valorRestante += Number(d.saldo_parcela ?? d.valor_real ?? d.valor_sugerido ?? 0);
          if (d.data_vencimento && (!info.proxima || d.data_vencimento < info.proxima)) info.proxima = d.data_vencimento;
        }
        if (atrasada) info.atrasadas += 1;
        porCliente.set(cid, info);
      });
      return { inadimplentes, comContrato, porCliente };
    },
  });
  const inadimplentes = financeiro?.inadimplentes;
  const comContrato = financeiro?.comContrato;
  const finPorCliente = financeiro?.porCliente;



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
      const aluna = (mentoradas ?? []).find((m) => m.id === id);
      await gerarTarefasDaEtapa(id, etapa, aluna?.pipeline_id ?? null);
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

  const fin = (m: any) => (m.cliente_id ? finPorCliente?.get(m.cliente_id) : undefined);
  const progressoTotal = (id: string) => {
    const itens = (tarefas ?? []).filter((t) => t.mentorada_id === id);
    return { total: itens.length, feitas: itens.filter((t) => t.concluida).length };
  };

  const INATIVOS = ["Concluída", "Cancelada", "Inativa"];

  const filtradas = doPipeline.filter((m) => {
    if (!m.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    if (soPendencias && !m.motivo_cancelamento) return false;
    if (soRenovacao) {
      const d = diasRestantes(m.data_termino);
      if (!(d !== null && d >= 0 && d <= 30 && m.status_jornada !== "Cancelada")) return false;
    }
    if (f.programa !== "todos" && m.programa !== f.programa) return false;
    if (f.vendedor !== "todos" && (m.vendedor ?? "") !== f.vendedor) return false;
    if (f.tag !== "todas" && !((m.tags ?? []) as string[]).includes(f.tag)) return false;
    if (f.cobranca !== "todos" && (m.status_cobranca ?? "") !== f.cobranca) return false;
    if (f.renovacao !== "todos" && (m.status_renovacao ?? "") !== f.renovacao) return false;
    if (f.prazo !== "todos" && String(m.prazo_meses ?? "") !== f.prazo) return false;
    if (f.atividade !== "todas") {
      const { total, feitas } = progressoTotal(m.id);
      if (f.atividade === "pendentes" && !(total > feitas)) return false;
      if (f.atividade === "concluidas" && !(total > 0 && feitas === total)) return false;
      if (f.atividade === "sem" && total !== 0) return false;
    }
    if (f.ativa !== "todas") {
      const inativa = INATIVOS.includes(m.status_jornada);
      if (f.ativa === "ativas" && inativa) return false;
      if (f.ativa === "inativas" && !inativa) return false;
    }
    if (f.vencerDias !== "todos") {
      const d = diasRestantes(m.data_termino);
      if (d === null || d < 0 || d > Number(f.vencerDias)) return false;
    }
    if (f.parcelas !== "todas") {
      const i = fin(m);
      if (f.parcelas === "com" && !(i && i.restantes > 0)) return false;
      if (f.parcelas === "sem" && i && i.restantes > 0) return false;
      if (f.parcelas === "atraso" && !(i && i.atrasadas > 0)) return false;
    }
    if (f.proximaAte) {
      const i = fin(m);
      if (!i?.proxima || i.proxima > f.proximaAte) return false;
    }
    if (f.valorMin && Number(m.valor_mentoria ?? 0) < Number(f.valorMin)) return false;
    if (f.valorMax && Number(m.valor_mentoria ?? 0) > Number(f.valorMax)) return false;
    if (f.inicioDe && (!m.data_inicio || m.data_inicio < f.inicioDe)) return false;
    if (f.inicioAte && (!m.data_inicio || m.data_inicio > f.inicioAte)) return false;
    if (f.terminoDe && (!m.data_termino || m.data_termino < f.terminoDe)) return false;
    if (f.terminoAte && (!m.data_termino || m.data_termino > f.terminoAte)) return false;
    return true;
  });

  const ordenar = (lista: any[]) => {
    const nulo = (v: any) => v === null || v === undefined || v === "";
    const arr = [...lista];
    arr.sort((a, b) => {
      switch (ordem) {
        case "nome": return a.nome.localeCompare(b.nome);
        case "nome-desc": return b.nome.localeCompare(a.nome);
        case "valor": return Number(b.valor_mentoria ?? 0) - Number(a.valor_mentoria ?? 0);
        case "valor-asc": return Number(a.valor_mentoria ?? 0) - Number(b.valor_mentoria ?? 0);
        case "inicio": return (a.data_inicio ?? "9999").localeCompare(b.data_inicio ?? "9999");
        case "termino": return (a.data_termino ?? "9999").localeCompare(b.data_termino ?? "9999");
        case "vencimento": {
          const da = diasRestantes(a.data_termino), db = diasRestantes(b.data_termino);
          return (da ?? 99999) - (db ?? 99999);
        }
        case "parcelas": return (fin(b)?.restantes ?? 0) - (fin(a)?.restantes ?? 0);
        case "proxima-parcela": {
          const pa = fin(a)?.proxima, pb = fin(b)?.proxima;
          if (nulo(pa) && nulo(pb)) return 0;
          if (nulo(pa)) return 1;
          if (nulo(pb)) return -1;
          return pa!.localeCompare(pb!);
        }
        default: return 0;
      }
    });
    return arr;
  };

  const ativas = doPipeline.filter((m) => !INATIVOS.includes(m.status_jornada));
  const emRenovacao = doPipeline.filter((m) => {
    const d = diasRestantes(m.data_termino);
    return d !== null && d <= 30 && d >= 0 && m.status_jornada !== "Cancelada";
  });

  const opcoes = (campo: string) =>
    Array.from(new Set(doPipeline.map((m: any) => m[campo]).filter(Boolean))).sort() as string[];
  const todasTags = Array.from(
    new Set(doPipeline.flatMap((m: any) => (m.tags ?? []) as string[]))
  ).sort();


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
                onClick={() => {
                  if (pipelineId === p.id) setEditandoPipeline({ id: p.id, nome: p.nome });
                  else setPipelineId(p.id);
                }}
                title={pipelineId === p.id ? "Clique novamente para editar etapas e tarefas" : p.nome}
                className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  pipelineId === p.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-surface-hover"
                }`}
              >
                {p.nome}
                {pipelineId === p.id && <Settings2 className="h-3 w-3" />}
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
            <CardResumo
              titulo="Renovação em até 30 dias"
              valor={String(emRenovacao.length)}
              ativo={soRenovacao}
              onClick={() => setSoRenovacao((v) => !v)}
              legenda={soRenovacao ? "Mostrando só essas alunas — clique para ver todas" : "Clique para filtrar"}
            />
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

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar mentorada" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>

            <Select value={ordem} onValueChange={setOrdem}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="padrao">Ordem padrão</SelectItem>
                <SelectItem value="nome">Nome (A-Z)</SelectItem>
                <SelectItem value="nome-desc">Nome (Z-A)</SelectItem>
                <SelectItem value="vencimento">Tempo para vencer</SelectItem>
                <SelectItem value="inicio">Data de início</SelectItem>
                <SelectItem value="termino">Data de término</SelectItem>
                <SelectItem value="valor">Maior valor</SelectItem>
                <SelectItem value="valor-asc">Menor valor</SelectItem>
                <SelectItem value="parcelas">Parcelas a vencer</SelectItem>
                <SelectItem value="proxima-parcela">Próxima parcela</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => setMostrarFiltros((v) => !v)}>
              <SlidersHorizontal className="h-4 w-4 mr-2" /> Filtros
            </Button>
            <Button variant="ghost" onClick={() => { setF({ ...FILTROS_PADRAO }); setSoRenovacao(false); setSoPendencias(false); setBusca(""); }}>
              Limpar
            </Button>
            <Badge variant="secondary">{filtradas.length} alunas</Badge>
          </div>

          {mostrarFiltros && (
            <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
              <FiltroSelect label="Tipo de mentoria" value={f.programa} onChange={(v) => setFiltro("programa", v)} todos="todos" opcoes={opcoes("programa")} />
              <FiltroSelect label="Vendedor" value={f.vendedor} onChange={(v) => setFiltro("vendedor", v)} todos="todos" opcoes={opcoes("vendedor")} />
              <FiltroSelect label="Tag" value={f.tag} onChange={(v) => setFiltro("tag", v)} todos="todas" opcoes={todasTags} />
              <FiltroSelect label="Status de cobrança" value={f.cobranca} onChange={(v) => setFiltro("cobranca", v)} todos="todos" opcoes={opcoes("status_cobranca")} />
              <FiltroSelect label="Status de renovação" value={f.renovacao} onChange={(v) => setFiltro("renovacao", v)} todos="todos" opcoes={opcoes("status_renovacao")} />
              <FiltroSelect label="Prazo (meses)" value={f.prazo} onChange={(v) => setFiltro("prazo", v)} todos="todos" opcoes={Array.from(new Set(doPipeline.map((m) => String(m.prazo_meses ?? "")).filter(Boolean))).sort((a, b) => Number(a) - Number(b))} />

              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Atividades</p>
                <Select value={f.atividade} onValueChange={(v) => setFiltro("atividade", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="pendentes">Com tarefas pendentes</SelectItem>
                    <SelectItem value="concluidas">Todas tarefas concluídas</SelectItem>
                    <SelectItem value="sem">Sem tarefas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Situação</p>
                <Select value={f.ativa} onValueChange={(v) => setFiltro("ativa", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="ativas">Ativas</SelectItem>
                    <SelectItem value="inativas">Inativas / encerradas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Vence em até</p>
                <Select value={f.vencerDias} onValueChange={(v) => setFiltro("vencerDias", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Qualquer prazo</SelectItem>
                    <SelectItem value="7">7 dias</SelectItem>
                    <SelectItem value="15">15 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="60">60 dias</SelectItem>
                    <SelectItem value="90">90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Parcelas</p>
                <Select value={f.parcelas} onValueChange={(v) => setFiltro("parcelas", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="com">Com parcelas restantes</SelectItem>
                    <SelectItem value="sem">Sem parcelas restantes</SelectItem>
                    <SelectItem value="atraso">Com parcelas em atraso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <FiltroData label="Próxima parcela até" value={f.proximaAte} onChange={(v) => setFiltro("proximaAte", v)} />
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Valor da mentoria (R$)</p>
                <div className="flex gap-2">
                  <Input type="number" placeholder="mín" value={f.valorMin} onChange={(e) => setFiltro("valorMin", e.target.value)} />
                  <Input type="number" placeholder="máx" value={f.valorMax} onChange={(e) => setFiltro("valorMax", e.target.value)} />
                </div>
              </div>
              <FiltroData label="Início de" value={f.inicioDe} onChange={(v) => setFiltro("inicioDe", v)} />
              <FiltroData label="Início até" value={f.inicioAte} onChange={(v) => setFiltro("inicioAte", v)} />
              <FiltroData label="Término de" value={f.terminoDe} onChange={(v) => setFiltro("terminoDe", v)} />
              <FiltroData label="Término até" value={f.terminoAte} onChange={(v) => setFiltro("terminoAte", v)} />
            </div>
          )}


          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-4 min-w-max">
                {COLUNAS.map((coluna) => {
                  const itens = ordenar(filtradas.filter((m) => m.status_jornada === coluna));
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

      </Tabs>

      <MentoradaSheet id={selecionada} onClose={() => setSelecionada(null)} />

      <PipelineEditorDialog
        pipeline={editandoPipeline}
        open={!!editandoPipeline}
        onClose={() => setEditandoPipeline(null)}
      />

    </div>
  );
}

function CardResumo({ titulo, valor, onClick, ativo, legenda }: { titulo: string; valor: string; onClick?: () => void; ativo?: boolean; legenda?: string }) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`w-full text-left rounded-xl border bg-card p-4 transition-colors ${
        onClick ? "hover:bg-surface-hover cursor-pointer" : ""
      } ${ativo ? "border-primary bg-primary/5" : "border-border"}`}
    >
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={`text-2xl font-bold mt-1 ${ativo ? "text-primary" : ""}`}>{valor}</p>
      {legenda && <p className="text-[10px] text-muted-foreground mt-1">{legenda}</p>}
    </Comp>
  );
}

function FiltroSelect({ label, value, onChange, todos, opcoes }: { label: string; value: string; onChange: (v: string) => void; todos: string; opcoes: string[] }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={todos}>Todos</SelectItem>
          {opcoes.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function FiltroData({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
