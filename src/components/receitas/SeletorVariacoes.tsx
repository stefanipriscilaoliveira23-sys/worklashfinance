import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  variacoesVisiveis,
  type ComVariacoes,
  type Escolhas,
} from "@/lib/variacoes";

export function SeletorVariacoes({
  produto,
  escolhas,
  onChange,
}: {
  produto: ComVariacoes;
  escolhas: Escolhas;
  onChange: (e: Escolhas) => void;
}) {
  const visiveis = variacoesVisiveis(produto, escolhas);
  if (!visiveis.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {visiveis.map((v) => (
        <div key={v.nome} className="space-y-1">
          <Label className="text-xs text-muted-foreground">{v.nome} *</Label>
          <Select
            value={escolhas[v.nome] ?? ""}
            onValueChange={(valor) => onChange({ ...escolhas, [v.nome]: valor })}
          >
            <SelectTrigger className="bg-secondary/50 border-border">
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent>
              {v.opcoes.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}
