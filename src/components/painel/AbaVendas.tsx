import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Award, GraduationCap, Package, Sparkles, Tag, Users } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Barra, Cartao, Comparacao, OURO, Painel, Vazio, estiloTooltip } from "./Pecas";
import type { Painel as DadosPainel } from "@/hooks/usePainel";

/** Categorias que ganham cartão próprio, na ordem em que ela pensa no negócio. */
const DESTAQUES = [
  { chave: "Mentorias", icone: GraduationCap },
  { chave: "Consultorias", icone: Sparkles },
  { chave: "Digitais", icone: Package },
  { chave: "Renovações", icone: Award },
];

export default function AbaVendas({ d }: { d: DadosPainel }) {
  const m = d.mesAtual;
  const maiorProduto = d.produtos[0]?.valor ?? 0;

  const fatia = d.categorias.map(c => ({ name: c.nome, value: c.vendido }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao
          titulo="Vendas fechadas"
          valor={String(m.vendasQtd)}
          detalhe={`${formatCurrency(m.vendido)} em contratos`}
          icone={Tag}
        >
          <Comparacao agora={m.vendasQtd} antes={d.mesPassadoAteAqui.vendasQtd} legenda={`vs ${d.rotuloMesAnterior} até aqui`} formato="numero" />
        </Cartao>
        <Cartao
          titulo="Ticket médio do contrato"
          valor={formatCurrency(d.ticketMedio)}
          detalhe={`${formatCurrency(m.vendido)} vendidos ÷ ${m.vendasQtd} vendas · é o contrato cheio, não o que entrou`}
          icone={Award}
        />
        <Cartao
          titulo="Clientes diferentes"
          valor={String(new Set(d.receitasMes.map(r => r.cliente_email || r.cliente_nome)).size)}
          detalhe="pessoas que compraram no mês"
          icone={Users}
        />
        <Cartao
          titulo="Produtos vendidos"
          valor={String(d.produtos.length)}
          detalhe={d.produtos[0]
            ? `campeão em dinheiro: ${d.produtos[0].nome}`
            : "—"}
          icone={Package}
        />
      </div>

      {/* Um cartão por linha de produto, com a Consultoria separada da Mentoria */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {DESTAQUES.map(({ chave, icone }) => {
          const c = d.categorias.find(x => x.nome === chave);
          return (
            <Cartao
              key={chave}
              titulo={chave}
              valor={formatCurrency(c?.vendido ?? 0)}
              detalhe={
                c
                  ? `${c.qtd} ${c.qtd === 1 ? "venda" : "vendas"} · entrou ${formatCurrency(c.recebido)}${c.deParcela > 0 ? ` (${formatCurrency(c.deParcela)} de parcela)` : ""}`
                  : "nenhuma venda no mês"
              }
              icone={icone}
              tom={chave === "Consultorias" && (c?.vendido ?? 0) > 0 ? "destaque" : "normal"}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Painel titulo="De onde veio o dinheiro vendido">
          {fatia.length === 0 ? (
            <Vazio texto="Nenhuma venda neste mês." />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={fatia} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {fatia.map((_, i) => <Cell key={i} fill={OURO[i % OURO.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={estiloTooltip} formatter={(v: number) => [formatCurrency(v)]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {d.categorias.map((c, i) => (
                  <div key={c.nome} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 truncate text-foreground">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: OURO[i % OURO.length] }} />
                      {c.nome}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatCurrency(c.vendido)}
                      <span className="ml-2 text-primary">
                        {m.vendido > 0 ? ((c.vendido / m.vendido) * 100).toFixed(0) : 0}%
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Painel>

        <Painel titulo="Produtos que trouxeram mais dinheiro no mês">
          {d.produtos.length === 0 ? (
            <Vazio texto="Nenhuma venda neste mês." />
          ) : (
            <div className="space-y-3">
              {d.produtos.slice(0, 8).map(p => (
                <div key={p.nome}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-foreground">{p.nome}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {p.qtd} {p.qtd === 1 ? "venda" : "vendas"} ·{" "}
                      <span className="font-medium text-foreground">{formatCurrency(p.valor)}</span>
                    </span>
                  </div>
                  <Barra valor={p.valor} maximo={maiorProduto} />
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Ordenado pelo dinheiro, não pela quantidade. A barra é o valor do contrato.
          </p>
        </Painel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Painel titulo="Por onde a venda chegou">
          {d.origens.length === 0 ? (
            <Vazio texto="Nenhuma origem registrada neste mês." />
          ) : (
            <>
              <div className="space-y-3">
                {d.origens.slice(0, 8).map(o => (
                  <div key={o.nome}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-foreground">{o.nome}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {o.qtd} {o.qtd === 1 ? "venda" : "vendas"} ·{" "}
                        <span className="font-medium text-foreground">{formatCurrency(o.valor)}</span>
                        <span className="ml-2 text-primary">{o.pct.toFixed(0)}%</span>
                      </span>
                    </div>
                    <Barra valor={o.valor} maximo={d.origens[0].valor} />
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      ticket médio de {formatCurrency(o.ticket)}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Origem é o caminho que trouxe a venda. Uma venda pode ter mais de uma origem marcada,
                então as porcentagens são sobre a soma das origens, não sobre o total do mês.
              </p>
            </>
          )}
        </Painel>

        <Painel titulo="Categoria por categoria">
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Categoria", "Vendas", "Vendido", "Entrou"].map((h, i) => (
                    <th key={h} className={`p-2 text-xs font-medium text-muted-foreground ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.categorias.map(c => (
                  <tr key={c.nome} className="border-b border-border/50">
                    <td className="p-2 font-medium text-foreground">{c.nome}</td>
                    <td className="p-2 text-right text-muted-foreground">{c.qtd || "—"}</td>
                    <td className="p-2 text-right text-foreground">{c.vendido > 0 ? formatCurrency(c.vendido) : "—"}</td>
                    <td className="p-2 text-right text-primary">
                      {formatCurrency(c.recebido)}
                      {c.deParcela > 0 && (
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          (c/ {formatCurrency(c.deParcela)} de parcela)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {d.categorias.length === 0 && (
                  <tr><td colSpan={4}><Vazio texto="Nenhuma venda neste mês." /></td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            <span className="text-foreground">Vendido</span> é o contrato fechado no mês.{" "}
            <span className="text-foreground">Entrou</span> é o dinheiro que caiu, e inclui parcela de
            contrato antigo. Por isso os dois números quase nunca são iguais.
          </p>
        </Painel>
      </div>
    </div>
  );
}
