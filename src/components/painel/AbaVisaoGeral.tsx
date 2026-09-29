import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, CalendarClock, Clock, Coins, Flame, PiggyBank,
  Receipt, ShoppingCart, Target, TrendingUp, Wallet,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Barra, Cartao, CartaoBrutoLiquido, Comparacao, Painel, Vazio } from "./Pecas";
import type { Painel as DadosPainel } from "@/hooks/usePainel";

export default function AbaVisaoGeral({ d }: { d: DadosPainel }) {
  const navegar = useNavigate();
  const m = d.mesAtual;

  return (
    <div className="space-y-4">
      {/* Os quatro números que respondem "como foi o mês" */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao
          titulo="Vendas novas do mês"
          valor={formatCurrency(m.vendasBruto)}
          detalhe={`${m.vendasQtd} ${m.vendasQtd === 1 ? "venda" : "vendas"} fechadas`}
          icone={ShoppingCart}
          aoClicar={() => navegar("/receitas")}
        >
          <Comparacao agora={m.vendasBruto} antes={d.mesPassadoAteAqui.vendasBruto} legenda={`vs ${d.rotuloMesAnterior} até aqui`} />
        </Cartao>

        <Cartao
          titulo="Parcelas recebidas no mês"
          valor={formatCurrency(m.parcelasValor)}
          detalhe={`${m.parcelasQtd} ${m.parcelasQtd === 1 ? "parcela paga" : "parcelas pagas"}`}
          icone={Receipt}
          aoClicar={() => navegar("/parcelas")}
        >
          <Comparacao agora={m.parcelasValor} antes={d.mesPassadoAteAqui.parcelasValor} legenda={`vs ${d.rotuloMesAnterior} até aqui`} />
        </Cartao>

        <Cartao
          titulo="Total vendido no mês"
          valor={formatCurrency(m.vendido)}
          detalhe="contratos fechados, inclusive o que ainda vai ser parcelado"
          icone={TrendingUp}
        >
          <Comparacao agora={m.vendido} antes={d.mesPassadoAteAqui.vendido} legenda={`vs ${d.rotuloMesAnterior} até aqui`} />
        </Cartao>

        <CartaoBrutoLiquido
          titulo="Total recebido no mês"
          bruto={m.recebidoBruto}
          liquido={m.recebidoLiquido}
          detalhe="entradas, vendas à vista e parcelas pagas"
          icone={Wallet}
        />
      </div>

      {/* Meta, ritmo e projeção */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Meta de {d.rotuloMesAtual}</h3>
            <span className="text-xs text-muted-foreground">
              {d.metaValor > 0 ? formatCurrency(d.metaValor) : "sem meta definida"}
            </span>
          </div>

          {d.metaValor > 0 ? (
            <>
              <div className="mb-2 h-3 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full transition-all ${d.metaPercent >= 100 ? "bg-emerald-500" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, d.metaPercent)}%` }}
                />
              </div>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="text-2xl font-bold text-foreground">{d.metaPercent.toFixed(0)}%</span>
                <span className="text-xs text-muted-foreground">
                  {d.metaFalta > 0
                    ? <>faltam <span className="font-medium text-foreground">{formatCurrency(d.metaFalta)}</span></>
                    : <span className="font-medium text-emerald-500">meta batida</span>}
                </span>
                {d.ehMesCorrente && d.metaFalta > 0 && d.diasRestantes > 0 && (
                  <span className="text-xs text-muted-foreground">
                    · {formatCurrency(d.precisaPorDia)} por dia nos {d.diasRestantes} dias que faltam
                  </span>
                )}
              </div>
            </>
          ) : (
            <Vazio texto="Defina a meta do mês para acompanhar o quanto falta." />
          )}
        </div>

        <Cartao
          titulo={d.ehMesCorrente ? "No ritmo de hoje, fecha em" : "Fechou em"}
          valor={formatCurrency(d.projecaoFimDoMes)}
          detalhe={
            d.ehMesCorrente
              ? `entrando ${formatCurrency(d.ritmoDiario)} por dia desde o dia 1`
              : "mês já encerrado"
          }
          icone={Target}
          tom={d.metaValor > 0 && d.projecaoFimDoMes >= d.metaValor ? "bom" : "normal"}
        />
      </div>

      {/* O que precisa de atenção hoje */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao
          titulo="Já contratado a receber"
          valor={formatCurrency(d.carteiraFutura)}
          detalhe={`${d.aVencer.length} parcelas de todos os contratos, não só deste mês`}
          icone={PiggyBank}
          tom="bom"
          aoClicar={() => navegar("/parcelas")}
        />
        <Cartao
          titulo="Em atraso"
          valor={formatCurrency(d.emAtrasoValor)}
          detalhe={`${d.alunasEmAtraso} ${d.alunasEmAtraso === 1 ? "aluna" : "alunas"} · ${d.vencidas.length} parcelas`}
          icone={AlertTriangle}
          tom={d.emAtrasoValor > 0 ? "alerta" : "normal"}
          aoClicar={() => navegar("/parcelas")}
        />
        <Cartao
          titulo="Contas do mês a pagar"
          valor={formatCurrency(d.aPagarEmpresa)}
          detalhe={`${d.atrasadasEmpresa.length} em atraso · ${d.venceHoje.length} vencendo hoje`}
          icone={CalendarClock}
          tom={d.atrasadasEmpresa.length > 0 ? "alerta" : "normal"}
          aoClicar={() => navegar("/despesas-empresa")}
        />
        <Cartao
          titulo="Sobrou de verdade"
          valor={formatCurrency(d.sobrouDeVerdade)}
          detalhe={`depois da empresa E da sua retirada · margem real de ${d.margemReal.toFixed(0)}%`}
          icone={Coins}
          tom={d.sobrouDeVerdade >= 0 ? "bom" : "alerta"}
          aoClicar={() => navegar("/despesas-pessoal")}
        />
      </div>

      {/* A conta inteira, para ninguém achar que sobrou o que já foi gasto */}
      <Painel titulo="Do que entrou até o que realmente sobrou">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Etapa rotulo="Entrou líquido" valor={d.mesAtual.recebidoLiquido} cor="text-foreground" />
          <Etapa rotulo="− Custos para operar" valor={d.custosOperacionais} cor="text-destructive"
                 detalhe="empresa, sem o pró-labore" />
          <Etapa rotulo="− Sua vida inteira" valor={d.gastoPessoal} cor="text-destructive"
                 detalhe={`é o pró-labore · ${d.pesoDaRetirada.toFixed(0)}% do que entrou`} />
          <Etapa rotulo="= Sobrou de verdade" valor={d.sobrouDeVerdade}
                 cor={d.sobrouDeVerdade >= 0 ? "text-emerald-500" : "text-destructive"} destaque
                 detalhe={`margem real de ${d.margemReal.toFixed(0)}%`} />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          O pró-labore não entra nesta conta porque ele não é gasto novo: é o caminho do dinheiro da
          empresa até você. O que gasta de verdade é a sua vida. Na aba{" "}
          <span className="text-foreground">Despesas e resultado</span> as duas contas aparecem separadas.
        </p>
      </Painel>

      {/* Ponto de equilíbrio e dependência: duas leituras que ela não tinha */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Painel titulo="Ponto de equilíbrio do mês">
          {d.totalEmpresa <= 0 ? (
            <Vazio texto="Nenhuma conta da empresa lançada neste mês." />
          ) : d.faltaParaEmpatar <= 0 ? (
            <div className="flex items-start gap-3">
              <Flame className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <div>
                <p className="text-sm font-medium text-emerald-500">
                  As contas do mês já estão pagas pelo que entrou.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {d.diaDoEquilibrio
                    ? <>Você virou o jogo no dia <span className="font-medium text-foreground">{formatDate(d.diaDoEquilibrio)}</span>. Tudo que entrou depois disso é lucro.</>
                    : <>Tudo que entrar daqui pra frente é lucro.</>}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Sobra hoje: <span className="font-medium text-emerald-500">{formatCurrency(d.resultado)}</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <Flame className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm text-foreground">
                  Faltam <span className="font-bold text-primary">{formatCurrency(d.faltaParaEmpatar)}</span> para pagar as contas do mês.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  No seu ticket médio de {formatCurrency(d.ticketMedio)}, isso é cerca de{" "}
                  <span className="font-medium text-foreground">
                    {d.vendasParaEmpatar} {d.vendasParaEmpatar === 1 ? "venda" : "vendas"}
                  </span>.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Contas do mês: {formatCurrency(d.totalEmpresa)} · já entrou: {formatCurrency(d.mesAtual.recebidoLiquido)}
                </p>
              </div>
            </div>
          )}
        </Painel>

        <Painel titulo="De quem e de quê o seu faturamento depende">
          <div className="space-y-4">
            {/* Por serviço: é o que mais explica o faturamento */}
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Por serviço · 12 meses
              </p>
              {d.servicos12m.length === 0 ? (
                <Vazio texto="Sem dados dos últimos 12 meses." />
              ) : (
                <>
                  <p className="mb-2 text-xs text-muted-foreground">
                    {d.servicos12m[0].nome} sozinho traz{" "}
                    <span className={`font-bold ${d.servicos12m[0].pct > 50 ? "text-destructive" : "text-primary"}`}>
                      {d.servicos12m[0].pct.toFixed(0)}%
                    </span>{" "}
                    do que entra.
                    {d.servicos12m[0].pct > 50 && " O negócio está em cima de um produto só."}
                  </p>
                  <div className="space-y-2">
                    {d.servicos12m.slice(0, 5).map(sv => (
                      <div key={sv.nome}>
                        <div className="mb-0.5 flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-foreground">{sv.nome}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {formatCurrency(sv.recebido)}
                            <span className="ml-2 text-primary">{sv.pct.toFixed(0)}%</span>
                          </span>
                        </div>
                        <Barra valor={sv.recebido} maximo={d.servicos12m[0].recebido} />
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {sv.clientes} {sv.clientes === 1 ? "cliente" : "clientes"}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Por cliente, mas só quem ainda está sendo atendida */}
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Clientes com entrega ativa agora
              </p>
              {d.top5Ativos.length === 0 ? (
                <Vazio texto="Nenhuma cliente com mentoria ou consultoria em andamento." />
              ) : (
                <>
                  <p className="mb-2 text-xs text-muted-foreground">
                    São <span className="font-medium text-foreground">{d.clientesAtivos.length}</span> em
                    andamento. As 5 maiores respondem por{" "}
                    <span className={`font-bold ${d.concentracaoAtivos > 50 ? "text-destructive" : "text-primary"}`}>
                      {d.concentracaoAtivos.toFixed(0)}%
                    </span>{" "}
                    do dinheiro dessa carteira.
                  </p>
                  <div className="space-y-1.5">
                    {d.top5Ativos.map(c => (
                      <div key={c.nome} className="flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="truncate text-foreground">{c.nome}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {c.servico}
                            {c.termina && <> · até {formatDate(c.termina)}</>}
                            {c.aReceber > 0 && <> · falta pagar {formatCurrency(c.aReceber)}</>}
                          </p>
                        </div>
                        <span className="shrink-0 text-muted-foreground">
                          {formatCurrency(c.peso)}
                          <span className="ml-2 text-primary">
                            {d.totalAtivos > 0 ? ((c.peso / d.totalAtivos) * 100).toFixed(0) : "0"}%
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Quem já terminou não entra: ela não é risco de perder, já foi. O risco está em quem
                    ainda está sendo atendida e ainda tem parcela para pagar.
                  </p>
                </>
              )}
            </div>
          </div>
        </Painel>
      </div>

      {/* Conta vencendo hoje: o que ela pediu para ver sem precisar procurar */}
      {d.venceHoje.length > 0 && (
        <Painel titulo="Vencendo hoje">
          <div className="space-y-1.5">
            {d.venceHoje.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-3 border-b border-border/50 pb-1.5 text-xs last:border-0">
                <span className="flex items-center gap-2 truncate text-foreground">
                  <Clock className="h-3 w-3 shrink-0 text-destructive" />
                  {c.descricao}
                </span>
                <span className="shrink-0 font-medium text-destructive">
                  {formatCurrency(c.saldo_pendente ?? c.valor_original ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </Painel>
      )}
    </div>
  );
}

function Etapa({
  rotulo, valor, cor, detalhe, destaque,
}: { rotulo: string; valor: number; cor: string; detalhe?: string; destaque?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${destaque ? "border-primary/50 bg-primary/5" : "border-border bg-secondary/30"}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{rotulo}</p>
      <p className={`text-base font-bold ${cor}`}>{formatCurrency(valor)}</p>
      {detalhe && <p className="text-[10px] text-muted-foreground">{detalhe}</p>}
    </div>
  );
}
