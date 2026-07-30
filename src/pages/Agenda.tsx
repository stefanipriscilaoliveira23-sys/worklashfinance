import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { notificarProprio, criarNotificacao } from "@/lib/notificacoes";
import { useAuth } from "@/contexts/AuthContext";
import ReuniaoDetalhe from "@/components/agenda/ReuniaoDetalhe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Loader2, Plus, Trash2 } from "lucide-react";


const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function proximosDias(n: number) {
  const out: string[] = [];
  const hoje = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    out.push(d.toISOString().split("T")[0]);
  }
  return out;
}

const AG_VAZIO = {
  nome: "", whatsapp: "", instagram: "", tipo_id: "", anfitriao_id: "",
  data: "", hora_inicio: "", observacoes: "", link_reuniao: "",
};

export default function Agenda() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [showTipo, setShowTipo] = useState(false);
  const [showAgendar, setShowAgendar] = useState(false);
  const [tipoForm, setTipoForm] = useState({ nome: "", duracao_minutos: "60", descricao: "", titulo_pagina: "", subtitulo_pagina: "" });
  const [agForm, setAgForm] = useState({ ...AG_VAZIO });
  const [dispForm, setDispForm] = useState({ tipo_id: "", dia_semana: "1", hora_inicio: "09:00", hora_fim: "18:00" });
  const [bloqForm, setBloqForm] = useState({ data: "", hora_inicio: "", hora_fim: "", motivo: "" });
  const [visao, setVisao] = useState<"calendario" | "lista">("calendario");
  const [mesRef, setMesRef] = useState(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1); });
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  const { data: anfitrioes } = useQuery({
    queryKey: ["anfitrioes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("anfitrioes").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: perfis } = useQuery({
    queryKey: ["perfis-equipe"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, email, display_name");
      return data ?? [];
    },
  });

  const nomeAnfitriao = (id: string | null | undefined) =>
    (anfitrioes ?? []).find((a) => a.id === id)?.nome ?? "";
  const nomeTipo = (id: string | null | undefined) =>
    (tipos ?? []).find((t) => t.id === id)?.nome ?? "reunião";


  const { data: tipos } = useQuery({
    queryKey: ["agenda-tipos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agenda_tipos").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: disponibilidade } = useQuery({
    queryKey: ["agenda-disponibilidade"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agenda_disponibilidade").select("*")
        .order("dia_semana").order("hora_inicio");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: bloqueios } = useQuery({
    queryKey: ["agenda-bloqueios"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agenda_bloqueios").select("*").order("data");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: agendamentos, isLoading } = useQuery({
    queryKey: ["agendamentos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agendamentos").select("*")
        .order("data", { ascending: true }).order("hora_inicio", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const criarTipo = useMutation({
    mutationFn: async () => {
      if (!tipoForm.nome.trim()) throw new Error("Informe o nome");
      const { error } = await supabase.from("agenda_tipos").insert({
        nome: tipoForm.nome.trim(),
        slug: slugify(tipoForm.nome),
        duracao_minutos: Number(tipoForm.duracao_minutos) || 60,
        descricao: tipoForm.descricao || null,
        titulo_pagina: tipoForm.titulo_pagina || null,
        subtitulo_pagina: tipoForm.subtitulo_pagina || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setShowTipo(false);
      setTipoForm({ nome: "", duracao_minutos: "60", descricao: "", titulo_pagina: "", subtitulo_pagina: "" });
      qc.invalidateQueries({ queryKey: ["agenda-tipos"] });
      toast.success("Tipo de agendamento criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alternarTipo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("agenda_tipos").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda-tipos"] }),
  });

  const addDisp = useMutation({
    mutationFn: async () => {
      if (!dispForm.tipo_id) throw new Error("Escolha o tipo de agendamento");
      const { error } = await supabase.from("agenda_disponibilidade").insert({
        tipo_id: dispForm.tipo_id,
        dia_semana: Number(dispForm.dia_semana),
        hora_inicio: dispForm.hora_inicio,
        hora_fim: dispForm.hora_fim,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agenda-disponibilidade"] }); toast.success("Disponibilidade adicionada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delDisp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agenda_disponibilidade").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda-disponibilidade"] }),
  });

  const addBloq = useMutation({
    mutationFn: async () => {
      if (!bloqForm.data) throw new Error("Informe a data");
      const { error } = await supabase.from("agenda_bloqueios").insert({
        data: bloqForm.data,
        hora_inicio: bloqForm.hora_inicio || null,
        hora_fim: bloqForm.hora_fim || null,
        motivo: bloqForm.motivo || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setBloqForm({ data: "", hora_inicio: "", hora_fim: "", motivo: "" }); qc.invalidateQueries({ queryKey: ["agenda-bloqueios"] }); toast.success("Bloqueio criado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delBloq = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agenda_bloqueios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda-bloqueios"] }),
  });

  const criarAgendamento = useMutation({
    mutationFn: async () => {
      if (!agForm.nome.trim() || !agForm.data || !agForm.hora_inicio) throw new Error("Preencha convidado, data e horário");
      if (!agForm.anfitriao_id) throw new Error("Escolha o anfitrião da reunião");
      const tipo = (tipos ?? []).find((t) => t.id === agForm.tipo_id);
      const dur = tipo?.duracao_minutos ?? 60;
      const [h, min] = agForm.hora_inicio.split(":").map(Number);
      const fimMin = h * 60 + min + dur;
      const horaFim = `${String(Math.floor(fimMin / 60) % 24).padStart(2, "0")}:${String(fimMin % 60).padStart(2, "0")}`;
      const { data: criado, error } = await supabase.from("agendamentos").insert({
        nome: agForm.nome.trim(),
        whatsapp: agForm.whatsapp || null,
        instagram: agForm.instagram || null,
        tipo_id: agForm.tipo_id || null,
        anfitriao_id: agForm.anfitriao_id,
        agendado_por: user?.id ?? null,
        data: agForm.data,
        hora_inicio: agForm.hora_inicio,
        hora_fim: horaFim,
        observacoes: agForm.observacoes || null,
        link_reuniao: agForm.link_reuniao || null,
        status: "Confirmado",
        origem: "Interno",
      }).select("id").single();
      if (error) throw error;

      const anfitriao = (anfitrioes ?? []).find((a) => a.id === agForm.anfitriao_id);
      const perfilAnfitriao = (perfis ?? []).find(
        (p) => (p.email ?? "").toLowerCase() === (anfitriao?.email ?? "").toLowerCase() && !!anfitriao?.email,
      );
      const descricaoReuniao = `${agForm.nome} em ${formatDate(agForm.data)} às ${agForm.hora_inicio} (${tipo?.nome ?? "reunião"})`;

      if (perfilAnfitriao?.user_id) {
        await criarNotificacao({
          destinatario_id: perfilAnfitriao.user_id,
          titulo: `Reunião agendada: ${descricaoReuniao}`,
          tipo: "agenda",
          link_interno: "/agenda",
        });
      }

      await notificarProprio({
        titulo: "Reunião agendada",
        descricao: `${descricaoReuniao} com ${anfitriao?.nome ?? "anfitrião"}`,
        tipo: "agenda", link_interno: "/agenda",
      });

      if (criado?.id) {
        await supabase.from("agendamento_tarefas").insert([
          { agendamento_id: criado.id, responsavel_id: user?.id ?? null, titulo: "Enviar lembrete ao anfitrião" },
          { agendamento_id: criado.id, responsavel_id: user?.id ?? null, titulo: "Enviar confirmação ao convidado" },
        ]);
      }
    },
    onSuccess: () => {
      setShowAgendar(false);
      setAgForm({ ...AG_VAZIO });
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
      toast.success("Agendamento criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const mudarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("agendamentos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agendamentos"] }),
  });

  const dias = proximosDias(14);
  const porDia = dias.map((d) => ({
    data: d,
    itens: (agendamentos ?? []).filter((a) => a.data === d),
  }));

  const celulasDoMes: (string | null)[] = (() => {
    const ano = mesRef.getFullYear();
    const mes = mesRef.getMonth();
    const primeiro = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const out: (string | null)[] = Array(primeiro).fill(null);
    for (let d = 1; d <= totalDias; d++) {
      out.push(`${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  })();

  const itensDoDia = diaSelecionado
    ? (agendamentos ?? []).filter((a) => a.data === diaSelecionado)
    : [];

  // Lembrete diário das reuniões do dia (uma vez por dia por usuário)
  useEffect(() => {
    if (!agendamentos?.length) return;
    const hoje = new Date().toISOString().slice(0, 10);
    const doDia = agendamentos.filter((a) => a.data === hoje && a.status !== "Cancelado");
    if (!doDia.length) return;
    const chave = `agenda-lembrete-${hoje}`;
    if (localStorage.getItem(chave)) return;
    localStorage.setItem(chave, "1");
    notificarProprio({
      titulo: `${doDia.length} reunião(ões) hoje`,
      descricao: doDia
        .map((a) => `${a.hora_inicio?.slice(0, 5)} ${a.nome}`)
        .join(" · "),
      tipo: "agenda",
      link_interno: "/agenda",
    });
  }, [agendamentos]);


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" /> Agenda
          </h1>
          <p className="text-sm text-muted-foreground">Agendamentos da equipe e auto-agendamento das alunas.</p>
        </div>
        <Button onClick={() => setShowAgendar(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo agendamento
        </Button>
      </div>

      <Tabs defaultValue="calendario">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="calendario">Agendamentos</TabsTrigger>
          <TabsTrigger value="tipos">Tipos e páginas</TabsTrigger>
          <TabsTrigger value="disponibilidade">Disponibilidade</TabsTrigger>
          <TabsTrigger value="bloqueios">Bloqueios</TabsTrigger>
        </TabsList>

        <TabsContent value="calendario" className="pt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={visao === "calendario" ? "default" : "outline"} onClick={() => setVisao("calendario")}>
              Calendário
            </Button>
            <Button size="sm" variant={visao === "lista" ? "default" : "outline"} onClick={() => setVisao("lista")}>
              Lista
            </Button>
          </div>

          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : visao === "calendario" ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-4">
                <Button size="sm" variant="ghost" onClick={() => setMesRef(new Date(mesRef.getFullYear(), mesRef.getMonth() - 1, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <p className="text-sm font-semibold capitalize">
                  {mesRef.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </p>
                <Button size="sm" variant="ghost" onClick={() => setMesRef(new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                  <p key={d} className="text-[11px] text-center text-muted-foreground font-medium">{d}</p>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {celulasDoMes.map((cel, i) => {
                  if (!cel) return <div key={`v${i}`} className="min-h-20 rounded-lg" />;
                  const itens = (agendamentos ?? []).filter((a) => a.data === cel);
                  const hoje = cel === new Date().toISOString().split("T")[0];
                  return (
                    <button
                      key={cel}
                      onClick={() => itens.length && setDiaSelecionado(cel)}
                      className={`min-h-20 rounded-lg border p-1.5 text-left transition-colors hover:bg-surface-hover ${
                        hoje ? "border-primary" : "border-border"
                      }`}
                    >
                      <span className={`text-[11px] ${hoje ? "font-bold text-primary" : "text-muted-foreground"}`}>
                        {Number(cel.slice(8, 10))}
                      </span>
                      {itens.length > 0 && (
                        <div className="mt-1 space-y-1">
                          <Badge variant="secondary" className="text-[10px] w-full justify-center">
                            {itens.length} {itens.length === 1 ? "reunião" : "reuniões"}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {itens[0].hora_inicio?.slice(0, 5)} {itens[0].nome}
                          </p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {porDia.map(({ data, itens }) => (
                <div key={data} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold">
                      {DIAS[new Date(data + "T00:00:00").getDay()]}, {formatDate(data)}
                    </p>
                    <Badge variant="secondary">{itens.length}</Badge>
                  </div>
                  {itens.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem agendamentos.</p>
                  ) : (
                    <ul className="space-y-2">
                      {itens.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2">
                          <span className="text-sm font-medium w-28">{a.hora_inicio?.slice(0, 5)} — {a.hora_fim?.slice(0, 5)}</span>
                          <span className="text-sm flex-1 min-w-0 truncate">{a.nome}</span>
                          <Badge variant="outline" className="text-[10px]">{a.origem}</Badge>
                          <Select value={a.status} onValueChange={(v) => mudarStatus.mutate({ id: a.id, status: v })}>
                            <SelectTrigger className="h-7 w-36 text-[11px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["Pendente", "Confirmado", "Realizado", "Cancelado", "Não compareceu"].map((s) =>
                                <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>


        <TabsContent value="tipos" className="pt-4 space-y-3">
          <Button variant="outline" size="sm" onClick={() => setShowTipo(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo tipo
          </Button>
          <div className="grid gap-3 md:grid-cols-2">
            {(tipos ?? []).map((t) => {
              const url = `${window.location.origin}/agendar/${t.slug}`;
              return (
                <div key={t.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{t.nome}</p>
                    <Switch checked={t.ativo} onCheckedChange={(v) => alternarTipo.mutate({ id: t.id, ativo: v })} />
                  </div>
                  <p className="text-xs text-muted-foreground">{t.duracao_minutos} minutos</p>
                  {t.descricao && <p className="text-xs text-muted-foreground">{t.descricao}</p>}
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] truncate flex-1 bg-muted rounded px-2 py-1">{url}</code>
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {(tipos ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum tipo criado ainda.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="disponibilidade" className="pt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-5 items-end">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Tipo</Label>
              <Select value={dispForm.tipo_id} onValueChange={(v) => setDispForm({ ...dispForm, tipo_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(tipos ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dia</Label>
              <Select value={dispForm.dia_semana} onValueChange={(v) => setDispForm({ ...dispForm, dia_semana: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIAS.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Início</Label>
              <Input type="time" value={dispForm.hora_inicio} onChange={(e) => setDispForm({ ...dispForm, hora_inicio: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fim</Label>
              <div className="flex gap-2">
                <Input type="time" value={dispForm.hora_fim} onChange={(e) => setDispForm({ ...dispForm, hora_fim: e.target.value })} />
                <Button onClick={() => addDisp.mutate()}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {(disponibilidade ?? []).map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>
                  {DIAS[d.dia_semana]} · {d.hora_inicio.slice(0, 5)} às {d.hora_fim.slice(0, 5)} ·{" "}
                  {(tipos ?? []).find((t) => t.id === d.tipo_id)?.nome ?? "—"}
                </span>
                <button onClick={() => delDisp.mutate(d.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
            {(disponibilidade ?? []).length === 0 && (
              <li className="px-4 py-3 text-sm text-muted-foreground">Nenhuma janela cadastrada.</li>
            )}
          </ul>
        </TabsContent>

        <TabsContent value="bloqueios" className="pt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-5 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input type="date" value={bloqForm.data} onChange={(e) => setBloqForm({ ...bloqForm, data: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Início</Label>
              <Input type="time" value={bloqForm.hora_inicio} onChange={(e) => setBloqForm({ ...bloqForm, hora_inicio: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fim</Label>
              <Input type="time" value={bloqForm.hora_fim} onChange={(e) => setBloqForm({ ...bloqForm, hora_fim: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Motivo</Label>
              <div className="flex gap-2">
                <Input value={bloqForm.motivo} onChange={(e) => setBloqForm({ ...bloqForm, motivo: e.target.value })} />
                <Button onClick={() => addBloq.mutate()}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {(bloqueios ?? []).map((b) => (
              <li key={b.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>
                  {formatDate(b.data)}{b.hora_inicio ? ` · ${b.hora_inicio.slice(0, 5)} às ${b.hora_fim?.slice(0, 5)}` : " · dia inteiro"}
                  {b.motivo ? ` · ${b.motivo}` : ""}
                </span>
                <button onClick={() => delBloq.mutate(b.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
            {(bloqueios ?? []).length === 0 && (
              <li className="px-4 py-3 text-sm text-muted-foreground">Nenhum bloqueio.</li>
            )}
          </ul>
        </TabsContent>
      </Tabs>

      <Dialog open={showTipo} onOpenChange={setShowTipo}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo tipo de agendamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome *</Label>
              <Input value={tipoForm.nome} onChange={(e) => setTipoForm({ ...tipoForm, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duração (minutos)</Label>
              <Input type="number" value={tipoForm.duracao_minutos} onChange={(e) => setTipoForm({ ...tipoForm, duracao_minutos: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Textarea value={tipoForm.descricao} onChange={(e) => setTipoForm({ ...tipoForm, descricao: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Título da página pública</Label>
              <Input value={tipoForm.titulo_pagina} onChange={(e) => setTipoForm({ ...tipoForm, titulo_pagina: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subtítulo da página pública</Label>
              <Input value={tipoForm.subtitulo_pagina} onChange={(e) => setTipoForm({ ...tipoForm, subtitulo_pagina: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTipo(false)}>Cancelar</Button>
            <Button onClick={() => criarTipo.mutate()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAgendar} onOpenChange={setShowAgendar}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo agendamento</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Convidado *</Label>
              <Input value={agForm.nome} onChange={(e) => setAgForm({ ...agForm, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">WhatsApp</Label>
              <Input value={agForm.whatsapp} onChange={(e) => setAgForm({ ...agForm, whatsapp: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Instagram</Label>
              <Input value={agForm.instagram} onChange={(e) => setAgForm({ ...agForm, instagram: e.target.value })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Anfitrião *</Label>
              <Select value={agForm.anfitriao_id} onValueChange={(v) => setAgForm({ ...agForm, anfitriao_id: v })}>
                <SelectTrigger><SelectValue placeholder="Quem vai conduzir" /></SelectTrigger>
                <SelectContent>
                  {(anfitrioes ?? []).filter((a) => a.ativo).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={agForm.tipo_id} onValueChange={(v) => setAgForm({ ...agForm, tipo_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(tipos ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data *</Label>
              <Input type="date" value={agForm.data} onChange={(e) => setAgForm({ ...agForm, data: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Horário *</Label>
              <Input type="time" value={agForm.hora_inicio} onChange={(e) => setAgForm({ ...agForm, hora_inicio: e.target.value })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Link da reunião</Label>
              <Input value={agForm.link_reuniao} onChange={(e) => setAgForm({ ...agForm, link_reuniao: e.target.value })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Observações</Label>
              <Textarea value={agForm.observacoes} onChange={(e) => setAgForm({ ...agForm, observacoes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAgendar(false)}>Cancelar</Button>
            <Button onClick={() => criarAgendamento.mutate()}>Agendar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!diaSelecionado} onOpenChange={(o) => !o && setDiaSelecionado(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Agendamentos de {diaSelecionado ? formatDate(diaSelecionado) : ""}
            </DialogTitle>
          </DialogHeader>
          <ul className="space-y-2">
            {itensDoDia.map((a) => (
              <li key={a.id} className="rounded-lg border border-border px-3 py-2 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {a.hora_inicio?.slice(0, 5)} às {a.hora_fim?.slice(0, 5)}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
                </div>
                <p className="text-sm">{a.nome}</p>
                {a.anfitriao_id && (
                  <p className="text-xs text-muted-foreground">Anfitrião: {nomeAnfitriao(a.anfitriao_id)}</p>
                )}
                {a.whatsapp && <p className="text-xs text-muted-foreground">{a.whatsapp}</p>}
                {a.instagram && <p className="text-xs text-muted-foreground">{a.instagram}</p>}
                {a.observacoes && <p className="text-xs text-muted-foreground">{a.observacoes}</p>}
                {a.link_reuniao && (
                  <a href={a.link_reuniao} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                    Abrir link da reunião
                  </a>
                )}
                <Select value={a.status} onValueChange={(v) => mudarStatus.mutate({ id: a.id, status: v })}>
                  <SelectTrigger className="h-7 w-40 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Pendente", "Confirmado", "Realizado", "Cancelado", "Não compareceu"].map((s) =>
                      <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <ReuniaoDetalhe
                  agendamentoId={a.id}
                  anfitriao={nomeAnfitriao(a.anfitriao_id)}
                  convidado={a.nome}
                  hora={a.hora_inicio?.slice(0, 5) ?? ""}
                  tipo={nomeTipo(a.tipo_id)}
                />
              </li>
            ))}
            {itensDoDia.length === 0 && (
              <li className="text-sm text-muted-foreground">Sem agendamentos neste dia.</li>
            )}
          </ul>
        </DialogContent>

      </Dialog>
    </div>

  );
}
