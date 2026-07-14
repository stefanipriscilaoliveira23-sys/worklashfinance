import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { Info } from "lucide-react";

export type FaturadoEntrada = {
  data: string;            // data em que o dinheiro entrou
  tipo: "receita" | "parcela";
  cliente: string | null;
  produto: string;
  valor: number;
  // extras para parcelas
  parcela_label?: string;   // ex: 3/16
  data_vencimento?: string; // vencimento original (para explicar "parcela antiga")
  contrato?: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  periodoLabel: string;
  entradas: FaturadoEntrada[];
}

export function FaturadoDetalheModal({ open, onClose, periodoLabel, entradas }: Props) {
  const receitasNovas = entradas.filter(e => e.tipo === "receita");
  const parcelasMesmoMes = entradas.filter(e => e.tipo === "parcela" && e.data_vencimento && e.data_vencimento.slice(0,7) === e.data.slice(0,7));
  const parcelasAntigas = entradas.filter(e => e.tipo === "parcela" && !(e.data_vencimento && e.data_vencimento.slice(0,7) === e.data.slice(0,7)));

  const totalReceitas = receitasNovas.reduce((s, e) => s + e.valor, 0);
  const totalParcMes = parcelasMesmoMes.reduce((s, e) => s + e.valor, 0);
  const totalParcAntigas = parcelasAntigas.reduce((s, e) => s + e.valor, 0);
  const total = totalReceitas + totalParcMes + totalParcAntigas;

  const ordenar = (arr: FaturadoEntrada[]) => [...arr].sort((a, b) => a.data.localeCompare(b.data));

  const Bloco = ({ titulo, cor, itens, total, descricao }: any) => (
    <div className={`rounded-lg border ${cor} p-4`}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
        <span className="text-sm font-bold text-primary">{formatCurrency(total)} · {itens.length} {itens.length === 1 ? "entrada" : "entradas"}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">{descricao}</p>
      {itens.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhuma entrada</p>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-1.5 pr-2">Data</th>
                <th className="text-left py-1.5 pr-2">Cliente</th>
                <th className="text-left py-1.5 pr-2">Produto / Parcela</th>
                <th className="text-right py-1.5">Valor</th>
              </tr>
            </thead>
            <tbody>
              {ordenar(itens).map((e: FaturadoEntrada, i: number) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="py-1.5 pr-2 whitespace-nowrap">{formatDate(e.data)}</td>
                  <td className="py-1.5 pr-2">{e.cliente || "—"}</td>
                  <td className="py-1.5 pr-2">
                    {e.produto}
                    {e.parcela_label && <span className="ml-1 text-primary">({e.parcela_label})</span>}
                    {e.tipo === "parcela" && e.data_vencimento && (
                      <span className="block text-[10px] text-muted-foreground">
                        {e.contrato ? `${e.contrato} · ` : ""}venc. {formatDate(e.data_vencimento)}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-right text-primary font-medium">{formatCurrency(e.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Detalhamento do Faturado — {periodoLabel}</DialogTitle>
          <DialogDescription className="text-xs">
            Todo dinheiro que efetivamente entrou no período, separado por origem.
            <span className="block mt-1"><strong className="text-foreground">Total: {formatCurrency(total)}</strong></span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-[11px] text-muted-foreground">
          <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <span>
            <strong className="text-foreground">Como calculamos:</strong> somamos as receitas (vendas novas) registradas no período
            + as parcelas de mentoria quitadas nesse mesmo período (contando pela data em que o pagamento foi recebido).
          </span>
        </div>

        <div className="space-y-3">
          <Bloco
            titulo="1. Vendas novas do período (entradas / à vista)"
            cor="border-primary/30 bg-primary/[0.03]"
            itens={receitasNovas}
            total={totalReceitas}
            descricao="Receitas registradas com data dentro do período — inclui vendas à vista e a entrada de contratos parcelados vendidos no mês."
          />
          <Bloco
            titulo="2. Parcelas do próprio mês pagas"
            cor="border-border bg-secondary/20"
            itens={parcelasMesmoMes}
            total={totalParcMes}
            descricao="Parcelas cujo vencimento é neste mês e foram quitadas dentro do período."
          />
          <Bloco
            titulo="3. Parcelas de meses anteriores pagas neste período"
            cor="border-border bg-secondary/20"
            itens={parcelasAntigas}
            total={totalParcAntigas}
            descricao="Parcelas com vencimento em meses anteriores que foram pagas dentro deste período (por isso entram no faturamento agora)."
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
