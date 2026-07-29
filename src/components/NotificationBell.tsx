import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";

function tempoRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: notificacoes, isLoading } = useQuery({
    queryKey: ["notificacoes", user?.id],
    enabled: !!user?.id,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const naoLidas = (notificacoes ?? []).filter((n) => !n.lida);

  const marcarLida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

  const marcarTodas = useMutation({
    mutationFn: async () => {
      const ids = naoLidas.map((n) => n.id);
      if (!ids.length) return;
      const { error } = await supabase.from("notificacoes").update({ lida: true }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notificações"
          className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
        >
          <Bell className="h-5 w-5" />
          {naoLidas.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {naoLidas.length > 9 ? "9+" : naoLidas.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold">Notificações</p>
          {naoLidas.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => marcarTodas.mutate()}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="p-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (notificacoes ?? []).length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma notificação por aqui.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(notificacoes ?? []).map((n) => (
                <li key={n.id}>
                  <button
                    className={`w-full text-left px-4 py-3 hover:bg-surface-hover transition-colors ${
                      n.lida ? "opacity-60" : ""
                    }`}
                    onClick={() => {
                      if (!n.lida) marcarLida.mutate(n.id);
                      if (n.link_interno) {
                        setOpen(false);
                        navigate(n.link_interno);
                      }
                    }}
                  >
                    <div className="flex items-start gap-2">
                      {!n.lida && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{n.titulo}</p>
                        {n.descricao && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{n.descricao}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-1">{tempoRelativo(n.created_at)}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
