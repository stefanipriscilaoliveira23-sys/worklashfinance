import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { Search, Loader2, ChevronRight, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Tables } from "@/integrations/supabase/types";

export default function Clientes() {
  const [search, setSearch] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Tables<"clientes"> | null>(null);

  const { data: clientes, isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Get all contracts for selected client
  const { data: contratos } = useQuery({
    queryKey: ["cliente-contratos", selectedCliente?.id],
    enabled: !!selectedCliente,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas_mentoria")
        .select("*, parcelas_mentoria_detalhe(*)")
        .eq("cliente_id", selectedCliente!.id)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Get receitas for client by name match
  const { data: receitas } = useQuery({
    queryKey: ["cliente-receitas", selectedCliente?.nome],
    enabled: !!selectedCliente,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receitas")
        .select("*")
        .eq("cliente_nome", selectedCliente!.nome)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = (clientes ?? []).filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.nome.toLowerCase().includes(s) || (c.email ?? "").toLowerCase().includes(s);
  });

  // Compute summary per client
  const clientSummary = (clienteId: string) => {
    // We don't have per-client data in list view, we compute in the sheet
    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Clientes</h1>
        </div>
        <Badge variant="outline" className="text-muted-foreground border-border">
          {filtered.length} cliente{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="p-3 text-xs font-medium text-muted-foreground text-left">Nome</th>
                  <th className="p-3 text-xs font-medium text-muted-foreground text-left">Email</th>
                  <th className="p-3 text-xs font-medium text-muted-foreground text-left">Cadastro</th>
                  <th className="p-3 text-xs font-medium text-muted-foreground text-left"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="p-12 text-center text-muted-foreground">Nenhum cliente encontrado</td></tr>
                )}
                {filtered.map(c => (
                  <tr
                    key={c.id}
                    className="border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer"
                    onClick={() => setSelectedCliente(c)}
                  >
                    <td className="p-3 font-medium">{c.nome}</td>
                    <td className="p-3 text-muted-foreground text-xs">{c.email || "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs">{formatDate(c.criado_em)}</td>
                    <td className="p-3"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Client detail sheet */}
      <Sheet open={!!selectedCliente} onOpenChange={() => setSelectedCliente(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl bg-card border-border overflow-y-auto">
          {selectedCliente && (
            <div className="space-y-6">
              <SheetHeader>
                <SheetTitle className="text-foreground">{selectedCliente.nome}</SheetTitle>
                <p className="text-sm text-muted-foreground">{selectedCliente.email || "Sem email"}</p>
              </SheetHeader>

              {/* Contracts */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Contratos de Mentoria</h3>
                {(contratos ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum contrato encontrado</p>
                ) : (
                  <div className="space-y-3">
                    {(contratos ?? []).map((contrato: any) => {
                      const detalhes = contrato.parcelas_mentoria_detalhe ?? [];
                      const totalPago = detalhes.reduce((acc: number, d: any) => acc + (d.valor_pago_parcial ?? 0), 0);
                      const saldoRestante = detalhes.reduce((acc: number, d: any) => acc + (d.saldo_parcela ?? 0), 0);
                      const parcelasQuitadas = detalhes.filter((d: any) => d.status === "Quitado").length;

                      return (
                        <div key={contrato.id} className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-foreground">{contrato.tipo_mentoria}</p>
                              <p className="text-xs text-muted-foreground">Início: {formatDate(contrato.data_inicio)}</p>
                            </div>
                            <Badge variant="outline" className={
                              contrato.status_geral === "Quitado" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                              contrato.status_geral === "Atraso" ? "bg-destructive/10 text-destructive border-destructive/20" :
                              "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                            }>
                              {contrato.status_geral}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Valor Total: </span>
                              <span className="text-foreground">{formatCurrency(contrato.valor_total)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Entrada: </span>
                              <span className="text-foreground">{formatCurrency(contrato.entrada_valor)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Total Pago: </span>
                              <span className="text-emerald-400">{formatCurrency(totalPago + (contrato.entrada_valor ?? 0))}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Saldo: </span>
                              <span className="text-primary">{formatCurrency(saldoRestante)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Parcelas: </span>
                              <span className="text-foreground">{parcelasQuitadas}/{detalhes.length}</span>
                            </div>
                          </div>

                          {/* Individual parcels */}
                          <div className="space-y-1 pt-2 border-t border-border/50">
                            {detalhes.sort((a: any, b: any) => a.numero_parcela - b.numero_parcela).map((d: any) => (
                              <div key={d.id} className="flex items-center justify-between text-xs py-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-primary font-medium">#{d.numero_parcela}</span>
                                  <span className="text-muted-foreground">{formatDate(d.data_vencimento)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-foreground">{formatCurrency(d.valor_real ?? d.valor_sugerido)}</span>
                                  <Badge variant="outline" className={`text-[10px] py-0 ${
                                    d.status === "Quitado" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                    d.status === "Atraso" ? "bg-destructive/10 text-destructive border-destructive/20" :
                                    "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                  }`}>
                                    {d.status}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Receitas */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Receitas</h3>
                {(receitas ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma receita encontrada</p>
                ) : (
                  <div className="space-y-2">
                    {(receitas ?? []).map(r => (
                      <div key={r.id} className="rounded-lg border border-border bg-secondary/20 p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-foreground">{r.produto_nome}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(r.data)} • {r.plataforma}</p>
                        </div>
                        <span className="text-sm font-medium text-emerald-400">{formatCurrency(r.valor_bruto)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
