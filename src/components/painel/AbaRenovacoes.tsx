import { useState } from "react";
import { CalendarClock, Clock, RefreshCw, Timer, TrendingDown, Users } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Cartao, Painel, Vazio } from "./Pecas";
import { valorVendido } from "@/hooks/usePainel";
import type { Painel as DadosPainel } from "@/hooks/usePainel";

function faltamDias(data: string): number {
  return Math.ceil((new Date(data + "T00:00:00").getTime() - Date.now()) / 86400000);
}

type Filtro = "todos" | "renovados" | "nao_renovados";

export default function AbaRenovacoes({ d }: { d: DadosPainel }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const r = d.renovacao;

  const valorRenovado = d.renovacoesMes.reduce((s, x) => s + valorVendido(x), 0);
  const agora = d.vencendoEm60.filter(x => faltamDias(x.data_fim_mentoria as string) <= 30);
  const fila = d.vencendoEm60.filter(x => faltamDias(x.data_fim_mentoria as string) > 30);
  const valorEmJogo = d.vencendoEm60.reduce((s, x) => s + valorVendido(x), 0);

  const esteira = r.esteira.filter(e => {
    if (filtro === "renovados") return e.renovado;
    if (filtro === "nao_renovados") return !e.renovado;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao
          titulo="Taxa de renovação (12 meses)"
          valor={`${r.taxaRenovacao12m.toFixed(0)}%`}
          detalhe={`${r.terminaram12m.filter(e => e.renovado).length} de ${r.terminaram12m.length} mentorias que terminaram`}
          icone={RefreshCw}
          tom={r.taxaRenovacao12m >= 50 ? "bom" : r.taxaRenovacao12m > 0 ? "normal" : "alerta"}
        />
        <Cartao
          titulo="Tempo para renovar"
          valor={`${r.tempoMedianoRenovar} dias`}
          detalhe={`média de ${r.tempoMedioRenovar.toFixed(0)} dias · negativo é renovar antes de terminar`}
          icone={Timer}
        />
        <Cartao
          titulo="Renovaram nos 12 meses"
          valor={String(r.renovados12m.length)}
          detalhe={formatCurrency(r.valorRenovado12m)}
          icone={Users}
          tom={r.renovados12m.length > 0 ? "bom" : "normal"}
        />
        <Cartao
          titulo="Terminaram e não renovaram"
          valor={String(r.jaVencidosSemRenovar.length)}
          detalhe={`${formatCurrency(r.valorPerdido)} em contratos que não voltaram`}
          icone={TrendingDown}
          tom={r.jaVencidosSemRenovar.length > 0 ? "alerta" : "normal"}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao
          titulo={`Renovações em ${d.rotuloMesAtual}`}
          valor={String(d.renovacoesMes.length)}
          detalhe={formatCurrency(valorRenovado)}
          icone={RefreshCw}
        />
        <Cartao
          titulo="Terminam em até 30 dias"
          valor={String(agora.length)}
          detalhe="precisam de conversa agora"
          icone={Clock}
          tom={agora.length > 0 ? "alerta" : "normal"}
        />
        <Cartao
          titulo="Terminam em 30 a 60 dias"
          valor={String(fila.length)}
          detalhe="entram na fila de renovação"
          icone={CalendarClock}
        />
        <Cartao
          titulo="Valor em jogo"
          valor={formatCurrency(valorEmJogo)}
          detalhe="contratos que vencem nos próximos 60 dias"
          icone={Users}
        />
      </div>

      <Painel titulo="Quem pode renovar: já terminou ou termina em até 60 dias">
        {r.elegiveis.length === 0 ? (
          <Vazio texto="Ninguém na janela de renovação." />
        ) : (
          <>
            <div className="space-y-1.5">
              {r.elegiveis.map(e => {
                const dias = e.fim ? faltamDias(e.fim) : null;
                const venceu = dias !== null && dias < 0;
                return (
                  <div key={e.id} className="flex items-center justify-between gap-3 border-b border-border/50 pb-1.5 text-xs last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{e.aluna}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {e.produto} · {e.categoria} · termina {formatDate(e.fim)} · {formatCurrency(e.valor)}
                      </p>
                    </div>
                    <span className={`shrink-0 font-medium ${venceu ? "text-destructive" : dias !== null && dias <= 7 ? "text-destructive" : "text-primary"}`}>
                      {dias === null ? "—" : venceu ? `venceu há ${Math.abs(dias)}d` : dias === 0 ? "hoje" : `${dias}d`}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              <span className="text-foreground">Elegível</span> é contrato que já terminou ou termina em
              até 60 dias e ainda não tem nenhuma renovação lançada para a mesma aluna. Nada a ver com
              estar devendo: quem deve aparece na aba Recebimentos.
            </p>
          </>
        )}
      </Painel>

      <Painel
        titulo="A esteira de renovação, contrato por contrato"
        acao={
          <div className="flex gap-1">
            {([["todos", "Todos"], ["renovados", "Renovaram"], ["nao_renovados", "Não renovaram"]] as [Filtro, string][]).map(([v, rot]) => (
              <button
                key={v}
                onClick={() => setFiltro(v)}
                className={`rounded-md px-2 py-1 text-[10px] transition-colors ${
                  filtro === v ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {rot}
              </button>
            ))}
          </div>
        }
      >
        {esteira.length === 0 ? (
          <Vazio texto="Nenhum contrato nesse filtro." />
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Aluna", "Mentoria", "Categoria", "Terminou", "Status", "Renovou em", "Valor", "Demorou", "Faltam"].map((h, i) => (
                    <th key={h} className={`p-2 text-xs font-medium text-muted-foreground ${i === 0 ? "text-left" : i >= 6 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {esteira.map(e => (
                  <tr key={e.id} className="border-b border-border/50">
                    <td className="p-2 font-medium text-foreground">
                      {e.aluna}
                      {e.ehRenovacao && <span className="ml-1 text-[9px] text-muted-foreground">(já é renovação)</span>}
                    </td>
                    <td className="p-2 text-muted-foreground">{e.produto}</td>
                    <td className="p-2 text-muted-foreground">{e.categoria}</td>
                    <td className="p-2 text-muted-foreground">{e.fim ? formatDate(e.fim) : "—"}</td>
                    <td className="p-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        e.renovado
                          ? "bg-emerald-500/15 text-emerald-500"
                          : e.fim && e.fim < d.hojeISO
                            ? "bg-destructive/15 text-destructive"
                            : "bg-secondary text-muted-foreground"
                      }`}>
                        {e.renovado ? "Renovou" : e.fim && e.fim < d.hojeISO ? "Não renovou" : "Em andamento"}
                      </span>
                    </td>
                    <td className="p-2 text-muted-foreground">{e.dataRenovacao ? formatDate(e.dataRenovacao) : "—"}</td>
                    <td className="p-2 text-right text-foreground">
                      {e.valorRenovacao > 0 ? formatCurrency(e.valorRenovacao) : "—"}
                    </td>
                    <td className="p-2 text-right">
                      {e.diasParaRenovar === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : e.diasParaRenovar <= 0 ? (
                        <span className="text-emerald-500">{Math.abs(e.diasParaRenovar)}d antes</span>
                      ) : (
                        <span className="text-muted-foreground">{e.diasParaRenovar}d depois</span>
                      )}
                    </td>
                    <td className="p-2 text-right text-muted-foreground">
                      {e.diasQueFaltam === null ? "—" : `${e.diasQueFaltam}d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          <span className="text-foreground">Demorou</span> conta do fim do contrato antigo até o começo
          da renovação. <span className="text-emerald-500">"antes"</span> é ótimo: ela renovou sem deixar
          a mentoria terminar. A regra de ligação é simples: um contrato conta como renovado quando
          existe, para a mesma aluna, um contrato posterior marcado como renovação.
        </p>
      </Painel>

      <Painel titulo={`Renovações fechadas em ${d.rotuloMesAtual}`}>
        {d.renovacoesMes.length === 0 ? (
          <Vazio texto="Nenhuma renovação fechada neste mês." />
        ) : (
          <div className="space-y-1.5">
            {d.renovacoesMes.map(x => (
              <div key={x.id} className="flex items-center justify-between gap-3 border-b border-border/50 pb-1.5 text-xs last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-foreground">{x.cliente_nome ?? "Sem nome"}</p>
                  <p className="text-[10px] text-muted-foreground">{x.produto_nome} · {formatDate(x.data)}</p>
                </div>
                <span className="shrink-0 font-medium text-emerald-500">{formatCurrency(valorVendido(x))}</span>
              </div>
            ))}
          </div>
        )}
      </Painel>

      <p className="px-1 text-[11px] text-muted-foreground">
        A gestão das alunas continua na aba <span className="text-foreground">Mentoria</span>. Aqui é só a
        leitura do dinheiro que está em risco de não voltar.
      </p>
    </div>
  );
}
