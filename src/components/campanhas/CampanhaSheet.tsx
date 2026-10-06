import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarPlus, CopyPlus, Loader2, Pause, Play, Plus, Trash2 } from "lucide-react";
import { MensagemCard } from "./MensagemCard";
import {
  BUCKET, Campanha, Grupo, Mensagem, STATUS_CAMPANHA, diferencaDias, hojeBR, ordenarMensagens, periodo,
  rotuloDia, rotuloPeriodo, somarDias,
} from "./shared";

type DadosCampanha = { oferta: string; descricao: string; data_inicio: string; data_fim: string; cor: string; status: string };

const CORES = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#0ea5e9", "#ef4444", "#930012", "#64748b"];

function CamposCampanha({ d, set }: { d: DadosCampanha; set: (p: Partial<DadosCampanha>) => void }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Oferta</Label>
        <Input value={d.oferta} placeholder="Ex.: Kit da Educadora" onChange={(e) => set({ oferta: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Descrição</Label>
        <Textarea rows={3} value={d.descricao} placeholder="Preço, condição, link, o que muda nessa campanha..." onChange={(e) => set({ descricao: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Início</Label>
          <Input type="date" value={d.data_inicio} onChange={(e) => set({ data_inicio: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Fim</Label>
          <Input type="date" value={d.data_fim} onChange={(e) => set({ data_fim: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Cor</Label>
        <div className="flex flex-wrap items-center gap-2">
          {CORES.map((c) => (
            <button key={c} type="button" onClick={() => set({ cor: c })} title={c}
              className={`h-7 w-7 rounded-full border-2 ${d.cor === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />
          ))}
          <Input type="color" value={d.cor} onChange={(e) => set({ cor: e.target.value })} className="h-8 w-12 cursor-pointer p-1" />
        </div>
      </div>
    </div>
  );
}

const paraForm = (c?: Campanha): DadosCampanha => ({
  oferta: c?.oferta ?? "", descricao: c?.descricao ?? "", data_inicio: c?.data_inicio ?? "", data_fim: c?.data_fim ?? "",
  cor: c?.cor ?? "#8b5cf6", status: c?.status ?? "rascunho",
});
const paraBanco = (d: DadosCampanha) => ({
  oferta: d.oferta.trim(), descricao: d.descricao.trim(), cor: d.cor, status: d.status,
  data_inicio: d.data_inicio || null, data_fim: d.data_fim || null,
});

/** Dialog de "Nova campanha". Devolve a campanha criada para a tela abrir em seguida. */
export function NovaCampanhaDialog({ open, onOpenChange, onCriada }: { open: boolean; onOpenChange: (o: boolean) => void; onCriada: (c: Campanha) => void }) {
  const qc = useQueryClient();
  const [d, setD] = useState<DadosCampanha>(paraForm());
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (open) setD(paraForm()); }, [open]);

  async function criar() {
    if (!d.oferta.trim()) return toast.error("Dê um nome para a oferta");
    if (d.data_inicio && d.data_fim && d.data_fim < d.data_inicio) return toast.error("O fim está antes do início");
    setSalvando(true);
    const { data, error } = await supabase.from("campanhas").insert(paraBanco(d)).select().single();
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success("Campanha criada");
    qc.invalidateQueries({ queryKey: ["campanhas"] });
    onOpenChange(false);
    onCriada(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova campanha</DialogTitle></DialogHeader>
        <CamposCampanha d={d} set={(p) => setD({ ...d, ...p })} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={criar} disabled={salvando}>{salvando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type SheetProps = {
  campanha: Campanha | null;
  onClose: () => void;
  onAbrirCampanha: (c: Campanha) => void;
  mensagens: Mensagem[];
  grupos: Grupo[];
  onNovaMensagem: (campanha_id: string, dia: string) => void;
  onAbrirMensagem: (m: Mensagem) => void;
};

/** Campanha aberta: dados da oferta, ações e a linha do tempo das mensagens dela. */
export function CampanhaSheet({ campanha, onClose, onAbrirCampanha, mensagens, grupos, onNovaMensagem, onAbrirMensagem }: SheetProps) {
  const qc = useQueryClient();
  const [d, setD] = useState<DadosCampanha>(paraForm());
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [duplicando, setDuplicando] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // só reinicia o formulário quando a campanha muda de verdade, não a cada recarga da lista
  useEffect(() => { if (campanha) setD(paraForm(campanha)); }, [campanha?.id, campanha?.atualizado_em]); // eslint-disable-line react-hooks/exhaustive-deps

  const msgs = campanha ? mensagens.filter((m) => m.campanha_id === campanha.id).sort(ordenarMensagens) : [];
  const porDia = new Map<string, Mensagem[]>();
  msgs.forEach((m) => porDia.set(m.dia, [...(porDia.get(m.dia) ?? []), m]));
  const hoje = hojeBR();
  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["campanhas"] });
    qc.invalidateQueries({ queryKey: ["campanha-mensagens"] });
  };

  if (!campanha) return <Sheet open={false} />;

  const mudou = JSON.stringify(paraForm(campanha)) !== JSON.stringify(d);
  const agendadas = msgs.filter((m) => m.status === "agendada").length;
  const pausadas = msgs.filter((m) => m.pausada).length;
  const pausada = campanha.status === "pausada";

  async function salvar() {
    if (!d.oferta.trim()) return toast.error("Dê um nome para a oferta");
    if (d.data_inicio && d.data_fim && d.data_fim < d.data_inicio) return toast.error("O fim está antes do início");
    setOcupado("salvar");
    const { data, error } = await supabase.from("campanhas").update(paraBanco(d)).eq("id", campanha!.id).select().single();
    setOcupado(null);
    if (error) return toast.error(error.message);
    toast.success("Campanha salva");
    atualizar();
    onAbrirCampanha(data);
  }

  async function pausarOuRetomar() {
    setOcupado("pausa");
    try {
      if (!pausada) {
        // agendada vira rascunho, marcada para o Retomar saber quais devolver
        const { error } = await supabase.from("campanha_mensagens").update({ status: "rascunho", pausada: true })
          .eq("campanha_id", campanha!.id).eq("status", "agendada");
        if (error) throw error;
        const { data, error: e2 } = await supabase.from("campanhas").update({ status: "pausada" }).eq("id", campanha!.id).select().single();
        if (e2) throw e2;
        toast.success(`Campanha pausada${agendadas ? `: ${agendadas} ${agendadas === 1 ? "mensagem voltou" : "mensagens voltaram"} para rascunho` : ""}`);
        onAbrirCampanha(data);
      } else {
        const { error } = await supabase.from("campanha_mensagens").update({ status: "agendada", pausada: false })
          .eq("campanha_id", campanha!.id).eq("pausada", true).eq("status", "rascunho");
        if (error) throw error;
        const novo = msgs.some((m) => m.status === "enviada") ? "em_andamento" : "agendada";
        const { data, error: e2 } = await supabase.from("campanhas").update({ status: novo }).eq("id", campanha!.id).select().single();
        if (e2) throw e2;
        toast.success(`Campanha retomada${pausadas ? `: ${pausadas} ${pausadas === 1 ? "mensagem agendada" : "mensagens agendadas"} de novo` : ""}`);
        onAbrirCampanha(data);
      }
      atualizar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  async function excluir() {
    setOcupado("excluir");
    const { error } = await supabase.from("campanhas").delete().eq("id", campanha!.id);
    if (error) { setOcupado(null); return toast.error(error.message); }
    // mídias da campanha no Storage (melhor esforço). Campanha duplicada aponta para os mesmos
    // arquivos, então só sai o que nenhuma outra campanha usa.
    const { data: arquivos } = await supabase.storage.from(BUCKET).list(campanha!.id, { limit: 1000 });
    const prefixo = supabase.storage.from(BUCKET).getPublicUrl("").data.publicUrl;
    const daCampanha = new Set([
      ...(arquivos ?? []).map((a) => `${campanha!.id}/${a.name}`),
      ...msgs.filter((m) => m.midia_url?.startsWith(prefixo)).map((m) => decodeURIComponent(m.midia_url!.slice(prefixo.length))),
    ]);
    const emUso = new Set(mensagens.filter((m) => m.campanha_id !== campanha!.id && m.midia_url).map((m) => m.midia_url));
    const sobra = [...daCampanha].filter((path) => !emUso.has(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl));
    if (sobra.length) await supabase.storage.from(BUCKET).remove(sobra);
    setOcupado(null);
    setExcluindo(false);
    toast.success("Campanha excluída");
    atualizar();
    onClose();
  }

  const { inicio, fim } = periodo(campanha, msgs);
  const proximoDia = msgs.length ? somarDias(msgs[msgs.length - 1].dia, 1) : campanha.data_inicio ?? hoje;

  return (
    <>
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 pr-6">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: campanha.cor }} />
              <span className="truncate">{campanha.oferta}</span>
              <Badge variant="outline" className={`text-[11px] ${STATUS_CAMPANHA[campanha.status]?.cor ?? ""}`}>
                {STATUS_CAMPANHA[campanha.status]?.rotulo ?? campanha.status}
              </Badge>
            </SheetTitle>
            <p className="text-left text-sm text-muted-foreground">{rotuloPeriodo(campanha, msgs)} · {msgs.length} {msgs.length === 1 ? "mensagem" : "mensagens"}</p>
          </SheetHeader>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setDuplicando(inicio ? somarDias(fim ?? inicio, 1) : hoje)}>
              <CopyPlus className="mr-1 h-4 w-4" /> Duplicar
            </Button>
            <Button size="sm" variant="outline" onClick={pausarOuRetomar} disabled={!!ocupado || (!pausada && agendadas === 0)}
              title={!pausada && agendadas === 0 ? "Não há mensagens agendadas para pausar" : undefined}>
              {ocupado === "pausa" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : pausada ? <Play className="mr-1 h-4 w-4" /> : <Pause className="mr-1 h-4 w-4" />}
              {pausada ? "Retomar" : "Pausar"}
            </Button>
            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setExcluindo(true)}>
              <Trash2 className="mr-1 h-4 w-4" /> Excluir
            </Button>
          </div>

          <div className="mt-5 space-y-3 rounded-xl border border-border bg-card p-4">
            <CamposCampanha d={d} set={(p) => setD({ ...d, ...p })} />
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={d.status} onValueChange={(v) => setD({ ...d, status: v })}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CAMPANHA).map(([k, s]) => <SelectItem key={k} value={k}>{s.rotulo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {mudou && (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setD(paraForm(campanha))}>Desfazer</Button>
                <Button size="sm" onClick={salvar} disabled={ocupado === "salvar"}>
                  {ocupado === "salvar" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Salvar dados
                </Button>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Linha do tempo</h3>
              <Button size="sm" variant="outline" onClick={() => onNovaMensagem(campanha.id, proximoDia)}>
                <CalendarPlus className="mr-1 h-4 w-4" /> Adicionar dia
              </Button>
            </div>
            {porDia.size === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda. Clique em Adicionar dia para escrever a primeira.</p>
            )}
            {[...porDia.entries()].map(([dia, lista]) => (
              <section key={dia} className="space-y-2">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  {rotuloDia(dia)}
                  {dia === hoje && <Badge className="text-[10px]">Hoje</Badge>}
                </h4>
                <div className="space-y-2">
                  {lista.map((m) => <MensagemCard key={m.id} m={m} grupos={grupos} onClick={() => onAbrirMensagem(m)} />)}
                </div>
                <Button size="sm" variant="ghost" className="h-8 text-primary" onClick={() => onNovaMensagem(campanha.id, dia)}>
                  <Plus className="mr-1 h-4 w-4" /> Adicionar mensagem
                </Button>
              </section>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <DuplicarDialog campanha={campanha} msgs={msgs} inicio={duplicando} onClose={() => setDuplicando(null)}
        onPronta={(c) => { setDuplicando(null); atualizar(); onAbrirCampanha(c); }} />

      <AlertDialog open={excluindo} onOpenChange={setExcluindo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{campanha.oferta}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Some a campanha, as {msgs.length} mensagens dela e as mídias que só ela usa. Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={(e) => { e.preventDefault(); excluir(); }} disabled={ocupado === "excluir"}>
              {ocupado === "excluir" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Copia a campanha e as mensagens, deslocando todas as datas para a nova data de início. Tudo nasce como rascunho. */
function DuplicarDialog({ campanha, msgs, inicio, onClose, onPronta }: {
  campanha: Campanha; msgs: Mensagem[]; inicio: string | null; onClose: () => void; onPronta: (c: Campanha) => void;
}) {
  const [novoInicio, setNovoInicio] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (inicio) setNovoInicio(inicio); }, [inicio]);

  const base = periodo(campanha, msgs).inicio;

  async function duplicar() {
    if (!novoInicio) return toast.error("Escolha a nova data de início");
    setSalvando(true);
    try {
      const desloca = base ? diferencaDias(base, novoInicio) : 0;
      const mover = (x: string | null) => (x ? somarDias(x, desloca) : null);
      const { data: nova, error } = await supabase.from("campanhas").insert({
        oferta: `${campanha.oferta} (cópia)`, descricao: campanha.descricao, cor: campanha.cor, status: "rascunho",
        data_inicio: campanha.data_inicio ? mover(campanha.data_inicio) : novoInicio,
        data_fim: mover(campanha.data_fim),
      }).select().single();
      if (error) throw error;
      if (msgs.length) {
        const { error: e2 } = await supabase.from("campanha_mensagens").insert(msgs.map((m) => ({
          campanha_id: nova.id, dia: mover(m.dia)!, hora: m.hora, ordem: m.ordem, titulo: m.titulo, texto: m.texto,
          midia_url: m.midia_url, midia_tipo: m.midia_tipo, grupos: m.grupos, contatos: m.contatos, status: "rascunho",
        })));
        if (e2) {
          await supabase.from("campanhas").delete().eq("id", nova.id);
          throw e2;
        }
      }
      toast.success(`Campanha duplicada com ${msgs.length} ${msgs.length === 1 ? "mensagem" : "mensagens"} em rascunho`);
      onPronta(nova);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={!!inicio} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Duplicar campanha</DialogTitle>
          <DialogDescription>
            Cria uma cópia de "{campanha.oferta}" com todas as mensagens. As datas andam juntas a partir da nova data de início, e tudo entra como rascunho.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Nova data de início</Label>
          <Input type="date" value={novoInicio} onChange={(e) => setNovoInicio(e.target.value)} />
          {base && novoInicio && (
            <p className="text-xs text-muted-foreground">
              O primeiro dia ({rotuloDia(base)}) vira {rotuloDia(novoInicio)}.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={duplicar} disabled={salvando}>{salvando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Duplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
