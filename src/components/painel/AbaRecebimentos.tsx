import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CalendarDays, Clock, PiggyBank, Receipt, TrendingDown, UserX } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Barra, Cartao, Painel, Vazio, estiloTooltip } from "./Pecas";
import { saldoDaParcela, valorDaParcela } from "@/hooks/usePainel";
import type { Painel as DadosPainel } from "@/hooks/usePainel";

const eixo = { fontSize: 10, fill: "hsl(0 0% 55%)" };
const emK = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v));

export default function AbaRecebimentos({ d }: { d: DadosPainel }) {
  const navegar = useNavigate();
  const i = d.inadimplencia;

  // Quem deve, do mais atrasado para o menos.
  const devedoras = new Map<string, { nome: string; valor: number; parcelas: number; maisAntiga: string }>();
  d.vencidas.forEach(p => {
    const nome = p.parcelas_mentoria?.cliente_nome ?? "Sem nome";
    const chave = p.parcelas_mentoria?.cliente_email ?? nome;
    const atual = devedoras.get(chave) ?? { nome, valor: 0, parcelas: 0, maisAntiga: p.data_vencimento };
    atual.valor += saldoDaParcela(p);
    atual.parcelas += 1;
    if (p.data_vencimento < atual.maisAntiga) atual.maisAntiga = p.data_vencimento;
    devedoras.set(chave, atual);
  });
  const listaDevedoras = [...devedoras.values()].sort((a, b) => a.maisAntiga.localeCompare(b.maisAntiga));

  const diasParados = (data: string) =>
    Math.floor((Date.now() - new Date(data + "T00:00:00").getTime()) / 86400000);

  const proximas = [...d.aVencer]
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
    .slice(0, 12);

  const pico = d.diasVencimento[0];
  const totalMesVencimento = d.diasVencimento.reduce((s, x) => s + x.total, 0);

  // Como as alunas pagam, em faixas de atraso.
  const faixas = [
    { rotulo: "Em dia", qtd: i.pagasEmDia, cor: "#10b981" },
    { rotulo: "Atrasou até 7 dias", qtd: i.atrasouAte7, cor: "#C9A84C" },
    { rotulo: "Atrasou de 8 a 30 dias", qtd: i.atrasou8a30, cor: "#A68A3E" },
    { rotulo: "Atrasou mais de 30 dias", qtd: i.atrasouMais30, cor: "#8B7432" },
    { rotulo: "Ainda não pagou", qtd: i.naoPagas, cor: "#7f1d1d" },
  ];
  const maiorFaixa = Math.max(1, ...faixas.map(f => f.qtd));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao
          titulo="Recebido no mês"
          valor={formatCurrency(d.mesAtual.parcelasValor)}
          detalhe={`${d.mesAtual.parcelasQtd} parcelas quitadas`}
          icone={Receipt}
        />
        <Cartao
          titulo="Carteira já contratada"
          valor={formatCurrency(d.carteiraFutura)}
          detalhe={`${d.aVencer.length} parcelas de todos os contratos`}
          icone={PiggyBank}
          tom="bom"
        />
        <Cartao
          titulo="Em atraso, todos os meses"
          valor={formatCurrency(d.emAtrasoValor)}
          detalhe={`${d.alunasEmAtraso} ${d.alunasEmAtraso === 1 ? "aluna" : "alunas"} · ${formatCurrency(d.emAtrasoDoMes)} venceu neste mês`}
          icone={AlertTriangle}
          tom={d.emAtrasoValor > 0 ? "alerta" : "normal"}
          aoClicar={() => navegar("/parcelas")}
        />
        <Cartao
          titulo="Peso do atraso"
          valor={
            d.carteiraFutura + d.emAtrasoValor > 0
              ? `${((d.emAtrasoValor / (d.carteiraFutura + d.emAtrasoValor)) * 100).toFixed(1)}%`
              : "0%"
          }
          detalhe="do que você tem a receber está parado"
          icone={TrendingDown}
          tom={d.emAtrasoValor > 0 ? "alerta" : "normal"}
        />
      </div>

      {/* ------------------- INADIMPLÊNCIA DE VERDADE ------------------- */}
      <Painel titulo="Como as suas alunas pagam, nos últimos 12 meses">
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pagam em dia</p>
            <p className="text-lg font-bold text-emerald-500">{i.pctEmDia.toFixed(0)}%</p>
            <p className="text-[10px] text-muted-foreground">{i.pagasEmDia} de {i.parcelasQueVenceram} parcelas</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Atrasam mas pagam</p>
            <p className="text-lg font-bold text-primary">{i.pctAtrasada.toFixed(0)}%</p>
            <p className="text-[10px] text-muted-foreground">{i.pagasAtrasadas} parcelas</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Não pagaram</p>
            <p className="text-lg font-bold text-destructive">{i.pctNaoPaga.toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground">{i.naoPagas} parcelas</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Atraso típico</p>
            <p className="text-lg font-bold text-foreground">{i.medianaAtraso} dias</p>
            <p className="text-[10px] text-muted-foreground">média {i.mediaAtraso.toFixed(1)} · pior {i.piorAtraso}</p>
          </div>
        </div>

        <div className="space-y-2.5">
          {faixas.map(f => (
            <div key={f.rotulo}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-foreground">{f.rotulo}</span>
                <span className="shrink-0 text-muted-foreground">
                  {f.qtd} parcelas
                  {i.parcelasQueVenceram > 0 && (
                    <span className="ml-2 text-primary">
                      {((f.qtd / i.parcelasQueVenceram) * 100).toFixed(0)}%
                    </span>
                  )}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(1, (f.qtd / maiorFaixa) * 100)}%`, backgroundColor: f.cor }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-3">
          <p className="flex items-center gap-2 text-xs font-medium text-foreground">
            <UserX className="h-3.5 w-3.5 text-primary" />
            Contando por aluna, não por parcela
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            De <span className="font-medium text-foreground">{i.alunas} alunas</span> com parcela vencida
            no período, <span className="font-medium text-primary">{i.alunasQueAtrasaram}</span> já atrasaram
            alguma vez ({i.pctAlunasQueAtrasaram.toFixed(0)}%) e{" "}
            <span className="font-medium text-destructive">{i.alunasQuePararam}</span> pararam de pagar
            ({i.pctAlunasQuePararam.toFixed(0)}%).
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            "Parou de pagar" é parcela vencida há mais de 30 dias e ainda aberta. Hoje isso trava{" "}
            <span className="text-destructive">{formatCurrency(i.valorParado)}</span>.
          </p>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Atrasar virou o normal na sua carteira: só {i.pctEmDia.toFixed(0)}% das parcelas chegam no dia.
            A boa notícia é que {i.pagasAtrasadas > 0 ? ((i.atrasouAte7 / i.pagasAtrasadas) * 100).toFixed(0) : 0}%
            das atrasadas entram em até 7 dias, então o problema é lembrete, não é dinheiro.
          </p>
        </div>
      </Painel>

      <Painel titulo="Quando esse dinheiro já contratado vai entrar">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={d.proximosMeses}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="rotulo" tick={eixo} />
            <YAxis tick={eixo} tickFormatter={emK} />
            <Tooltip
              contentStyle={estiloTooltip}
              formatter={(v: number, _n, item: any) => [`${formatCurrency(v)} · ${item?.payload?.qtd ?? 0} parcelas`, "A receber"]}
            />
            <Bar dataKey="valor" fill="#C9A84C" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          As barras somam os {formatCurrency(d.carteiraFutura)} do cartão acima: é tudo que já foi
          vendido e ainda vai vencer, de qualquer contrato, não só das vendas deste mês.
        </p>
      </Painel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Painel titulo="Quem está devendo">
          {listaDevedoras.length === 0 ? (
            <Vazio texto="Ninguém em atraso. Carteira limpa." />
          ) : (
            <div className="space-y-1.5">
              {listaDevedoras.slice(0, 12).map(c => (
                <div key={c.nome + c.maisAntiga} className="flex items-center justify-between gap-3 border-b border-border/50 pb-1.5 text-xs last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-foreground">{c.nome}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {c.parcelas} {c.parcelas === 1 ? "parcela" : "parcelas"} · parada há {diasParados(c.maisAntiga)} dias
                    </p>
                  </div>
                  <span className="shrink-0 font-medium text-destructive">{formatCurrency(c.valor)}</span>
                </div>
              ))}
              {listaDevedoras.length > 12 && (
                <p className="pt-1 text-[10px] text-muted-foreground">e mais {listaDevedoras.length - 12}…</p>
              )}
            </div>
          )}
        </Painel>

        <Painel titulo="Próximas parcelas a vencer">
          {proximas.length === 0 ? (
            <Vazio texto="Nenhuma parcela a vencer." />
          ) : (
            <div className="space-y-1.5">
              {proximas.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3 border-b border-border/50 pb-1.5 text-xs last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-foreground">{p.parcelas_mentoria?.cliente_nome ?? "Sem nome"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      parcela {p.numero_parcela}/{p.parcelas_mentoria?.quant_parcelas ?? "?"} · vence {formatDate(p.data_vencimento)}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium text-foreground">{formatCurrency(valorDaParcela(p))}</span>
                </div>
              ))}
            </div>
          )}
        </Painel>
      </div>

      <Painel titulo={`Em que dia do mês o dinheiro de ${d.rotuloMesAtual} vence`}>
        {d.diasVencimento.length === 0 ? (
          <Vazio texto="Nenhuma parcela vencendo neste mês." />
        ) : (
          <>
            <div className="mb-3 flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground">
                O dia <span className="font-bold text-foreground">{pico.dia}</span> concentra{" "}
                <span className="font-bold text-primary">{formatCurrency(pico.total)}</span>
                {totalMesVencimento > 0 && <>, que é {((pico.total / totalMesVencimento) * 100).toFixed(0)}% dos {formatCurrency(totalMesVencimento)} que vencem no mês</>}.
                {pico.total / Math.max(1, totalMesVencimento) > 0.4 && " Se esse dia falhar, o mês inteiro sente."}
              </p>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={d.diasVencimentoOrdenados}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="dia" tick={eixo} />
                <YAxis tick={eixo} tickFormatter={emK} />
                <Tooltip
                  contentStyle={estiloTooltip}
                  formatter={(v: number, n: string) => [formatCurrency(v), n === "recebido" ? "Já recebido" : "Ainda a receber"]}
                  labelFormatter={(l) => `Dia ${l}`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === "recebido" ? "Já recebido" : "Ainda a receber")} />
                <Bar dataKey="recebido" stackId="a" fill="#C9A84C" />
                <Bar dataKey="aReceber" stackId="a" fill="#8B7432" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Mostra o mês inteiro, inclusive os dias que já passaram. Dourado claro é o que já caiu,
              escuro é o que ainda falta.
            </p>
          </>
        )}
      </Painel>
    </div>
  );
}
