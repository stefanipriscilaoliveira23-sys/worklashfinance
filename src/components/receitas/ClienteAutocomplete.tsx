import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Plus, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ClienteAutocompleteProps {
  value: string;
  onChange: (nome: string, email: string) => void;
  className?: string;
}

export function ClienteAutocomplete({ value, onChange, className }: ClienteAutocompleteProps) {
  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setInputValue(value); }, [value]);

  const { data: clientes } = useQuery({
    queryKey: ["clientes-autocomplete"],
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome, email").order("nome");
      return data ?? [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({ nome, email }: { nome: string; email: string }) => {
      const { error } = await supabase.from("clientes").insert({ nome, email: email || null });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["clientes-autocomplete"] });
      toast.success("Cliente adicionado!");
      onChange(vars.nome, vars.email);
      setInputValue(vars.nome);
      setAddingNew(false);
      setShowDropdown(false);
    },
    onError: (e) => toast.error("Erro: " + (e as Error).message),
  });

  const filtered = (clientes ?? []).filter(c =>
    c.nome.toLowerCase().includes(inputValue.toLowerCase())
  );

  const hasExactMatch = filtered.some(c => c.nome.toLowerCase() === inputValue.toLowerCase());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setAddingNew(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowDropdown(true);
            setAddingNew(false);
            onChange(e.target.value, "");
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Buscar cliente..."
          className={`pl-9 bg-secondary/50 border-border ${className}`}
        />
      </div>

      {showDropdown && (inputValue.length > 0 || addingNew) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {addingNew ? (
            <div className="p-3 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Novo cliente</p>
              <Input
                placeholder="Nome *"
                value={newNome}
                onChange={(e) => setNewNome(e.target.value)}
                className="bg-secondary/50 border-border h-8 text-sm"
                autoFocus
              />
              <Input
                placeholder="Email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bg-secondary/50 border-border h-8 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setAddingNew(false)}
                  className="px-3 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (!newNome.trim()) { toast.error("Nome obrigatório"); return; }
                    addMutation.mutate({ nome: newNome.trim(), email: newEmail.trim() });
                  }}
                  disabled={addMutation.isPending}
                  className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1"
                >
                  {addMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  Salvar
                </button>
              </div>
            </div>
          ) : (
            <>
              {filtered.length > 0 ? (
                filtered.slice(0, 10).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onChange(c.nome, c.email ?? "");
                      setInputValue(c.nome);
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 transition-colors flex justify-between items-center"
                  >
                    <span className="text-foreground">{c.nome}</span>
                    {c.email && <span className="text-xs text-muted-foreground truncate ml-2">{c.email}</span>}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum cliente encontrado</p>
              )}
              {!hasExactMatch && inputValue.trim().length > 0 && (
                <button
                  onClick={() => {
                    setNewNome(inputValue.trim());
                    setNewEmail("");
                    setAddingNew(true);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 transition-colors flex items-center gap-2 text-primary border-t border-border"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar "{inputValue.trim()}"
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
