import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, KeyRound, TrendingUp } from "lucide-react";

// Capturado assim que o arquivo carrega, ANTES do supabase-js limpar a URL.
// O link do e-mail chega como .../redefinir-senha#access_token=...&refresh_token=...
const URL_INICIAL =
  typeof window !== "undefined"
    ? { hash: window.location.hash, busca: window.location.search }
    : { hash: "", busca: "" };

function lerTokens() {
  const h = new URLSearchParams(URL_INICIAL.hash.replace(/^#/, ""));
  const q = new URLSearchParams(URL_INICIAL.busca);
  return {
    access: h.get("access_token"),
    refresh: h.get("refresh_token"),
    code: q.get("code"),
    erro:
      h.get("error_description") ||
      h.get("error") ||
      q.get("error_description") ||
      q.get("error"),
  };
}

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [pronto, setPronto] = useState(false);
  const [semLink, setSemLink] = useState<string | null>(null);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    let achou = false;

    const aceitar = () => {
      achou = true;
      if (!vivo) return;
      setPronto(true);
      setSemLink(null);
    };

    const { access, refresh, code, erro } = lerTokens();

    if (erro) {
      setSemLink(
        /expired|invalid/i.test(erro)
          ? "Este link já foi usado ou expirou."
          : erro
      );
      return;
    }

    // Caminho principal: token veio na URL, então firmamos a sessão na mão.
    if (access && refresh) {
      supabase.auth
        .setSession({ access_token: access, refresh_token: refresh })
        .then(({ error }) => {
          if (!vivo) return;
          if (error) setSemLink("Este link já foi usado ou expirou.");
          else aceitar();
        });
    } else if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!vivo) return;
        if (error) setSemLink("Este link já foi usado ou expirou.");
        else aceitar();
      });
    }

    // Rede de segurança: se a biblioteca firmar a sessão por conta própria.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sessao) => {
      if (sessao) aceitar();
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) aceitar();
    });

    const desistir = setTimeout(async () => {
      if (!vivo || achou) return;
      const { data } = await supabase.auth.getSession();
      if (!vivo || achou) return;
      if (data.session) aceitar();
      else setSemLink("Este link já foi usado ou expirou.");
    }, 10000);

    return () => {
      vivo = false;
      clearTimeout(desistir);
      sub.subscription.unsubscribe();
    };
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres");
      return;
    }
    if (senha !== confirmacao) {
      toast.error("As duas senhas não são iguais");
      return;
    }
    setSalvando(true);

    let { error } = await supabase.auth.updateUser({ password: senha });

    // Se a sessão sumiu no meio do caminho, refazemos com o token da URL e
    // tentamos de novo, uma vez.
    if (error && /session/i.test(error.message)) {
      const { access, refresh } = lerTokens();
      if (access && refresh) {
        const nova = await supabase.auth.setSession({
          access_token: access,
          refresh_token: refresh,
        });
        if (!nova.error) {
          ({ error } = await supabase.auth.updateUser({ password: senha }));
        }
      }
    }

    setSalvando(false);

    if (error) {
      if (/session/i.test(error.message)) {
        setSemLink(
          "A sessão deste link se perdeu. Peça um link novo e abra ele no mesmo navegador."
        );
      } else {
        toast.error(error.message);
      }
      return;
    }

    toast.success("Senha criada! Bem-vinda ao Escritório.");
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl gold-gradient shadow-lg shadow-primary/20">
            <TrendingUp className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-foreground">Escritório</span>{" "}
            <span className="gold-text">Worklash</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Escolha sua senha</p>
        </div>

        <div className="glass-card rounded-xl p-8">
          {semLink ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">{semLink}</p>
              <Button
                onClick={() => navigate("/auth", { replace: true })}
                className="w-full gold-gradient font-semibold text-primary-foreground"
              >
                Pedir um link novo
              </Button>
            </div>
          ) : !pronto ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <form onSubmit={salvar} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="senha" className="text-foreground/80">Nova senha</Label>
                <Input
                  id="senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="pelo menos 6 caracteres"
                  required
                  minLength={6}
                  className="border-border bg-secondary/50 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmacao" className="text-foreground/80">Repita a senha</Label>
                <Input
                  id="confirmacao"
                  type="password"
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="border-border bg-secondary/50 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20"
                />
              </div>
              <Button
                type="submit"
                disabled={salvando}
                className="w-full gold-gradient font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-shadow hover:shadow-primary/30"
              >
                {salvando ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 h-4 w-4" />
                )}
                Salvar e entrar
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Escritório Worklash © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
