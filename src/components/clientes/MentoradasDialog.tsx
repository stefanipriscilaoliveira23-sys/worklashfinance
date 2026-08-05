import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, GraduationCap } from "lucide-react";

export default function MentoradasDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busca, setBusca] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["clientes-mentoradas-lista"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentoradas")
        .select("id, nome, email, telefone, programa, status_jornada, valor_mentoria, data_inicio, data_termino")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const lista = (data ?? []).filter((m) =>
    `${m.nome} ${m.email ?? ""} ${m.programa ?? ""}`.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" /> Mentoradas ({lista.length})
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 bg-secondary/50 border-border" placeholder="Buscar mentorada" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-y-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-secondary/60 backdrop-blur">
                <tr className="border-b border-border">
                  {["Nome", "Contato", "Programa", "Status", "Início", "Término", "Valor"].map((h) => (
                    <th key={h} className="p-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((m) => (
                  <tr key={m.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                    <td className="p-3 font-medium">{m.nome}</td>
                    <td className="p-3 text-muted-foreground text-xs">{m.email || m.telefone || "—"}</td>
                    <td className="p-3 text-muted-foreground">{m.programa}</td>
                    <td className="p-3"><Badge variant="outline">{m.status_jornada}</Badge></td>
                    <td className="p-3 text-muted-foreground">{formatDate(m.data_inicio)}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(m.data_termino)}</td>
                    <td className="p-3">{m.valor_mentoria ? formatCurrency(m.valor_mentoria) : "—"}</td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhuma mentorada encontrada</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
