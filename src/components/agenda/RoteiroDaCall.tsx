import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { perguntasDoTipo, sobreDoTipo, type TipoDeCall } from "@/lib/roteirosCall";

/**
 * As perguntas da call, que mudam conforme o tipo escolhido.
 * Usado nos dois lugares: na hora de agendar e na hora de editar, pra não
 * existirem duas versões das mesmas perguntas.
 *
 * Recebe o TIPO inteiro, não só o slug, porque o roteiro hoje vem gravado em
 * `agenda_tipos.roteiro` — o mesmo que o CRM lê pra montar a janela dele.
 */
export default function RoteiroDaCall({
  tipo, respostas, onChange,
}: {
  tipo: TipoDeCall | null | undefined;
  respostas: Record<string, string>;
  onChange: (chave: string, valor: string) => void;
}) {
  const perguntas = perguntasDoTipo(tipo);
  const sobre = sobreDoTipo(tipo);
  if (!perguntas.length) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-medium">Roteiro da call</p>
        {sobre && <p className="text-xs text-muted-foreground">{sobre}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          Pode preencher agora, durante ou depois. Nada é obrigatório.
        </p>
      </div>

      {perguntas.map((p) => (
        <div key={p.chave} className="space-y-1.5">
          <Label className="text-xs">{p.label}</Label>

          {p.tipo === "texto" && (
            <Textarea rows={2} value={respostas[p.chave] ?? ""}
              onChange={(e) => onChange(p.chave, e.target.value)} />
          )}

          {p.tipo === "data" && (
            <Input type="date" value={respostas[p.chave] ?? ""}
              onChange={(e) => onChange(p.chave, e.target.value)} />
          )}

          {p.tipo === "dinheiro" && (
            <Input value={respostas[p.chave] ?? ""} placeholder="ex.: entre 5 e 6 mil"
              onChange={(e) => onChange(p.chave, e.target.value)} />
          )}

          {p.tipo === "sim_nao" && (
            <Select value={respostas[p.chave] ?? ""} onValueChange={(v) => onChange(p.chave, v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Sim">Sim</SelectItem>
                <SelectItem value="Não">Não</SelectItem>
                <SelectItem value="Não perguntei">Não perguntei</SelectItem>
              </SelectContent>
            </Select>
          )}

          {p.dica && <p className="text-[11px] text-muted-foreground">{p.dica}</p>}
        </div>
      ))}
    </div>
  );
}
