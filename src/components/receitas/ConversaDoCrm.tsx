import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ExternalLink, Instagram, Link2, Loader2, MessageCircle, Phone, Search, Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CRM_URL = "https://crm.worklash.com.br";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Esperando resposta",
  OPEN: "Em atendimento",
  WAITING: "Aguardando a pessoa",
  CLOSED: "Encerrada",
  BOT: "Com a IA",
};

type Conversa = { id: string; status: string; protocol: string | null; lastMessageAt: string | null };
type Contato = {
  id: string; name: string | null; phone: string | null; email: string | null;
  conversations?: Conversa[];
  channels?: { profileName: string | null; channel?: { type: string } | null }[];
};

/** Mesma ponte que a tela Pessoas usa: o CRM mora noutro servidor. */
async function ponte(params: Record<string, string>) {
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
  if (!r.ok) throw new Error(corpo?.erro ?? "Não consegui falar com o Atendimento.");
  return corpo?.data ?? corpo;
}

async function procurarContatos(busca: string): Promise<Contato[]> {
  const corpo = await ponte({ search: busca, page: "1", limit: "6" });
  return corpo?.contacts ?? [];
}

/** A lista não traz as conversas: elas vêm na ficha de cada pessoa. */
async function fichaDoContato(id: string): Promise<Contato | null> {
  return (await ponte({ id })) ?? null;
}

function nomeDoContato(c: Contato) {
  return c.name || c.channels?.find(x => x.profileName)?.profileName || c.phone || "Sem nome";
}

/**
 * Liga uma venda à conversa do CRM que a gerou.
 *
 * Existe porque a venda automática da plataforma chega sabendo o PEDIDO, mas
 * não sabendo com quem a equipe conversou. Sem este campo, a única forma de
 * registrar a conversa era relançar a venda à mão no CRM, e isso criava venda
 * duplicada (aconteceu em 23/09 e 28/09/2026).
 */
export default function ConversaDoCrm({
  receitaId, conversaAtual, pedidoPlataforma, clienteNome, clienteEmail,
}: {
  receitaId: string;
  conversaAtual: string | null;
  pedidoPlataforma: string | null;
  clienteNome: string | null;
  clienteEmail: string | null;
}) {
  const clienteQuery = useQueryClient();
  const [procurando, setProcurando] = useState(false);
  const [busca, setBusca] = useState(clienteEmail || clienteNome || "");

  const [contatoAberto, setContatoAberto] = useState<string | null>(null);

  const pessoas = useQuery({
    queryKey: ["crm-pessoas-vinculo", busca],
    queryFn: () => procurarContatos(busca),
    enabled: procurando && busca.trim().length >= 3,
  });

  const ficha = useQuery({
    queryKey: ["crm-ficha-vinculo", contatoAberto],
    queryFn: () => fichaDoContato(contatoAberto!),
    enabled: !!contatoAberto,
  });

  const salvar = useMutation({
    mutationFn: async (idDaConversa: string | null) => {
      const { error } = await supabase
        .from("receitas")
        .update({ crm_conversa_id: idDaConversa })
        .eq("id", receitaId);
      if (error) throw error;
    },
    onSuccess: (_d, idDaConversa) => {
      clienteQuery.invalidateQueries({ queryKey: ["receitas-all"] });
      clienteQuery.invalidateQueries({ queryKey: ["painel-receitas"] });
      toast.success(idDaConversa ? "Conversa vinculada." : "Vínculo removido.");
      setProcurando(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const pedidoLegivel = (() => {
    if (!pedidoPlataforma) return null;
    const [plataforma, pedido] = pedidoPlataforma.split(":");
    if (!pedido) return null;
    return `${plataforma.charAt(0).toUpperCase()}${plataforma.slice(1)} · pedido ${pedido.slice(0, 8)}`;
  })();

  return (
    <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5 text-foreground/80">
          <MessageCircle className="h-3.5 w-3.5 text-primary" />
          Conversa do Atendimento
        </Label>
        {pedidoLegivel && (
          <span className="text-[10px] text-muted-foreground">{pedidoLegivel}</span>
        )}
      </div>

      {conversaAtual ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
            <a href={`${CRM_URL}/inbox?conversationId=${conversaAtual}`} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1 h-3 w-3" /> Abrir a conversa
            </a>
          </Button>
          <Button
            size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
            onClick={() => salvar.mutate(null)} disabled={salvar.isPending}
          >
            {salvar.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Unlink className="mr-1 h-3 w-3" />}
            Desvincular
          </Button>
        </div>
      ) : !procurando ? (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">
            Esta venda ainda não está ligada a nenhuma conversa. Vincule aqui em vez de lançar a
            venda de novo, senão ela entra duas vezes.
          </p>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setProcurando(true)}>
            <Link2 className="mr-1 h-3 w-3" /> Vincular uma conversa
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <Input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="nome, e-mail, telefone ou @"
              className="h-7 bg-card text-xs"
            />
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => pessoas.refetch()}>
              <Search className="h-3 w-3" />
            </Button>
          </div>

          {pessoas.isFetching && (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> procurando no Atendimento…
            </p>
          )}

          {pessoas.error && (
            <p className="text-[11px] text-destructive">{(pessoas.error as Error).message}</p>
          )}

          {pessoas.data && pessoas.data.length === 0 && !pessoas.isFetching && (
            <p className="text-[11px] text-muted-foreground">
              Ninguém encontrado com isso. Tente o telefone ou o @ do Instagram.
            </p>
          )}

          {(pessoas.data ?? []).map(pessoa => {
            const aberto = contatoAberto === pessoa.id;
            const conversas = aberto ? (ficha.data?.conversations ?? []) : [];
            const arroba = pessoa.channels?.find(c => c.channel?.type === "INSTAGRAM")?.profileName;
            return (
              <div key={pessoa.id} className="rounded-md border border-border bg-card p-2">
                <button
                  onClick={() => setContatoAberto(aberto ? null : pessoa.id)}
                  className="w-full text-left"
                >
                  <p className="text-xs font-medium text-foreground">{nomeDoContato(pessoa)}</p>
                  <p className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    {arroba && <span className="flex items-center gap-1"><Instagram className="h-2.5 w-2.5" />{arroba}</span>}
                    {pessoa.phone && <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" />{pessoa.phone}</span>}
                    {pessoa.email && <span>{pessoa.email}</span>}
                    {!aberto && <span className="text-primary">ver conversas</span>}
                  </p>
                </button>

                {aberto && ficha.isFetching && (
                  <p className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" /> abrindo…
                  </p>
                )}

                {aberto && !ficha.isFetching && conversas.length === 0 && (
                  <p className="mt-1 text-[10px] text-muted-foreground">nenhuma conversa nesta pessoa</p>
                )}

                {aberto && conversas.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {[...conversas]
                      .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""))
                      .map(c => (
                        <button
                          key={c.id}
                          onClick={() => salvar.mutate(c.id)}
                          disabled={salvar.isPending}
                          className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-[11px] transition-colors hover:bg-surface-hover"
                        >
                          <span className="text-foreground">
                            {STATUS_LABEL[c.status] ?? c.status}
                            {c.protocol && <span className="ml-1 text-muted-foreground">#{c.protocol}</span>}
                          </span>
                          <span className="shrink-0 text-primary">vincular</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            );
          })}

          <Button size="sm" variant="ghost" className="h-6 text-[11px] text-muted-foreground" onClick={() => setProcurando(false)}>
            cancelar
          </Button>
        </div>
      )}
    </div>
  );
}
