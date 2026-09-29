import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, KeyRound, Bell, BellOff, Smartphone } from "lucide-react";
import { ativarPush, desativarPush, situacaoPush, type SituacaoPush } from "@/lib/push";

/** Qualquer pessoa troca a própria senha por aqui, sem passar por e-mail. */
export default function MinhaContaTab() {
  const { user } = useAuth();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [push, setPush] = useState<SituacaoPush | null>(null);
  const [mexendoPush, setMexendoPush] = useState(false);

  useEffect(() => {
    situacaoPush().then(setPush).catch(() => setPush("sem_suporte"));
  }, []);

  const alternarPush = async () => {
    setMexendoPush(true);
    try {
      if (push === "ativo") {
        await desativarPush();
        toast.success("Notificações desligadas neste aparelho.");
      } else {
        await ativarPush();
        toast.success("Pronto! Este aparelho vai receber os avisos.");
      }
      setPush(await situacaoPush());
    } catch (e) {
      toast.error((e as Error).message);
      setPush(await situacaoPush());
    } finally {
      setMexendoPush(false);
    }
  };

  const trocar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nova.length < 6) return toast.error("A senha nova precisa ter pelo menos 6 caracteres");
    if (nova !== confirmacao) return toast.error("A senha nova e a confirmação não são iguais");
    if (!user?.email) return toast.error("Não achei seu e-mail de login");

    setSalvando(true);

    // Confere a senha atual antes de trocar. Sem isso, quem pegasse o
    // computador destravado trocaria a senha sem saber a antiga.
    const { error: erroConfere } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: atual,
    });
    if (erroConfere) {
      setSalvando(false);
      toast.error("A senha atual está errada");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: nova });
    setSalvando(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    setAtual("");
    setNova("");
    setConfirmacao("");
    toast.success("Senha trocada.");
  };

  return (
    <div className="max-w-md space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-1 text-sm font-medium text-foreground">Trocar minha senha</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Você está logada como {user?.email ?? "—"}.
        </p>
        <form onSubmit={trocar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="atual">Senha atual</Label>
            <Input
              id="atual"
              type="password"
              value={atual}
              onChange={(e) => setAtual(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nova">Senha nova</Label>
            <Input
              id="nova"
              type="password"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              placeholder="pelo menos 6 caracteres"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirma">Repita a senha nova</Label>
            <Input
              id="confirma"
              type="password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={salvando}>
            {salvando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-4 w-4" />
            )}
            Trocar senha
          </Button>
        </form>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-1 flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Notificações no celular</h3>
        </div>

        {push === "precisa_instalar" && (
          <div className="space-y-2 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5 text-foreground">
              <Smartphone className="h-3.5 w-3.5" /> Falta instalar o app na tela de início
            </p>
            <p>
              No iPhone, a Apple só entrega notificação para app instalado. No Safari
              comum não aparece a opção, e não é defeito do nosso app.
            </p>
            <ol className="ml-4 list-decimal space-y-1">
              <li>Abra este site no Safari</li>
              <li>Toque no botão de compartilhar, o quadradinho com a seta para cima</li>
              <li>Escolha <span className="text-foreground">Adicionar à Tela de Início</span></li>
              <li>Abra o app por esse ícone novo e volte aqui</li>
            </ol>
          </div>
        )}

        {push === "sem_suporte" && (
          <p className="text-xs text-muted-foreground">
            Este navegador não trabalha com notificação. Tente pelo Chrome ou pelo
            Safari com o app instalado na tela de início.
          </p>
        )}

        {push === "negado" && (
          <p className="text-xs text-muted-foreground">
            As notificações foram bloqueadas para este site. Para liberar, vá nos
            ajustes do navegador, procure as permissões deste site e mude
            Notificações para Permitir.
          </p>
        )}

        {(push === "pronto" || push === "ativo") && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {push === "ativo"
                ? "Este aparelho está recebendo os avisos. Cada aparelho é ligado separado."
                : "Ligue para receber no celular os mesmos avisos que aparecem no sininho."}
            </p>
            <Button
              variant={push === "ativo" ? "outline" : "default"}
              onClick={alternarPush}
              disabled={mexendoPush}
            >
              {mexendoPush ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : push === "ativo" ? (
                <BellOff className="mr-2 h-4 w-4" />
              ) : (
                <Bell className="mr-2 h-4 w-4" />
              )}
              {push === "ativo" ? "Desligar neste aparelho" : "Ativar neste aparelho"}
            </Button>
          </div>
        )}

        {push === null && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
}
