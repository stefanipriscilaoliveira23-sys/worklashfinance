import { useNavigate } from "react-router-dom";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowDownRight, Coins, Flame, Home, Repeat, Wallet } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Barra, Cartao, Painel, Vazio, estiloTooltip } from "./Pecas";
import type { Painel as DadosPainel } from "@/hooks/usePainel";

const eixo = { fontSize: 10, fill: "hsl(0 0% 55%)" };
const emK = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v));

export default function AbaDespesas({ d }: { d: DadosPainel }) {
  const navegar = useNavigate();
  const custoPorDia = d.mes.diasNoMes > 0 ? d.fixasEmpresa / d.mes.diasNoMes : 0;
  const maiorSaida = d.saidasDaEmpresa[0]?.valor ?? 0;
  const maiorPessoal = d.categoriasPessoal[0]?.valor ?? 0;

  return (
    <div className="space-y-4">
      {/* Duas contas separadas: a da empresa e a sua. É isso que dá clareza. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Painel titulo="A conta da EMPRESA">
          <div className="space-y-2.5">
            <Linha rotulo="Entrou líquido" valor={d.mesAtual.recebidoLiquido} cor="text-foreground" negrito />
            <Linha
              rotulo="Custos para operar"
              valor={-d.custosOperacionais}
              cor="text-destructive"
              detalhe="salários, plataformas, tráfego, aluguel"
            />
            <Linha
              rotulo="Pró-labore que saiu pra você"
              valor={-d.proLaboreLancado}
              cor="text-destructive"
              detalhe={d.proLaboreLancado > 0
                ? `${d.pesoDaRetirada.toFixed(0)}% de tudo que entrou`
                : "não lançado neste mês"}
            />
            <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/50 bg-primary/5 p-3">
              <div>
                <p className="text-sm font-bold text-foreground">Ficou na empresa</p>
                <p className="text-[10px] text-muted-foreground">
                  lucro do negócio · margem de {d.margemEmpresa.toFixed(0)}%
                </p>
              </div>
              <span className={`shrink-0 text-xl font-bold ${d.resultadoEmpresa >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                {formatCurrency(d.resultadoEmpresa)}
              </span>
            </div>
          </div>
        </Painel>

        <Painel titulo="A conta da SUA VIDA">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/50 bg-primary/5 p-3">
            <div>
              <p className="text-sm font-bold text-foreground">Você retirou da empresa</p>
              <p className="text-[10px] text-muted-foreground">
                é tudo que gastou no mês · {d.pesoDaRetirada.toFixed(0)}% de tudo que entrou
              </p>
            </div>
            <span className="shrink-0 text-xl font-bold text-primary">
              {formatCurrency(d.gastoPessoal)}
            </span>
          </div>

          <p className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Para onde foi
          </p>
          <div className="space-y-3">
            <Fatia
              rotulo="Contas fixas"
              valor={d.pessoalFixas}
              pago={d.pessoalFixasPago}
              total={d.gastoPessoal}
              detalhe="aluguel, financiamento, casa, transporte, parcelado"
              cor="#C9A84C"
            />
            <Fatia
              rotulo="Gasto do dia a dia"
              valor={d.pessoalVariaveis}
              pago={d.pessoalVariaveisPago}
              total={d.gastoPessoal}
              detalhe="mercado, lazer, farmácia, o que não repete"
              cor="#c2410c"
            />
          </div>

          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Somando as duas
            </p>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Já pago</span>
              <span className="font-medium text-foreground">{formatCurrency(d.pessoalPago)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Ainda em aberto</span>
              <span className={`font-medium ${d.pessoalEmAberto > 0 ? "text-destructive" : "text-foreground"}`}>
                {formatCurrency(d.pessoalEmAberto)}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              O pró-labore lançado na empresa é exatamente este valor de{" "}
              {formatCurrency(d.gastoPessoal)}. Ele se atualiza sozinho: toda vez que você lança
              uma despesa pessoal, o pró-labore do mês acompanha.
            </p>
          </div>
        </Painel>
      </div>

      <Painel titulo="Juntando as duas contas">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Etapa rotulo="Entrou líquido" valor={d.mesAtual.recebidoLiquido} cor="text-foreground" />
          <Etapa rotulo="− Custos para operar" valor={d.custosOperacionais} cor="text-destructive" />
          <Etapa rotulo="− Sua vida inteira" valor={d.gastoPessoal} cor="text-destructive"
                 detalhe="fixo + variável" />
          <Etapa rotulo="= Sobrou de verdade" valor={d.sobrouDeVerdade}
                 cor={d.sobrouDeVerdade >= 0 ? "text-emerald-500" : "text-destructive"} destaque
                 detalhe={`margem real de ${d.margemReal.toFixed(0)}%`} />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Aqui o pró-labore sai da conta de propósito: ele não é um gasto novo, é o caminho do
          dinheiro da empresa até você. O que gasta de verdade é a sua vida.
        </p>
      </Painel>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao
          titulo="Custos para operar"
          valor={formatCurrency(d.custosOperacionais)}
          detalhe={`${formatCurrency(d.pagoEmpresa)} pago · ${formatCurrency(d.aPagarEmpresa)} em aberto`}
          icone={Wallet}
          aoClicar={() => navegar("/despesas-empresa")}
        />
        <Cartao
          titulo="Pró-labore (o que você tirou)"
          valor={formatCurrency(d.proLaboreLancado)}
          detalhe={d.proLaboreLancado > 0
            ? `${formatCurrency(d.pessoalFixas)} fixas + ${formatCurrency(d.pessoalVariaveis)} do dia a dia`
            : "não lançado neste mês"}
          icone={Home}
          tom={d.pesoDaRetirada > 50 ? "alerta" : "normal"}
          aoClicar={() => navegar("/despesas-pessoal")}
        />
        <Cartao
          titulo="Custo fixo por dia"
          valor={formatCurrency(custoPorDia)}
          detalhe={`${formatCurrency(d.fixasEmpresa)} de fixo no mês`}
          icone={Flame}
        />
        <Cartao
          titulo="Sobrou de verdade"
          valor={formatCurrency(d.sobrouDeVerdade)}
          detalhe={`margem real de ${d.margemReal.toFixed(0)}%`}
          icone={Coins}
          tom={d.sobrouDeVerdade >= 0 ? "bom" : "alerta"}
        />
      </div>

      {d.atrasadasEmpresa.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-medium text-destructive">
              {d.atrasadasEmpresa.length} {d.atrasadasEmpresa.length === 1 ? "conta atrasada" : "contas atrasadas"}
            </h3>
          </div>
          <div className="space-y-1.5">
            {d.atrasadasEmpresa.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-3 border-b border-destructive/20 pb-1.5 text-xs last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-foreground">{c.descricao}</p>
                  <p className="text-[10px] text-muted-foreground">venceu {formatDate(c.data_vencimento)}</p>
                </div>
                <span className="shrink-0 font-medium text-destructive">
                  {formatCurrency(c.saldo_pendente ?? c.valor_original ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Painel titulo="Entrou contra saiu, mês a mês">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={d.historico}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="rotulo" tick={eixo} />
            <YAxis tick={eixo} tickFormatter={emK} />
            <Tooltip
              contentStyle={estiloTooltip}
              formatter={(v: number, n: string) => [formatCurrency(v), NOMES[n] ?? n]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => NOMES[v] ?? v} />
            <Bar dataKey="recebido" fill="#C9A84C" radius={[3, 3, 0, 0]} />
            <Bar dataKey="despesas" stackId="saiu" fill="#7f1d1d" />
            <Bar dataKey="pessoal" stackId="saiu" fill="#c2410c" radius={[3, 3, 0, 0]} />
            <Line type="monotone" dataKey="sobrouDeVerdade" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          A barra de saída tem duas cores: vinho é custo para operar a empresa, laranja é a sua vida
          inteira. O pró-labore não aparece como barra porque ele já está dentro do laranja, e contar
          os dois faria o mesmo dinheiro sair duas vezes. A linha verde é o que sobrou.
        </p>
      </Painel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Painel titulo="Para onde o dinheiro da empresa está indo">
          {d.saidasDaEmpresa.length === 0 ? (
            <Vazio texto="Nenhuma saída lançada neste mês." />
          ) : (
            <>
              <div className="space-y-3">
                {d.saidasDaEmpresa.slice(0, 12).map(c => (
                  <div key={c.nome}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className={`truncate ${c.ehRetirada ? "font-medium text-primary" : "text-foreground"}`}>
                        {c.nome}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        <span className="font-medium text-foreground">{formatCurrency(c.valor)}</span>
                        {d.totalSaidas > 0 && (
                          <span className="ml-2 text-primary">{((c.valor / d.totalSaidas) * 100).toFixed(0)}%</span>
                        )}
                      </span>
                    </div>
                    <Barra valor={c.valor} maximo={maiorSaida} />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Total que saiu: <span className="font-medium text-foreground">{formatCurrency(d.totalSaidas)}</span>.
                A sua retirada aparece aqui como pró-labore, porque para a empresa é saída igual às outras.
              </p>
            </>
          )}
        </Painel>

        <Painel titulo={`Onde foi o seu dinheiro em ${d.rotuloMesAtual}`}>
          {d.categoriasPessoal.length === 0 ? (
            <Vazio texto="Nenhuma despesa pessoal lançada neste mês." />
          ) : (
            <>
              <div className="space-y-3">
                {d.categoriasPessoal.slice(0, 12).map(c => (
                  <div key={c.nome}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-foreground">{c.nome}</span>
                      <span className="shrink-0 text-muted-foreground">
                        <span className="font-medium text-foreground">{formatCurrency(c.valor)}</span>
                        {d.retiradaSocios > 0 && (
                          <span className="ml-2 text-primary">{((c.valor / d.retiradaSocios) * 100).toFixed(0)}%</span>
                        )}
                      </span>
                    </div>
                    <Barra valor={c.valor} maximo={maiorPessoal} />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Total da vida pessoal: <span className="font-medium text-foreground">{formatCurrency(d.gastoPessoal)}</span>
                {" "}· deu <span className="font-medium text-foreground">{formatCurrency(d.gastoPessoal / d.mes.diasNoMes)}</span> por dia.
              </p>
            </>
          )}
        </Painel>
      </div>

      <Painel titulo="Quanto o mês precisa render para se pagar">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <p className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Repeat className="h-3.5 w-3.5 text-primary" />
              Só para pagar a empresa
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Custos: <span className="font-medium text-foreground">{formatCurrency(d.custosEmpresa)}</span>
              {" "}· já entrou: <span className="font-medium text-foreground">{formatCurrency(d.mesAtual.recebidoLiquido)}</span>
            </p>
            <p className="mt-2 text-sm">
              {d.faltaParaEmpatar > 0 ? (
                <>Faltam <span className="font-bold text-primary">{formatCurrency(d.faltaParaEmpatar)}</span></>
              ) : (
                <span className="font-bold text-emerald-500">A empresa já se pagou.</span>
              )}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <p className="flex items-center gap-2 text-xs font-medium text-foreground">
              <ArrowDownRight className="h-3.5 w-3.5 text-primary" />
              Para pagar a empresa e a sua vida
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Empresa + retirada: <span className="font-medium text-foreground">{formatCurrency(d.totalSaidas)}</span>
            </p>
            <p className="mt-2 text-sm">
              {d.faltaParaEmpatarComRetirada > 0 ? (
                <>
                  Faltam <span className="font-bold text-primary">{formatCurrency(d.faltaParaEmpatarComRetirada)}</span>
                  <span className="text-xs text-muted-foreground">
                    {" "}· cerca de {d.ticketMedio > 0 ? Math.ceil(d.faltaParaEmpatarComRetirada / d.ticketMedio) : 0} vendas
                  </span>
                </>
              ) : (
                <span className="font-bold text-emerald-500">Tudo pago, empresa e vida.</span>
              )}
            </p>
          </div>
        </div>
      </Painel>
    </div>
  );
}

const NOMES: Record<string, string> = {
  recebido: "Entrou",
  despesas: "Custo para operar",
  pessoal: "Sua vida",
  sobrouDeVerdade: "Sobrou de verdade",
};

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

/**
 * Uma parte da retirada, com o peso dela no total e o quanto dela já foi pago.
 *
 * O pago vem POR FATIA de propósito. Quando o pago do total aparecia solto
 * embaixo da linha das fixas, dava para ler errado: "contas fixas R$ 20.241"
 * com "já pago R$ 22.683" logo abaixo, que é impossível. O R$ 22.683 era das
 * duas somadas.
 */
function Fatia({
  rotulo, valor, pago, total, detalhe, cor,
}: { rotulo: string; valor: number; pago: number; total: number; detalhe?: string; cor: string }) {
  const pct = total > 0 ? (valor / total) * 100 : 0;
  const aberto = Math.max(0, valor - pago);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="text-foreground">{rotulo}</span>
        <span className="shrink-0 text-muted-foreground">
          <span className="font-medium text-foreground">{formatCurrency(valor)}</span>
          <span className="ml-2 text-primary">{pct.toFixed(0)}%</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full" style={{ width: `${Math.max(1, pct)}%`, backgroundColor: cor }} />
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        {aberto > 0.5 ? (
          <>
            pago {formatCurrency(pago)} · <span className="text-destructive">falta {formatCurrency(aberto)}</span>
          </>
        ) : (
          <>tudo pago</>
        )}
        {detalhe && <> · {detalhe}</>}
      </p>
    </div>
  );
}

function Linha({
  rotulo, valor, cor, detalhe, negrito,
}: { rotulo: string; valor: number; cor: string; detalhe?: string; negrito?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className={`text-sm ${negrito ? "font-medium text-foreground" : "text-muted-foreground"}`}>{rotulo}</p>
        {detalhe && <p className="text-[10px] text-muted-foreground">{detalhe}</p>}
      </div>
      <span className={`shrink-0 text-sm font-medium ${cor}`}>
        {valor < 0 ? "− " : ""}{formatCurrency(Math.abs(valor))}
      </span>
    </div>
  );
}
