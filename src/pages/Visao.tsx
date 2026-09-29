/**
 * Visão — o que pede decisão hoje.
 *
 * As rotinas rodam no CRM de hora em hora e guardam os achados lá. Esta
 * tela só pergunta. Nada é calculado aqui, e nada é copiado pra cá: o
 * número que aparece é o mesmo que o plantão das 7h usa.
 *
 * Achado tem memória: ele conta quantas rodadas seguidas apareceu, e se
 * fecha sozinho quando o problema some. Por isso "14×" ao lado de um
 * título quer dizer catorze rodadas com o problema ainda de pé, não
 * catorze problemas.
 */
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertTriangle, CircleAlert, Info, RefreshCw, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";

type Achado = {
  id: string;
  tipo: string;
  severidade: "URGENTE" | "ATENCAO" | "INFO";
  titulo: string;
  detalhe: string | null;
  valor: number | null;
  acao_url: string | null;
  acao_rotulo: string | null;
  status: string;
  vezes: number;
  ultima_vez_em: string;
};

type LinhaPlacar = { tipo: string; severidade: string; quantos: number; valor: number };

/** Chama a ponte levando a sessão de quem está logado. */
async function ponte(corpo: Record<string, unknown>) {
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre de novo.");

  const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/visao`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(corpo),
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error(body?.erro ?? "Não consegui falar com o Atendimento.");
  return body?.data ?? body;
}

const reais = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const ROTULO_TIPO: Record<string, string> = {
  RENOVACAO: "Renovação chegando",
  RENOVACAO_VENCIDA: "Renovação vencida",
  PARCELA_VENCENDO: "Parcela vencendo",
  PARCELA_ATRASADA: "Parcela atrasada",
  LEAD_PARADO: "Lead parado",
  GARGALO: "Gargalo da esteira",
  CONVERSA: "Conversa esquecida",
  QUEDA: "Queda no mês",
};

const ESTILO = {
  URGENTE: { borda: "border-l-destructive", texto: "text-destructive", Icone: AlertTriangle },
  ATENCAO: { borda: "border-l-amber-500", texto: "text-amber-600", Icone: CircleAlert },
  INFO: { borda: "border-l-muted-foreground/40", texto: "text-muted-foreground", Icone: Info },
} as const;

export default function Visao() {
  // A aba vem pela URL pra os atalhos do Início caírem direto no lugar
  // certo, e pra ela poder deixar uma aba favorita fixada no navegador.
  const [params, setParams] = useSearchParams();
  const aba = params.get("aba") ?? "hoje";

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold">Visão</h1>
        <p className="text-sm text-muted-foreground">
          O que pede decisão hoje, como foi a semana, como está o mês, e por que
          as conversas travam.
        </p>
      </div>

      <Tabs value={aba} onValueChange={(v) => setParams({ aba: v })}>
        <TabsList>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="mes">Mês</TabsTrigger>
          <TabsTrigger value="conversas">Conversas</TabsTrigger>
        </TabsList>

        <TabsContent value="hoje"><AbaHoje /></TabsContent>
        <TabsContent value="semana"><AbaSemana /></TabsContent>
        <TabsContent value="mes"><AbaMes /></TabsContent>
        <TabsContent value="conversas"><AbaConversas /></TabsContent>
      </Tabs>
    </div>
  );
}

function AbaHoje() {
  const qc = useQueryClient();
  const [severidade, setSeveridade] = useState<string>("");

  const achados = useQuery({
    queryKey: ["visao", "achados", severidade],
    queryFn: () => ponte({ rota: "achados", status: "ABERTO", severidade }) as Promise<Achado[]>,
  });

  const placar = useQuery({
    queryKey: ["visao", "placar"],
    queryFn: () => ponte({ rota: "placar" }) as Promise<LinhaPlacar[]>,
  });

  const marcar = useMutation({
    mutationFn: (v: { id: string; status: "FEITO" | "IGNORADO" }) =>
      ponte({ marcar: v.id, status: v.status }),
    onSuccess: (_d, v) => {
      toast.success(v.status === "FEITO" ? "Marcado como resolvido." : "Ignorado.");
      qc.invalidateQueries({ queryKey: ["visao"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lista = achados.data ?? [];
  const porSeveridade = (s: string) => lista.filter((a) => a.severidade === s).length;
  const dinheiroParado = (placar.data ?? []).reduce((a, l) => a + (l.valor ?? 0), 0);

  return (
    <div className="space-y-6 pt-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <p className="text-sm text-muted-foreground">
          As rotinas olham a operação de hora em hora e só trazem pra cá o que
          ainda está de pé.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["visao"] })}
          disabled={achados.isFetching}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${achados.isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {achados.isError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          {(achados.error as Error).message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Cartao rotulo="Urgente" valor={String(porSeveridade("URGENTE"))} tom="destructive" />
        <Cartao rotulo="Atenção" valor={String(porSeveridade("ATENCAO"))} tom="amber" />
        <Cartao rotulo="Pra saber" valor={String(porSeveridade("INFO"))} />
        <Cartao
          rotulo="Dinheiro em cima da mesa"
          valor={dinheiroParado > 0 ? reais(dinheiroParado) : "—"}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {([["", "Tudo"], ["URGENTE", "Urgente"], ["ATENCAO", "Atenção"], ["INFO", "Pra saber"]] as const).map(
          ([k, r]) => (
            <button
              key={k || "tudo"}
              onClick={() => setSeveridade(k)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                severidade === k
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-surface-hover"
              }`}
            >
              {r}
            </button>
          ),
        )}
      </div>

      {achados.isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : lista.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center">
          <p className="text-sm font-medium">Nada pedindo decisão agora.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            As rotinas continuam olhando de hora em hora. Se aparecer algo, cai aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map((a) => {
            const e = ESTILO[a.severidade] ?? ESTILO.INFO;
            return (
              <div key={a.id} className={`rounded-lg border border-l-4 border-border ${e.borda} p-4`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start">
                  <e.Icone className={`h-4 w-4 shrink-0 ${e.texto} mt-0.5`} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{a.titulo}</p>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {ROTULO_TIPO[a.tipo] ?? a.tipo}
                      </span>
                      {a.vezes > 1 && (
                        <span
                          className="text-[11px] text-muted-foreground"
                          title="Rodadas seguidas com esse problema ainda de pé"
                        >
                          {a.vezes}× seguidas
                        </span>
                      )}
                    </div>
                    {a.detalhe && (
                      <p className="mt-1 text-sm text-muted-foreground">{a.detalhe}</p>
                    )}
                    {a.valor ? (
                      <p className="mt-1 text-sm font-medium">{reais(Number(a.valor))}</p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {a.acao_url && (
                      <Button size="sm" variant="secondary" asChild>
                        <a
                          href={a.acao_url}
                          target={a.acao_url.startsWith("http") ? "_blank" : undefined}
                          rel="noreferrer"
                        >
                          {a.acao_rotulo ?? "Abrir"}
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => marcar.mutate({ id: a.id, status: "IGNORADO" })}
                    >
                      Ignorar
                    </Button>
                    <Button size="sm" onClick={() => marcar.mutate({ id: a.id, status: "FEITO" })}>
                      Resolvi
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Variação em cima de uma base: vermelho quando cai, verde quando sobe. */
function Variacao({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined) {
    return <span className="text-xs text-muted-foreground">sem base pra comparar</span>;
  }
  const pct = Math.round(v * 100);
  return (
    <span className={`text-xs font-medium ${pct < 0 ? "text-destructive" : "text-emerald-600"}`}>
      {pct > 0 ? "+" : ""}
      {pct}%
    </span>
  );
}

function AbaSemana() {
  const q = useQuery({
    queryKey: ["visao", "semana"],
    queryFn: () => ponte({ rota: "semana" }) as Promise<any>,
  });

  if (q.isLoading) return <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>;
  if (q.isError) return <Erro e={q.error as Error} />;

  const d = q.data ?? {};
  const di = d.dinheiro ?? {};
  const at = d.atendimento ?? {};
  const ac = d.achados ?? {};
  const semResposta = at.novas > 0 ? at.semResposta / at.novas : 0;

  return (
    <div className="space-y-6 pt-4">
      <p className="text-sm text-muted-foreground">
        Os últimos 7 dias contra os 7 anteriores. Período fechado contra período
        fechado, que é a única comparação que não mente.
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Cartao rotulo="Entrou na semana" valor={reais(di.receita ?? 0)} rodape={<Variacao v={di.variacao} />} />
        <Cartao rotulo="Vendas" valor={`${di.vendas ?? 0}`} rodape={<span className="text-xs text-muted-foreground">antes {di.vendasAnterior ?? 0}</span>} />
        <Cartao rotulo="Ticket médio" valor={reais(di.ticketMedio ?? 0)} />
        <Cartao
          rotulo="ROAS do tráfego"
          valor={d.trafego?.roas ? `${d.trafego.roas.toFixed(2)}x` : "—"}
          rodape={<span className="text-xs text-muted-foreground">gastou {reais(d.trafego?.gasto ?? 0)}</span>}
        />
      </div>

      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium">Atendimento</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Chegaram <strong>{at.novas ?? 0}</strong> conversas novas.{" "}
          <strong className={semResposta > 0.3 ? "text-destructive" : ""}>
            {at.semResposta ?? 0} nunca receberam resposta nossa
          </strong>{" "}
          ({Math.round(semResposta * 100)}%).
        </p>
        {semResposta > 0.3 && (
          <p className="mt-2 text-xs text-destructive">
            Mais de um terço de quem levantou a mão não foi respondido. Isso é
            dinheiro entrando pela porta e saindo sozinho.
          </p>
        )}
      </div>

      {(d.produtos ?? []).length > 0 && (
        <div className="rounded-lg border border-border">
          <p className="border-b border-border px-4 py-3 text-sm font-medium">O que vendeu</p>
          <div className="divide-y divide-border">
            {d.produtos.map((p: any) => (
              <div key={p.produto} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate">{p.produto}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {p.quantos}× · {reais(p.valor)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium">Achados da semana</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {ac.abertosNaSemana ?? 0} abriram, {ac.fechadosNaSemana ?? 0} foram resolvidos.
        </p>
        {(ac.cronicos ?? []).length > 0 ? (
          <div className="mt-3">
            <p className="text-xs font-medium text-destructive">
              Abertos a semana inteira ({ac.cronicos.length})
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Estes ninguém resolveu mesmo vendo todo dia.
            </p>
            <ul className="mt-2 space-y-1">
              {ac.cronicos.map((c: any) => (
                <li key={c.id} className="text-sm">
                  {c.titulo}{" "}
                  <span className="text-xs text-muted-foreground">({c.vezes}× seguidas)</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Nenhum achado atravessou a semana inteira aberto.
          </p>
        )}
      </div>
    </div>
  );
}

function AbaMes() {
  const q = useQuery({
    queryKey: ["visao", "mes"],
    queryFn: () => ponte({ rota: "mes" }) as Promise<any>,
  });

  if (q.isLoading) return <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>;
  if (q.isError) return <Erro e={q.error as Error} />;

  const d = q.data ?? {};
  const c = d.caixa;
  const pl = d.plataformas ?? {};
  const m = d.mentoria;

  return (
    <div className="space-y-6 pt-4">
      <p className="text-sm text-muted-foreground">
        {d.fechado
          ? "Mês fechado, comparado com o mês anterior inteiro."
          : "Mês em andamento, comparado com o MESMO ponto do mês anterior."}
      </p>

      {c ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Cartao rotulo="Entrou no mês" valor={reais(c.receita)} rodape={<Variacao v={c.variacao} />} />
            <Cartao rotulo={c.comparavelRotulo} valor={reais(c.comparavel)} />
            <Cartao rotulo="Mês passado inteiro" valor={reais(c.anteriorInteiro)} />
            <Cartao rotulo="Média de 3 meses" valor={reais(c.media3Meses)} />
          </div>
          {c.variacao !== null && c.variacao < -0.15 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
              O mês está {Math.abs(Math.round(c.variacao * 100))}% abaixo do mesmo
              ponto do mês passado. Faltam {reais(Math.max(c.comparavel - c.receita, 0))} só
              pra empatar.
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          O financeiro não respondeu agora. Os números de plataforma abaixo
          continuam valendo.
        </div>
      )}

      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium">Só o que veio por plataforma</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {reais(pl.receita ?? 0)} em {pl.vendas ?? 0} vendas, com{" "}
          {reais(d.trafego?.gasto ?? 0)} de anúncio.{" "}
          {d.trafego?.roas ? <strong>ROAS {d.trafego.roas.toFixed(2)}x</strong> : "Sem gasto de anúncio."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Kiwify, Hotmart e Eduzz. A mentoria é lançada direto no Escritório e
          não aparece aqui, por isso este número é menor que o caixa do mês. É
          contra ele que o ROAS do tráfego fecha.
        </p>
      </div>

      {(d.porProduto ?? []).length > 0 && (
        <div className="rounded-lg border border-border">
          <p className="border-b border-border px-4 py-3 text-sm font-medium">Por produto</p>
          <div className="divide-y divide-border">
            {d.porProduto.map((p: any) => (
              <div key={p.produto} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate">{p.produto}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {p.quantos}× · {reais(p.valor)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {m && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Cartao rotulo="Renovaram" valor={String(m.renovacoesNoMes)} />
          <Cartao rotulo="Venceram sem renovar" valor={String(m.vencidasSemRenovar)} tom={m.vencidasSemRenovar > 0 ? "destructive" : undefined} />
          <Cartao rotulo="Parcelas atrasadas" valor={String(m.parcelasAtrasadas)} tom={m.parcelasAtrasadas > 0 ? "amber" : undefined} />
          <Cartao rotulo="Valor atrasado" valor={reais(m.valorAtrasado)} tom={m.valorAtrasado > 0 ? "amber" : undefined} />
        </div>
      )}
    </div>
  );
}

/**
 * Conversas — o minerador.
 *
 * A aba Hoje diz ONDE a conta trava ("159 em Em conexão e só 6 em Call
 * agendada"). Aqui a IA lê as conversas que pararam e diz POR QUÊ.
 *
 * A leitura é sob demanda, no botão, porque custa uma chamada de IA e
 * demora quase um minuto. O último resultado fica salvo pra abrir
 * instantâneo.
 */
function AbaConversas() {
  const qc = useQueryClient();
  const [escolhida, setEscolhida] = useState<string>("");

  const etapas = useQuery({
    queryKey: ["visao", "minerador", "etapas"],
    queryFn: () => ponte({ rota: "minerador/etapas" }) as Promise<any[]>,
  });

  const ultima = useQuery({
    queryKey: ["visao", "minerador", "ultima"],
    queryFn: () => ponte({ rota: "minerador/ultima" }) as Promise<any>,
  });

  const minerar = useMutation({
    mutationFn: (stageId: string) => ponte({ minerarEtapa: stageId }),
    onSuccess: (r: any) => {
      if (r?.ok === false) toast.error(r.erro ?? "Não consegui ler as conversas.");
      else toast.success("Leitura pronta.");
      qc.invalidateQueries({ queryKey: ["visao", "minerador"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const r = ultima.data;
  const lista = etapas.data ?? [];

  return (
    <div className="space-y-6 pt-4">
      <p className="text-sm text-muted-foreground">
        A aba Hoje diz onde a conta trava. Aqui a IA lê as conversas que
        pararam nessa etapa e diz por quê, com o que a pessoa escreveu.
      </p>

      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium">Escolha a etapa</p>
        {etapas.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhuma etapa com 5 ou mais conversas paradas há mais de 7 dias.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
            <select
              value={escolhida}
              onChange={(e) => setEscolhida(e.target.value)}
              className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            >
              <option value="">— escolher —</option>
              {lista.map((e: any) => (
                <option key={e.stageId} value={e.stageId}>
                  {e.pipeline} · {e.etapa} ({e.parados} paradas)
                </option>
              ))}
            </select>
            <Button
              onClick={() => minerar.mutate(escolhida)}
              disabled={!escolhida || minerar.isPending}
            >
              <Search className="mr-2 h-4 w-4" />
              {minerar.isPending ? "Lendo as conversas…" : "Descobrir por quê"}
            </Button>
          </div>
        )}
        {minerar.isPending && (
          <p className="mt-2 text-xs text-muted-foreground">
            Isso leva quase um minuto: ela está lendo conversa por conversa.
          </p>
        )}
      </div>

      {r?.ok && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">Por que trava em “{r.etapa}”</p>
              <span className="text-xs text-muted-foreground">
                leu {r.conversasLidas} de {r.conversasParadas} paradas
              </span>
            </div>
            {r.ondeParou && (
              <p className="mt-2 text-sm">
                <span className="text-muted-foreground">Onde para: </span>
                {r.ondeParou}
              </p>
            )}
            {r.oQueNosFizemos && (
              <p className="mt-1 text-sm">
                <span className="text-muted-foreground">Nosso padrão antes de travar: </span>
                {r.oQueNosFizemos}
              </p>
            )}
          </div>

          {(r.motivos ?? []).map((m: any, i: number) => (
            <div key={i} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{m.motivo}</p>
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {m.quantas} conversas
                </span>
              </div>
              {m.exemplo && (
                <p className="mt-2 border-l-2 border-border pl-3 text-sm italic text-muted-foreground">
                  “{m.exemplo}”
                </p>
              )}
              {m.oQueFazer && (
                <div className="mt-3 border-l-2 border-primary pl-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">O que fazer</p>
                  <p className="text-sm">{m.oQueFazer}</p>
                </div>
              )}
            </div>
          ))}

          {r.primeiroPasso && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">
                Se for mudar uma coisa só
              </p>
              <p className="mt-1 text-sm">{r.primeiroPasso}</p>
            </div>
          )}

          {r.salvoEm && (
            <p className="text-xs text-muted-foreground">
              Leitura de {new Date(r.salvoEm).toLocaleDateString("pt-BR")}. Rode de
              novo pra atualizar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Erro({ e }: { e: Error }) {
  return (
    <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
      {e.message}
    </div>
  );
}

function Cartao({
  rotulo,
  valor,
  tom,
  rodape,
}: {
  rotulo: string;
  valor: string;
  tom?: "destructive" | "amber";
  rodape?: ReactNode;
}) {
  const cor =
    tom === "destructive" ? "text-destructive" : tom === "amber" ? "text-amber-600" : "";
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${cor}`}>{valor}</p>
      {rodape && <div className="mt-0.5">{rodape}</div>}
    </div>
  );
}
