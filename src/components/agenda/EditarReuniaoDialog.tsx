import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import RoteiroDaCall from "@/components/agenda/RoteiroDaCall";

const STATUS = ["Pendente", "Confirmado", "Realizado", "Cancelado", "Não compareceu"];

type Tipo = { id: string; nome: string; slug: string; roteiro?: unknown; sobre?: string | null };
type Anfitriao = { id: string; nome: string; ativo?: boolean };

export default function EditarReuniaoDialog({
  agendamento, tipos, anfitrioes, quemAgendou, open, onClose,
}: {
  agendamento: any | null;
  tipos: Tipo[];
  anfitrioes: Anfitriao[];
  quemAgendou: string;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<any>({});
  const [respostas, setRespostas] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!agendamento) return;
    setF({
      nome: agendamento.nome ?? "",
      whatsapp: agendamento.whatsapp ?? "",
      instagram: agendamento.instagram ?? "",
      data: agendamento.data ?? "",
      hora_inicio: (agendamento.hora_inicio ?? "").slice(0, 5),
      hora_fim: (agendamento.hora_fim ?? "").slice(0, 5),
      tipo_id: agendamento.tipo_id ?? "",
      anfitriao_id: agendamento.anfitriao_id ?? "",
      link_reuniao: agendamento.link_reuniao ?? "",
      status: agendamento.status ?? "Pendente",
      observacoes: agendamento.observacoes ?? "",
    });
    setRespostas((agendamento.respostas as Record<string, string>) ?? {});
  }, [agendamento]);

  const tipoDaCall = tipos.find((t) => t.id === f.tipo_id) ?? null;

  const salvar = useMutation({
    mutationFn: async () => {
      if (!f.nome?.trim()) throw new Error("O nome de quem vem na reunião não pode ficar vazio");
      if (!f.data) throw new Error("Escolha a data");
      if (!f.hora_inicio || !f.hora_fim) throw new Error("Preencha o horário de início e de fim");
      if (f.hora_fim <= f.hora_inicio) throw new Error("O horário de fim precisa ser depois do de início");

      const { error } = await supabase.from("agendamentos").update({
        nome: f.nome.trim(),
        whatsapp: f.whatsapp?.trim() || null,
        instagram: f.instagram?.trim() || null,
        data: f.data,
        hora_inicio: f.hora_inicio,
        hora_fim: f.hora_fim,
        tipo_id: f.tipo_id || null,
        anfitriao_id: f.anfitriao_id || null,
        link_reuniao: f.link_reuniao?.trim() || null,
        status: f.status,
        observacoes: f.observacoes?.trim() || null,
        respostas,
      }).eq("id", agendamento.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
      toast.success("Agendamento atualizado");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const responder = (chave: string, valor: string) =>
    setRespostas((r) => ({ ...r, [chave]: valor }));

  if (!agendamento) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar agendamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quem agendou: informação, não campo. Fica registrado de quem foi. */}
          <div className="rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
            Agendado por <span className="text-foreground">{quemAgendou}</span>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de call</Label>
            <Select value={f.tipo_id} onValueChange={(v) => setF({ ...f, tipo_id: v })}>
              <SelectTrigger><SelectValue placeholder="Escolha o tipo" /></SelectTrigger>
              <SelectContent>
                {tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Quem vem na reunião</Label>
              <Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <Input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Instagram</Label>
              <Input value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="time" value={f.hora_inicio} onChange={(e) => setF({ ...f, hora_inicio: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim</Label>
              <Input type="time" value={f.hora_fim} onChange={(e) => setF({ ...f, hora_fim: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Anfitrião</Label>
              <Select value={f.anfitriao_id} onValueChange={(v) => setF({ ...f, anfitriao_id: v })}>
                <SelectTrigger><SelectValue placeholder="Escolha o anfitrião" /></SelectTrigger>
                <SelectContent>
                  {anfitrioes.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Link da reunião</Label>
              <Input value={f.link_reuniao} onChange={(e) => setF({ ...f, link_reuniao: e.target.value })} />
            </div>
          </div>

          <RoteiroDaCall
            tipo={tipoDaCall}
            respostas={respostas}
            onChange={responder}
          />

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              rows={4}
              value={f.observacoes}
              onChange={(e) => setF({ ...f, observacoes: e.target.value })}
              placeholder="Qualquer coisa que não coube no roteiro."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
