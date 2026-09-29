import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

type Alvo = { user_id: string; nome: string } | null;

/**
 * Admin define a senha de alguém da equipe, sem depender de e-mail.
 * Quem valida se pode ou não é a função admin-definir-senha no servidor;
 * aqui é só a tela.
 */
export default function DefinirSenhaDialog({
  usuario,
  open,
  onClose,
}: {
  usuario: Alvo;
  open: boolean;
  onClose: () => void;
}) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const fechar = () => {
    setSenha("");
    setConfirmacao("");
    onClose();
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) return;
    if (senha.length < 6) return toast.error("A senha precisa ter pelo menos 6 caracteres");
    if (senha !== confirmacao) return toast.error("As duas senhas não são iguais");

    setSalvando(true);
    const { data, error } = await supabase.functions.invoke("admin-definir-senha", {
      body: { user_id: usuario.user_id, senha },
    });
    setSalvando(false);

    // O supabase-js esconde o corpo da resposta quando o status não é 2xx e
    // devolve só "non-2xx status code", que não diz nada. O motivo de verdade
    // vem dentro de error.context, então lemos ele.
    let motivo = (data as { erro?: string } | null)?.erro ?? null;
    if (!motivo && error) {
      const resposta = (error as { context?: Response }).context;
      if (resposta && typeof resposta.json === "function") {
        try {
          motivo = (await resposta.json())?.erro ?? null;
        } catch {
          /* resposta sem json: cai no genérico abaixo */
        }
      }
    }

    if (error || motivo) {
      toast.error(motivo ?? error?.message ?? "Não consegui definir a senha");
      return;
    }
    toast.success(`Senha de ${usuario.nome} definida. Avise a pessoa no privado.`);
    fechar();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Definir senha de {usuario?.nome}</DialogTitle>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A pessoa passa a entrar com esta senha na hora. Depois ela pode trocar
            sozinha em Configurações, na aba Minha conta.
          </p>
          <div className="space-y-2">
            <Label htmlFor="novaSenha">Senha</Label>
            <Input
              id="novaSenha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="pelo menos 6 caracteres"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmaSenha">Repita a senha</Label>
            <Input
              id="confirmaSenha"
              type="password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={fechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              Definir senha
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
