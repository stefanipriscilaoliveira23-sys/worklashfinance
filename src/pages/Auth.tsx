import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, LogIn, TrendingUp, MailCheck, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Auth() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [esqueci, setEsqueci] = useState(false);
  const [linkEnviado, setLinkEnviado] = useState(false);
  const { signIn } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) toast.error(error.message);
    setSubmitting(false);
  };

  const enviarLinkDeSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Informe seu e-mail");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setLinkEnviado(true);
  };

  const voltarParaLogin = () => {
    setEsqueci(false);
    setLinkEnviado(false);
    setPassword("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl gold-gradient shadow-lg shadow-primary/20">
            <TrendingUp className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-foreground">Escritório</span>{" "}
            <span className="gold-text">Worklash</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            O escritório digital do seu negócio
          </p>

        </div>

        {/* Card */}
        <div className="glass-card rounded-xl p-8">
          {esqueci ? (
            linkEnviado ? (
              <div className="space-y-5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <MailCheck className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-foreground">Link enviado</p>
                  <p className="text-sm text-muted-foreground">
                    Enviamos um link para <span className="text-foreground">{email}</span>.
                    Abra o e-mail e clique nele para escolher sua senha.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Não chegou em alguns minutos? Confira a caixa de spam.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={voltarParaLogin}
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para o login
                </Button>
              </div>
            ) : (
              <form onSubmit={enviarLinkDeSenha} className="space-y-4">
                <div className="space-y-2 text-center">
                  <p className="font-medium text-foreground">Esqueci minha senha</p>
                  <p className="text-sm text-muted-foreground">
                    Informe seu e-mail e enviamos um link para você escolher uma senha nova.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailRecuperacao" className="text-foreground/80">E-mail</Label>
                  <Input
                    id="emailRecuperacao"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="border-border bg-secondary/50 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full gold-gradient font-semibold text-primary-foreground shadow-lg shadow-primary/20"
                >
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MailCheck className="mr-2 h-4 w-4" />
                  )}
                  Enviar link
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={voltarParaLogin}
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para o login
                </Button>
              </form>
            )
          ) : (
          <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground/80">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="border-border bg-secondary/50 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground/80">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="border-border bg-secondary/50 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full gold-gradient text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              Entrar
            </Button>
          </form>

          {(
            <button
              type="button"
              onClick={() => setEsqueci(true)}
              className="mt-4 w-full text-center text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              Esqueci minha senha
            </button>
          )}
          </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Escritório Worklash © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
