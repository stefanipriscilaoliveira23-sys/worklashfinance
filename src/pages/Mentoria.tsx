import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import { STATUS_JORNADA, diasRestantes, gerarTarefasDaEtapa } from "@/lib/mentoria";
import MentoradaSheet from "@/components/mentoria/MentoradaSheet";
import ProcessosTab from "@/components/mentoria/ProcessosTab";
import TagsAluna from "@/components/mentoria/TagsAluna";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, Loader2, Search } from "lucide-react";

const COLUNAS = STATUS_JORNADA;

export default function Mentoria() {
  const qc = useQueryClient();
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [colunaAlvo, setColunaAlvo] = useState<string | null>(null);

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

  const filtradas = (mentoradas ?? []).filter((m) =>
    m.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const ativas = (mentoradas ?? []).filter((m) => !["Concluída", "Cancelada", "Inativa"].includes(m.status_jornada));
  const emRenovacao = (mentoradas ?? []).filter((m) => {
    const d = diasRestantes(m.data_termino);
    return d !== null && d <= 30 && d >= 0 && m.status_jornada !== "Cancelada";
  });

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
          <TabsTrigger value="processos">Processos</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <CardResumo titulo="Mentoradas ativas" valor={String(ativas.length)} />
            <CardResumo titulo="Renovação em até 30 dias" valor={String(emRenovacao.length)} />
            <CardResumo titulo="Total cadastradas" valor={String((mentoradas ?? []).length)} />
          </div>

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
                      <div className="space-y-2 min-h-[80px]">
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
                              <TagsAluna tags={(m as any).tags} />
                              <p className="text-[11px] text-muted-foreground truncate">{m.programa}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {m.data_termino ? `Termina em ${formatDate(m.data_termino)}` : "Sem data de término"}
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
