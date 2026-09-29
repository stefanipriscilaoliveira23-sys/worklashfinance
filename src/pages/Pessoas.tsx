import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import {
  AlertTriangle,
  ExternalLink,
  Instagram,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Search,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const CRM_URL = "https://crm.worklash.com.br";
const POR_PAGINA = 30;

/**
 * Pessoas: todo mundo que já falou com a gente no WhatsApp ou no Instagram.
 *
 * Os dados NÃO ficam aqui. Eles moram no banco do Atendimento, num servidor
 * próprio, e esta tela pergunta lá na hora através da função `pessoas`. Foi
 * decidido assim de propósito: se a gente copiasse todo mundo pro Supabase,
 * passariam a existir duas versões da mesma pessoa e um sincronismo pra dar
 * errado justamente no dia da venda.
 *
 * Por isso aqui é só leitura. Editar pessoa continua sendo dentro do
 * Atendimento, que é onde ela realmente mora.
 */

interface CanalDaPessoa {
  id: string;
  externalId: string | null;
  profileName: string | null;
  profileAvatarUrl: string | null;
  channel?: { id: string; type: string; name: string } | null;
}

interface EtiquetaDaPessoa {
  tag?: { id: string; name: string; color: string | null } | null;
}

interface ConversaDaPessoa {
  id: string;
  status: string;
  protocol: string | null;
  lastMessageAt: string | null;
  channelId: string;
}

interface Pessoa {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  notes: string | null;
  createdAt: string;
  channels?: CanalDaPessoa[];
  tags?: EtiquetaDaPessoa[];
  conversations?: ConversaDaPessoa[];
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Esperando resposta",
  OPEN: "Em atendimento",
  WAITING: "Aguardando a pessoa",
  CLOSED: "Encerrada",
  BOT: "Com a IA",
};

/** Chama a função `pessoas` levando a sessão de quem está logado. */
async function buscarNaPonte(params: Record<string, string>) {
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre de novo.");

  const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pessoas`);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);

  const r = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  const corpo = await r.json().catch(() => null);
  if (!r.ok) {
    throw new Error(corpo?.erro ?? "Não consegui falar com o Atendimento.");
  }
  return corpo?.data ?? corpo;
}

function IconeDoCanal({ tipo }: { tipo?: string | null }) {
  if (tipo === "INSTAGRAM") return <Instagram className="h-3 w-3" />;
  return <MessageCircle className="h-3 w-3" />;
}

function nomeDaPessoa(p: Pessoa) {
  return (
    p.name ||
    p.channels?.find((c) => c.profileName)?.profileName ||
    p.phone ||
    "Sem nome"
  );
}

export default function Pessoas() {
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [pagina, setPagina] = useState(1);
  const [aberta, setAberta] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaAtiva(busca);
      setPagina(1);
    }, 350);
    return () => clearTimeout(t);
  }, [busca]);

  const lista = useQuery({
    queryKey: ["pessoas", buscaAtiva, pagina],
    queryFn: () =>
      buscarNaPonte({
        search: buscaAtiva,
        page: String(pagina),
        limit: String(POR_PAGINA),
      }),
    // A base muda o tempo todo (chega gente nova o dia inteiro), mas não a
    // ponto de justificar buscar de novo a cada foco de janela.
    staleTime: 60_000,
  });

  const ficha = useQuery({
    queryKey: ["pessoa", aberta],
    queryFn: () => buscarNaPonte({ id: aberta! }),
    enabled: !!aberta,
  });

  const pessoas: Pessoa[] = lista.data?.contacts ?? [];
  const paginacao = lista.data?.pagination;
  const total = paginacao?.total ?? 0;
  const totalPaginas = paginacao?.totalPages ?? 1;

  const detalhe: Pessoa | null = ficha.data ?? null;

  const conversasOrdenadas = useMemo(() => {
    const cs = detalhe?.conversations ?? [];
    return [...cs].sort(
      (a, b) =>
        new Date(b.lastMessageAt ?? 0).getTime() -
        new Date(a.lastMessageAt ?? 0).getTime(),
    );
  }, [detalhe]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Pessoas</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Todo mundo que já falou com a gente no WhatsApp ou no Instagram. Vem direto
            do Atendimento, não é uma cópia.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-muted-foreground border-border">
            {total.toLocaleString("pt-BR")} pessoa{total !== 1 ? "s" : ""}
          </Badge>
          <Button variant="outline" className="border-border" asChild>
            <a href={`${CRM_URL}/inbox`} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> Abrir o Atendimento
            </a>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, e-mail ou @instagram..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 bg-secondary/50 border-border"
          />
        </div>
      </div>

      {lista.isError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Não consegui falar com o Atendimento.
              </p>
              <p className="text-sm text-muted-foreground">
                {(lista.error as Error)?.message}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 border-border"
                onClick={() => void lista.refetch()}
              >
                Tentar de novo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {lista.isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando pessoas...
        </div>
      ) : (
        !lista.isError && (
          <>
            {pessoas.length === 0 ? (
              <div className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">
                {buscaAtiva
                  ? `Ninguém encontrado com "${buscaAtiva}".`
                  : "Ninguém por aqui ainda."}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {pessoas.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setAberta(p.id)}
                    className={`flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-secondary/50 ${
                      i > 0 ? "border-t border-border" : ""
                    }`}
                  >
                    {p.avatarUrl ? (
                      <img
                        src={p.avatarUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
                        {nomeDaPessoa(p).slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {nomeDaPessoa(p)}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {p.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {p.phone}
                          </span>
                        )}
                        {p.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="h-3 w-3" /> {p.email}
                          </span>
                        )}
                        {(p.channels ?? []).map((c) => (
                          <span key={c.id} className="flex items-center gap-1">
                            <IconeDoCanal tipo={c.channel?.type} />
                            {c.profileName ?? c.channel?.name ?? "canal"}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="hidden shrink-0 items-center gap-2 sm:flex">
                      {(p.tags ?? []).slice(0, 2).map((t, idx) =>
                        t.tag ? (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="border-border text-[10px] text-muted-foreground"
                          >
                            {t.tag.name}
                          </Badge>
                        ) : null,
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(p.createdAt)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {totalPaginas > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Página {pagina} de {totalPaginas}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border"
                    disabled={pagina <= 1 || lista.isFetching}
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border"
                    disabled={pagina >= totalPaginas || lista.isFetching}
                    onClick={() => setPagina((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </>
        )
      )}

      <Sheet open={!!aberta} onOpenChange={(v) => !v && setAberta(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{detalhe ? nomeDaPessoa(detalhe) : "Ficha da pessoa"}</SheetTitle>
          </SheetHeader>

          {ficha.isLoading && (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando no Atendimento...
            </div>
          )}

          {detalhe && (
            <div className="mt-4 space-y-5">
              <div className="flex items-center gap-3">
                {detalhe.avatarUrl ? (
                  <img
                    src={detalhe.avatarUrl}
                    alt=""
                    className="h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-muted-foreground">
                    {nomeDaPessoa(detalhe).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {nomeDaPessoa(detalhe)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Conhecemos em {formatDate(detalhe.createdAt)}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 text-sm">
                {detalhe.phone && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> {detalhe.phone}
                  </p>
                )}
                {detalhe.email && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" /> {detalhe.email}
                  </p>
                )}
                {!detalhe.phone && !detalhe.email && (
                  <p className="text-muted-foreground">
                    Sem telefone nem e-mail. Só chegou pelo Instagram.
                  </p>
                )}
              </div>

              {(detalhe.tags ?? []).length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Etiquetas
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(detalhe.tags ?? []).map((t, i) =>
                      t.tag ? (
                        <Badge key={i} variant="outline" className="border-border">
                          {t.tag.name}
                        </Badge>
                      ) : null,
                    )}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Onde ela fala com a gente
                </p>
                <div className="space-y-1.5">
                  {(detalhe.channels ?? []).map((c) => (
                    <p
                      key={c.id}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <IconeDoCanal tipo={c.channel?.type} />
                      {c.profileName ?? "—"}
                      <span className="text-xs opacity-70">{c.channel?.name}</span>
                    </p>
                  ))}
                  {(detalhe.channels ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum canal ligado.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Conversas
                </p>
                <div className="space-y-2">
                  {conversasOrdenadas.map((c) => (
                    <a
                      key={c.id}
                      href={`${CRM_URL}/inbox?conversationId=${c.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 transition-colors hover:border-primary/50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-foreground">
                          {STATUS_LABEL[c.status] ?? c.status}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.lastMessageAt
                            ? `Última mensagem em ${formatDate(c.lastMessageAt)}`
                            : "Sem mensagem ainda"}
                          {c.protocol ? ` · ${c.protocol}` : ""}
                        </p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </a>
                  ))}
                  {conversasOrdenadas.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
                  )}
                </div>
              </div>

              {detalhe.notes && (
                <div>
                  <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Anotações
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {detalhe.notes}
                  </p>
                </div>
              )}

              <p className="border-t border-border pt-4 text-xs text-muted-foreground">
                Para editar esta pessoa, abra o Atendimento. Aqui é só leitura, pra não
                existirem duas versões dela.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
