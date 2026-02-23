import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, TrendingUp, Shield, User } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function Index() {
  const { session, user, role, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg animate-fade-in">
        <div className="glass-card rounded-xl p-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl gold-gradient shadow-lg shadow-primary/20">
            <TrendingUp className="h-8 w-8 text-primary-foreground" />
          </div>

          <h1 className="mb-2 text-2xl font-bold">
            <span className="gold-text">Worklash</span>{" "}
            <span className="text-foreground">Finance</span>
          </h1>

          <p className="mb-6 text-muted-foreground">
            Bem-vindo(a), {user?.user_metadata?.display_name || user?.email}
          </p>

          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2">
            {role === "admin" ? (
              <Shield className="h-4 w-4 text-primary" />
            ) : (
              <User className="h-4 w-4 text-primary" />
            )}
            <span className="text-sm font-medium text-foreground">
              Perfil: {role === "admin" ? "Administrador" : "Operacional"}
            </span>
          </div>

          <p className="mb-8 text-sm text-muted-foreground">
            O banco de dados está configurado com todas as {" "}
            <span className="text-primary font-medium">13 tabelas</span> e {" "}
            <span className="text-primary font-medium">8 enums</span> do sistema.
            <br />As próximas telas serão construídas nas próximas etapas.
          </p>

          <Button
            onClick={signOut}
            variant="outline"
            className="border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
