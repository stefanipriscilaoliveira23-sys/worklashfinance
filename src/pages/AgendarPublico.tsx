import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays, CheckCircle2, Clock, Loader2 } from "lucide-react";

const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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

function toMin(t: string) {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}
function toHora(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export default function AgendarPublico() {
  const { slug } = useParams<{ slug: string }>();
  const [dataSel, setDataSel] = useState<string | null>(null);
  const [horaSel, setHoraSel] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  const { data: tipo, isLoading } = useQuery({
    queryKey: ["agendar-tipo", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_tipos").select("*").eq("slug", slug!).eq("ativo", true).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: janelas } = useQuery({
    queryKey: ["agendar-disp", tipo?.id],
    enabled: !!tipo?.id,
    queryFn: async () => {
      const { data } = await supabase.from("agenda_disponibilidade").select("*").eq("tipo_id", tipo!.id);
      return data ?? [];
    },
  });

  const { data: bloqueios } = useQuery({
    queryKey: ["agendar-bloqueios"],
    queryFn: async () => {
      const { data } = await supabase.from("agenda_bloqueios").select("*");
      return data ?? [];
    },
  });

  const { data: ocupados } = useQuery({
    queryKey: ["agendar-ocupados", dataSel],
    enabled: !!dataSel,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("agenda_slots_ocupados", { _data: dataSel! });
      if (error) throw error;
      return data ?? [];
    },
  });

  const dias = useMemo(() => {
    const diasComJanela = new Set((janelas ?? []).map((j) => j.dia_semana));
    return proximosDias(21).filter((d) => diasComJanela.has(new Date(d + "T00:00:00").getDay()));
  }, [janelas]);

  const horarios = useMemo(() => {
    if (!dataSel || !tipo) return [];
    const dow = new Date(dataSel + "T00:00:00").getDay();
    const dur = tipo.duracao_minutos ?? 60;
    const slots: string[] = [];
    for (const j of (janelas ?? []).filter((x) => x.dia_semana === dow)) {
      for (let t = toMin(j.hora_inicio); t + dur <= toMin(j.hora_fim); t += dur) {
        const inicio = t, fim = t + dur;
        const conflitoAgenda = (ocupados ?? []).some(
          (o: { hora_inicio: string; hora_fim: string }) => toMin(o.hora_inicio) < fim && toMin(o.hora_fim) > inicio
        );
        const conflitoBloqueio = (bloqueios ?? []).some((b) =>
          b.data === dataSel && (!b.hora_inicio || (toMin(b.hora_inicio) < fim && toMin(b.hora_fim ?? "23:59") > inicio))
        );
        if (!conflitoAgenda && !conflitoBloqueio) slots.push(toHora(inicio));
      }
    }
    return slots.sort();
  }, [dataSel, tipo, janelas, ocupados, bloqueios]);

  async function confirmar() {
    if (!nome.trim() || !whatsapp.trim()) return toast.error("Preencha nome e WhatsApp");
    if (!dataSel || !horaSel) return toast.error("Escolha data e horário");
    setEnviando(true);
    const { error } = await supabase.rpc("criar_agendamento_publico", {
      _slug: slug!, _nome: nome.trim(), _whatsapp: whatsapp.trim(),
      _instagram: instagram.trim() || "", _data: dataSel, _hora_inicio: horaSel,
    });
    setEnviando(false);
    if (error) return toast.error(error.message.includes("indisponivel") ? "Esse horário acabou de ser ocupado." : error.message);
    setConfirmado(true);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!tipo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <p className="text-center text-muted-foreground">Este link de agendamento não está disponível.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        {confirmado ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <h1 className="text-xl font-bold">Agendamento confirmado</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(dataSel + "T00:00:00").toLocaleDateString("pt-BR")} às {horaSel}. Enviaremos os detalhes no seu WhatsApp.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 space-y-6">
            <header className="space-y-1">
              <p className="inline-flex items-center gap-2 text-xs text-primary font-medium">
                <CalendarDays className="h-4 w-4" /> Agendamento
              </p>
              <h1 className="text-2xl font-bold">{tipo.titulo_pagina || tipo.nome}</h1>
              <p className="text-sm text-muted-foreground">
                {tipo.subtitulo_pagina || tipo.descricao || "Escolha o melhor dia e horário para você."}
              </p>
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                <Clock className="h-3.5 w-3.5" /> {tipo.duracao_minutos} minutos
              </p>
            </header>

            <div className="space-y-2">
              <Label className="text-xs">Escolha o dia</Label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {dias.map((d) => {
                  const dt = new Date(d + "T00:00:00");
                  const ativo = dataSel === d;
                  return (
                    <button key={d} onClick={() => { setDataSel(d); setHoraSel(null); }}
                      className={`shrink-0 w-16 rounded-xl border px-2 py-3 text-center transition-colors ${
                        ativo ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-surface-hover"
                      }`}>
                      <p className="text-[11px]">{DIAS_CURTOS[dt.getDay()]}</p>
                      <p className="text-lg font-semibold leading-tight">{dt.getDate()}</p>
                    </button>
                  );
                })}
                {dias.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma data disponível no momento.</p>
                )}
              </div>
            </div>

            {dataSel && (
              <div className="space-y-2">
                <Label className="text-xs">Horários disponíveis</Label>
                <div className="grid grid-cols-4 gap-2">
                  {horarios.map((h) => (
                    <button key={h} onClick={() => setHoraSel(h)}
                      className={`rounded-lg border px-2 py-2 text-sm transition-colors ${
                        horaSel === h ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-surface-hover"
                      }`}>
                      {h}
                    </button>
                  ))}
                </div>
                {horarios.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem horários livres nesse dia.</p>
                )}
              </div>
            )}

            {horaSel && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="space-y-1.5">
                  <Label className="text-xs">Seu nome *</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">WhatsApp *</Label>
                    <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Instagram</Label>
                    <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@seuperfil" />
                  </div>
                </div>
                <Button className="w-full" onClick={confirmar} disabled={enviando}>
                  {enviando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Confirmar agendamento
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
