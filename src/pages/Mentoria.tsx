import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  STATUS_JORNADA, PROGRAMAS, CHECKLIST_ONBOARDING, CHECKINS_PADRAO,
  addDias, addMeses, diasRestantes,
} from "@/lib/mentoria";
import { notificarProprio } from "@/lib/notificacoes";
import MentoradaSheet from "@/components/mentoria/MentoradaSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { GraduationCap, Loader2, Plus, Search } from "lucide-react";

const COLUNAS = STATUS_JORNADA;

export default function Mentoria() {
  const qc = useQueryClient();
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [showNova, setShowNova] = useState(false);
  const [form, setForm] = useState({
    nome: "", email: "", telefone: "", instagram: "",
    programa: PROGRAMAS[0], prazo_meses: "3", data_inicio: "", valor_mentoria: "", vendedor: "",
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

  const criar = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Informe o nome da mentorada");
      const prazo = Number(form.prazo_meses) || 0;
      const inicio = form.data_inicio || null;
      const { data, error } = await supabase.from("mentoradas").insert({
        nome: form.nome.trim(),
        email: form.email || null,
        telefone: form.telefone || null,
        instagram: form.instagram || null,
        programa: form.programa,
        prazo_meses: prazo,
        data_inicio: inicio,
        data_termino: inicio ? addMeses(inicio, prazo) : null,
        valor_mentoria: Number(form.valor_mentoria) || 0,
        vendedor: form.vendedor || null,
        status_jornada: "Onboarding",
      }).select("id").single();
      if (error) throw error;

      await supabase.from("mentorada_tarefas").insert(
        CHECKLIST_ONBOARDING.map((t, i) => ({
          mentorada_id: data.id, titulo: t.titulo, categoria: t.categoria, ordem: i + 1,
        }))
      );
      if (inicio) {
        await supabase.from("mentorada_acompanhamentos").insert(
          CHECKINS_PADRAO.map((c) => ({
            mentorada_id: data.id, tipo: c.tipo, data_prevista: addDias(inicio, c.dias),
          }))
        );
      }
      await notificarProprio({
        titulo: "Nova mentorada cadastrada",
        descricao: `${form.nome.trim()} entrou no onboarding.`,
        tipo: "mentoria",
        link_interno: "/mentoria",
      });
      return data.id;
    },
    onSuccess: () => {
      setShowNova(false);
      setForm({ nome: "", email: "", telefone: "", instagram: "", programa: PROGRAMAS[0], prazo_meses: "3", data_inicio: "", valor_mentoria: "", vendedor: "" });
      qc.invalidateQueries({ queryKey: ["mentoradas"] });
      toast.success("Mentorada cadastrada com checklist de onboarding");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moverEtapa = useMutation({
    mutationFn: async ({ id, etapa }: { id: string; etapa: string }) => {
      const { error } = await supabase.from("mentoradas").update({ status_jornada: etapa }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mentoradas"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const filtradas = (mentoradas ?? []).filter((m) =>
    m.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const ativas = (mentoradas ?? []).filter((m) => !["Concluída", "Cancelada"].includes(m.status_jornada));
  const emRenovacao = (mentoradas ?? []).filter((m) => {
    const d = diasRestantes(m.data_termino);
    return d !== null && d <= 30 && d >= 0 && m.status_jornada !== "Cancelada";
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" /> Mentoria
          </h1>
          <p className="text-sm text-muted-foreground">Jornada das alunas, do onboarding à renovação.</p>
        </div>
        <Button onClick={() => setShowNova(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova mentorada
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card titulo="Mentoradas ativas" valor={String(ativas.length)} />
        <Card titulo="Renovação em até 30 dias" valor={String(emRenovacao.length)} />
        <Card titulo="Total cadastradas" valor={String((mentoradas ?? []).length)} />
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {COLUNAS.map((coluna) => {
            const itens = filtradas.filter((m) => m.status_jornada === coluna);
            return (
              <div key={coluna} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">{coluna}</p>
                  <Badge variant="secondary">{itens.length}</Badge>
                </div>
                <div className="space-y-2">
                  {itens.map((m) => {
                    const dias = diasRestantes(m.data_termino);
                    return (
                      <div key={m.id} className="rounded-lg border border-border p-3 hover:bg-surface-hover transition-colors">
                        <button className="text-left w-full" onClick={() => setSelecionada(m.id)}>
                          <p className="text-sm font-medium truncate">{m.nome}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{m.programa}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {m.data_termino ? `Termina em ${formatDate(m.data_termino)}` : "Sem data de término"}
                          </p>
                          {m.valor_mentoria ? (
                            <p className="text-[11px] font-medium mt-1">{formatCurrency(m.valor_mentoria)}</p>
                          ) : null}
                          {dias !== null && dias >= 0 && dias <= 30 && (
                            <Badge variant="outline" className="mt-1 text-[10px]">Renovar em {dias}d</Badge>
                          )}
                        </button>
                        <Select value={m.status_jornada} onValueChange={(v) => moverEtapa.mutate({ id: m.id, etapa: v })}>
                          <SelectTrigger className="h-7 mt-2 text-[11px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COLUNAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                  {itens.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma mentorada.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MentoradaSheet id={selecionada} onClose={() => setSelecionada(null)} />

      <Dialog open={showNova} onOpenChange={setShowNova}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova mentorada</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">E-mail</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Instagram</Label>
              <Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Programa</Label>
              <Select value={form.programa} onValueChange={(v) => setForm({ ...form, programa: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROGRAMAS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prazo (meses)</Label>
              <Input type="number" value={form.prazo_meses} onChange={(e) => setForm({ ...form, prazo_meses: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data de início</Label>
              <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor da mentoria</Label>
              <Input type="number" value={form.valor_mentoria} onChange={(e) => setForm({ ...form, valor_mentoria: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vendedor</Label>
              <Input value={form.vendedor} onChange={(e) => setForm({ ...form, vendedor: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNova(false)}>Cancelar</Button>
            <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
              {criar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Card({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="text-2xl font-bold mt-1">{valor}</p>
    </div>
  );
}
