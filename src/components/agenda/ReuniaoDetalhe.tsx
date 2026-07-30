import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  agendamentoId: string;
  anfitriao: string;
  convidado: string;
  hora: string;
  tipo: string;
};

export function montarMensagens(anfitriao: string, convidado: string, hora: string, tipo: string) {
  return {
    anfitriao: `Oi ${anfitriao || "[Anfitrião]"}! Passando para lembrar que hoje às ${hora} você tem uma ${tipo || "reunião"} com ${convidado}. Qualquer coisa me avisa. 💜`,
    convidado: `Oi ${convidado}! Tudo bem? Passando para confirmar nossa reunião de hoje às ${hora}. Você confirma para mim? 💜`,
  };
}

export default function ReuniaoDetalhe({ agendamentoId, anfitriao, convidado, hora, tipo }: Props) {
  const qc = useQueryClient();
  const base = montarMensagens(anfitriao, convidado, hora, tipo);
  const [msgAnfitriao, setMsgAnfitriao] = useState(base.anfitriao);
  const [msgConvidado, setMsgConvidado] = useState(base.convidado);

  useEffect(() => {
    const b = montarMensagens(anfitriao, convidado, hora, tipo);
    setMsgAnfitriao(b.anfitriao);
    setMsgConvidado(b.convidado);
  }, [anfitriao, convidado, hora, tipo]);

  const { data: tarefas } = useQuery({
    queryKey: ["agendamento-tarefas", agendamentoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("agendamento_tarefas").select("*")
        .eq("agendamento_id", agendamentoId).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const alternar = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const { error } = await supabase.from("agendamento_tarefas").update({ concluida }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agendamento-tarefas", agendamentoId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const copiar = (t: string) => { navigator.clipboard.writeText(t); toast.success("Mensagem copiada"); };

  return (
    <div className="space-y-3 pt-2">
      {(tarefas ?? []).length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Tarefas da reunião</Label>
          {(tarefas ?? []).map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={t.concluida} onCheckedChange={(v) => alternar.mutate({ id: t.id, concluida: !!v })} />
              <span className={t.concluida ? "line-through text-muted-foreground" : ""}>{t.titulo}</span>
            </label>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Mensagem para o anfitrião</Label>
        <Textarea rows={3} value={msgAnfitriao} onChange={(e) => setMsgAnfitriao(e.target.value)} />
        <Button size="sm" variant="outline" onClick={() => copiar(msgAnfitriao)}>
          <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Mensagem para o convidado</Label>
        <Textarea rows={3} value={msgConvidado} onChange={(e) => setMsgConvidado(e.target.value)} />
        <Button size="sm" variant="outline" onClick={() => copiar(msgConvidado)}>
          <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
        </Button>
      </div>
    </div>
  );
}
