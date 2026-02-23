import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Loader2, Save, Plus, Trash2, Settings, Users, Package, DollarSign, Tag, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Navigate } from "react-router-dom";
import { Constants } from "@/integrations/supabase/types";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function Configuracoes() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("metas");

  if (role !== "admin") return <Navigate to="/" replace />;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-foreground">Configurações</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-secondary/50 border border-border flex-wrap">
          <TabsTrigger value="metas"><DollarSign className="h-3.5 w-3.5 mr-1.5" />Metas</TabsTrigger>
          <TabsTrigger value="prolabore"><Settings className="h-3.5 w-3.5 mr-1.5" />Pro Labore</TabsTrigger>
          <TabsTrigger value="mapeamento"><Package className="h-3.5 w-3.5 mr-1.5" />Mapeamento</TabsTrigger>
          <TabsTrigger value="termos"><Tag className="h-3.5 w-3.5 mr-1.5" />Produto Físico</TabsTrigger>
          <TabsTrigger value="origens"><Globe className="h-3.5 w-3.5 mr-1.5" />Origens</TabsTrigger>
          <TabsTrigger value="cambio"><DollarSign className="h-3.5 w-3.5 mr-1.5" />Câmbio</TabsTrigger>
          <TabsTrigger value="usuarios"><Users className="h-3.5 w-3.5 mr-1.5" />Usuários</TabsTrigger>
        </TabsList>

        <TabsContent value="metas"><MetasTab /></TabsContent>
        <TabsContent value="prolabore"><ProLaboreTab /></TabsContent>
        <TabsContent value="mapeamento"><MapeamentoTab /></TabsContent>
        <TabsContent value="termos"><TermosTab /></TabsContent>
        <TabsContent value="origens"><OrigensTab /></TabsContent>
        <TabsContent value="cambio"><CambioTab /></TabsContent>
        <TabsContent value="usuarios"><UsuariosTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ===== METAS =====
function MetasTab() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [metas, setMetas] = useState<Record<string, string>>({});

  const { data: existingMetas, isLoading } = useQuery({
    queryKey: ["config-metas"],
    queryFn: async () => {
      const { data } = await supabase.from("metas").select("*").order("ano").order("mes");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (existingMetas) {
      const map: Record<string, string> = {};
      existingMetas.forEach(m => { map[`${m.ano}-${m.mes}`] = String(m.valor_meta); });
      setMetas(map);
    }
  }, [existingMetas]);

  const saveMetas = useMutation({
    mutationFn: async () => {
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        const valor = parseFloat(metas[key] ?? "0") || 0;
        const existing = (existingMetas ?? []).find(m => m.ano === d.getFullYear() && m.mes === d.getMonth() + 1);
        if (existing) {
          await supabase.from("metas").update({ valor_meta: valor }).eq("id", existing.id);
        } else {
          await supabase.from("metas").insert({ ano: d.getFullYear(), mes: d.getMonth() + 1, valor_meta: valor });
        }
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["config-metas"] }); toast.success("Metas salvas"); },
    onError: () => toast.error("Erro ao salvar metas"),
  });

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="text-sm font-medium text-foreground">Meta mensal — próximos 12 meses</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 12 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
          const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
          return (
            <div key={key}>
              <Label className="text-xs text-muted-foreground">{MESES[d.getMonth()]} {d.getFullYear()}</Label>
              <Input
                type="number" placeholder="0"
                value={metas[key] ?? ""}
                onChange={e => setMetas(m => ({ ...m, [key]: e.target.value }))}
                className="bg-secondary/50 border-border mt-1"
              />
            </div>
          );
        })}
      </div>
      <Button onClick={() => saveMetas.mutate()} disabled={saveMetas.isPending} className="gold-gradient text-primary-foreground">
        <Save className="h-4 w-4 mr-2" /> Salvar metas
      </Button>
    </div>
  );
}

// ===== PRO LABORE =====
function ProLaboreTab() {
  const queryClient = useQueryClient();
  const [valor, setValor] = useState("");

  const { data: config } = useQuery({
    queryKey: ["config-prolabore"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes").select("*").eq("chave", "pro_labore").maybeSingle();
      return data;
    },
  });

  useEffect(() => { if (config?.valor) setValor(config.valor); }, [config]);

  const save = useMutation({
    mutationFn: async () => {
      if (config) {
        await supabase.from("configuracoes").update({ valor }).eq("id", config.id);
      } else {
        await supabase.from("configuracoes").insert({ chave: "pro_labore", valor });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["config-prolabore"] }); toast.success("Pro labore salvo"); },
    onError: () => toast.error("Erro"),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 max-w-md">
      <h3 className="text-sm font-medium text-foreground">Pro Labore</h3>
      <div>
        <Label className="text-xs text-muted-foreground">Valor fixo mensal</Label>
        <Input type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder="30000" className="bg-secondary/50 border-border mt-1" />
      </div>
      <Button onClick={() => save.mutate()} disabled={save.isPending} className="gold-gradient text-primary-foreground">
        <Save className="h-4 w-4 mr-2" /> Salvar
      </Button>
    </div>
  );
}

// ===== MAPEAMENTO DE PRODUTOS =====
function MapeamentoTab() {
  const queryClient = useQueryClient();
  const { data: produtos } = useQuery({
    queryKey: ["config-produtos"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos_catalogo").select("*").order("nome");
      return data ?? [];
    },
  });

  const { data: configs } = useQuery({
    queryKey: ["config-mapeamento"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes").select("*").like("chave", "map_%");
      return data ?? [];
    },
  });

  const [nomePlataforma, setNomePlataforma] = useState("");
  const [produtoId, setProdutoId] = useState("");

  const addMapping = useMutation({
    mutationFn: async () => {
      if (!nomePlataforma || !produtoId) throw new Error("Preencha ambos os campos");
      await supabase.from("configuracoes").insert({ chave: `map_${nomePlataforma}`, valor: produtoId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config-mapeamento"] });
      toast.success("Mapeamento adicionado");
      setNomePlataforma("");
      setProdutoId("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("configuracoes").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config-mapeamento"] });
      toast.success("Removido");
    },
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="text-sm font-medium text-foreground">Mapeamento de produtos (nome plataforma → catálogo)</h3>
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">Nome na plataforma</Label>
          <Input value={nomePlataforma} onChange={e => setNomePlataforma(e.target.value)} className="bg-secondary/50 border-border mt-1" />
        </div>
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">Produto do catálogo</Label>
          <Select value={produtoId} onValueChange={setProdutoId}>
            <SelectTrigger className="bg-secondary/50 border-border mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {(produtos ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.nome} ({p.categoria})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => addMapping.mutate()} className="gold-gradient text-primary-foreground"><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-2">
        {(configs ?? []).map(c => {
          const prod = (produtos ?? []).find(p => p.id === c.valor);
          return (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
              <div>
                <span className="text-sm font-medium text-foreground">{c.chave.replace("map_", "")}</span>
                <span className="text-xs text-muted-foreground ml-2">→ {prod?.nome ?? c.valor}</span>
              </div>
              <button onClick={() => deleteMapping.mutate(c.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== TERMOS PRODUTO FÍSICO =====
function TermosTab() {
  const queryClient = useQueryClient();
  const [novoTermo, setNovoTermo] = useState("");

  const { data: config } = useQuery({
    queryKey: ["config-termos-fisico"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes").select("*").eq("chave", "termos_produto_fisico").maybeSingle();
      return data;
    },
  });

  const termos: string[] = config?.valor ? JSON.parse(config.valor) : [];

  const save = useMutation({
    mutationFn: async (newTermos: string[]) => {
      const valor = JSON.stringify(newTermos);
      if (config) {
        await supabase.from("configuracoes").update({ valor }).eq("id", config.id);
      } else {
        await supabase.from("configuracoes").insert({ chave: "termos_produto_fisico", valor });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["config-termos-fisico"] }); toast.success("Salvo"); },
  });

  const addTermo = () => {
    if (!novoTermo.trim()) return;
    save.mutate([...termos, novoTermo.trim()]);
    setNovoTermo("");
  };

  const removeTermo = (idx: number) => {
    save.mutate(termos.filter((_, i) => i !== idx));
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 max-w-lg">
      <h3 className="text-sm font-medium text-foreground">Termos que identificam produto físico</h3>
      <p className="text-xs text-muted-foreground">Quando o nome do produto na importação contiver algum desses termos, será sinalizado como "Produto Físico — Pendente Bling".</p>
      <div className="flex gap-2">
        <Input value={novoTermo} onChange={e => setNovoTermo(e.target.value)} placeholder="Ex: WorkLash" className="bg-secondary/50 border-border" onKeyDown={e => e.key === "Enter" && addTermo()} />
        <Button onClick={addTermo} className="gold-gradient text-primary-foreground"><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {termos.map((t, i) => (
          <Badge key={i} variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1.5 pr-1">
            {t}
            <button onClick={() => removeTermo(i)} className="p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-colors"><Trash2 className="h-3 w-3" /></button>
          </Badge>
        ))}
        {termos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum termo cadastrado</p>}
      </div>
    </div>
  );
}

// ===== ORIGENS DE VENDA =====
function OrigensTab() {
  const queryClient = useQueryClient();
  const [novaOrigem, setNovaOrigem] = useState("");

  const { data: origens, isLoading } = useQuery({
    queryKey: ["config-origens"],
    queryFn: async () => {
      const { data } = await supabase.from("origens_venda_opcoes").select("*").order("label");
      return data ?? [];
    },
  });

  const addOrigem = useMutation({
    mutationFn: async () => {
      if (!novaOrigem.trim()) throw new Error("Digite o nome");
      await supabase.from("origens_venda_opcoes").insert({ label: novaOrigem.trim() });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["config-origens"] }); toast.success("Adicionada"); setNovaOrigem(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleOrigem = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      await supabase.from("origens_venda_opcoes").update({ ativo }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["config-origens"] }),
  });

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 max-w-lg">
      <h3 className="text-sm font-medium text-foreground">Origens de venda</h3>
      <div className="flex gap-2">
        <Input value={novaOrigem} onChange={e => setNovaOrigem(e.target.value)} placeholder="Nova origem" className="bg-secondary/50 border-border" onKeyDown={e => e.key === "Enter" && addOrigem.mutate()} />
        <Button onClick={() => addOrigem.mutate()} className="gold-gradient text-primary-foreground"><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-2">
        {(origens ?? []).map(o => (
          <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
            <span className={`text-sm ${o.ativo ? "text-foreground" : "text-muted-foreground line-through"}`}>{o.label}</span>
            <Switch checked={o.ativo} onCheckedChange={v => toggleOrigem.mutate({ id: o.id, ativo: v })} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== CÂMBIO =====
function CambioTab() {
  const queryClient = useQueryClient();
  const [taxa, setTaxa] = useState("");

  const { data: config } = useQuery({
    queryKey: ["config-cambio"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes").select("*").eq("chave", "taxa_cambio_padrao").maybeSingle();
      return data;
    },
  });

  useEffect(() => { if (config?.valor) setTaxa(config.valor); }, [config]);

  const save = useMutation({
    mutationFn: async () => {
      if (config) {
        await supabase.from("configuracoes").update({ valor: taxa }).eq("id", config.id);
      } else {
        await supabase.from("configuracoes").insert({ chave: "taxa_cambio_padrao", valor: taxa });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["config-cambio"] }); toast.success("Taxa salva"); },
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 max-w-md">
      <h3 className="text-sm font-medium text-foreground">Taxa de câmbio padrão (USD → BRL)</h3>
      <p className="text-xs text-muted-foreground">Valor sugerido nas importações de planilha com vendas em USD.</p>
      <Input type="number" step="0.01" value={taxa} onChange={e => setTaxa(e.target.value)} placeholder="5.50" className="bg-secondary/50 border-border" />
      <Button onClick={() => save.mutate()} disabled={save.isPending} className="gold-gradient text-primary-foreground">
        <Save className="h-4 w-4 mr-2" /> Salvar
      </Button>
    </div>
  );
}

// ===== USUÁRIOS =====
function UsuariosTab() {
  const queryClient = useQueryClient();
  const [showNovo, setShowNovo] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [novoRole, setNovoRole] = useState("operacional");

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["config-users"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at");
      return data ?? [];
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["config-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("*");
      return data ?? [];
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      await supabase.from("user_roles").update({ role: newRole as any }).eq("user_id", userId);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["config-roles"] }); toast.success("Role atualizada"); },
    onError: () => toast.error("Erro ao atualizar role"),
  });

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Usuários</h3>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-secondary/30">
            {["Nome", "Email", "Perfil"].map(h => (
              <th key={h} className="p-3 text-xs font-medium text-muted-foreground text-left">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {(profiles ?? []).map(p => {
              const userRole = (roles ?? []).find(r => r.user_id === p.user_id);
              return (
                <tr key={p.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                  <td className="p-3 font-medium">{p.display_name ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{p.email ?? "—"}</td>
                  <td className="p-3">
                    <Select value={userRole?.role ?? "operacional"} onValueChange={v => updateRole.mutate({ userId: p.user_id, newRole: v })}>
                      <SelectTrigger className="w-[140px] bg-secondary/50 border-border h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="operacional">Operacional</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
