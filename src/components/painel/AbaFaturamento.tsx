import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Percent, TrendingUp, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Cartao, CartaoBrutoLiquido, Comparacao, Painel, Vazio, estiloTooltip } from "./Pecas";
import type { Painel as DadosPainel } from "@/hooks/usePainel";

const eixo = { fontSize: 10, fill: "hsl(0 0% 55%)" };
const emK = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v));

export default function AbaFaturamento({ d }: { d: DadosPainel }) {
  const m = d.mesAtual;
  const pesoTaxa = m.recebidoBruto > 0 ? (m.taxas / m.recebidoBruto) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CartaoBrutoLiquido
          titulo="Entrou no mês"
          bruto={m.recebidoBruto}
          liquido={m.recebidoLiquido}
          detalhe={`${m.vendasQtd} vendas + ${m.parcelasQtd} parcelas`}
          icone={Wallet}
        />
        <Cartao
          titulo="Taxa das plataformas"
          valor={formatCurrency(m.taxas)}
          detalhe={`${pesoTaxa.toFixed(1)}% de tudo que entrou`}
          icone={Percent}
          tom={pesoTaxa > 10 ? "alerta" : "normal"}
        />
        <Cartao
          titulo="Veio de venda nova"
          valor={formatCurrency(m.vendasBruto)}
          detalhe={m.recebidoBruto > 0 ? `${((m.vendasBruto / m.recebidoBruto) * 100).toFixed(0)}% do mês` : "—"}
          icone={TrendingUp}
        >
          <Comparacao agora={m.vendasBruto} antes={d.mesPassadoAteAqui.vendasBruto} legenda={`vs ${d.rotuloMesAnterior}`} />
        </Cartao>
        <Cartao
          titulo="Veio de parcela antiga"
          valor={formatCurrency(m.parcelasValor)}
          detalhe={m.recebidoBruto > 0 ? `${((m.parcelasValor / m.recebidoBruto) * 100).toFixed(0)}% do mês` : "—"}
          icone={Wallet}
        >
          <Comparacao agora={m.parcelasValor} antes={d.mesPassadoAteAqui.parcelasValor} legenda={`vs ${d.rotuloMesAnterior}`} />
        </Cartao>
      </div>

      <Painel titulo={`Dinheiro entrando dia a dia em ${d.rotuloMesAtual}`}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={d.porDia}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="rotulo" tick={eixo} interval={2} />
            <YAxis tick={eixo} tickFormatter={emK} />
            <Tooltip
              contentStyle={estiloTooltip}
              formatter={(v: number, n: string) => [formatCurrency(v), n === "vendas" ? "Vendas novas" : "Parcelas"]}
              labelFormatter={(l) => `Dia ${l}`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === "vendas" ? "Vendas novas" : "Parcelas")} />
            <Bar dataKey="vendas" stackId="a" fill="#C9A84C" radius={[0, 0, 0, 0]} />
            <Bar dataKey="parcelas" stackId="a" fill="#8B7432" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Painel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Painel titulo="Acumulado do mês contra a meta">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={d.porDia}>
              <defs>
                <linearGradient id="grad-acumulado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="rotulo" tick={eixo} interval={3} />
              <YAxis tick={eixo} tickFormatter={emK} />
              <Tooltip contentStyle={estiloTooltip} formatter={(v: number) => [formatCurrency(v), "Acumulado"]} labelFormatter={(l) => `Até o dia ${l}`} />
              <Area type="monotone" dataKey="acumulado" stroke="#C9A84C" strokeWidth={2} fill="url(#grad-acumulado)" />
            </AreaChart>
          </ResponsiveContainer>
          {d.metaValor > 0 && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Meta do mês: <span className="font-medium text-foreground">{formatCurrency(d.metaValor)}</span>
              {" · "}
              chegou em <span className="font-medium text-primary">{d.metaPercent.toFixed(0)}%</span>
            </p>
          )}
        </Painel>

        <Painel titulo="Últimos 12 meses">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={d.historico}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="rotulo" tick={eixo} />
              <YAxis tick={eixo} tickFormatter={emK} />
              <Tooltip
                contentStyle={estiloTooltip}
                formatter={(v: number, n: string) => [formatCurrency(v), n === "recebido" ? "Recebido" : "Vendido"]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => (v === "recebido" ? "Recebido" : "Vendido")} />
              <Line type="monotone" dataKey="vendido" stroke="#8B7432" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="recebido" stroke="#C9A84C" strokeWidth={2} dot={{ fill: "#C9A84C", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Vendido é o contrato fechado. Recebido é o dinheiro que caiu na conta.
          </p>
        </Painel>
      </div>

      <Painel titulo="Mês a mês, em números">
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Mês", "Vendido", "Recebido", "Contas", "Sobrou"].map((h, i) => (
                  <th key={h} className={`p-2 text-xs font-medium text-muted-foreground ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...d.historico].reverse().map(h => (
                <tr key={h.mes} className={`border-b border-border/50 ${h.mes === d.mes.inicio.slice(0, 7) ? "bg-primary/5" : ""}`}>
                  <td className="p-2 font-medium text-foreground">{h.rotulo}</td>
                  <td className="p-2 text-right text-muted-foreground">{formatCurrency(h.vendido)}</td>
                  <td className="p-2 text-right text-foreground">{formatCurrency(h.recebido)}</td>
                  <td className="p-2 text-right text-muted-foreground">{formatCurrency(h.despesas)}</td>
                  <td className={`p-2 text-right font-medium ${h.resultado >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {formatCurrency(h.resultado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Painel>
    </div>
  );
}
