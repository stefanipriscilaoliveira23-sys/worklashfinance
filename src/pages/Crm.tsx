import { ExternalLink, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const CRM_URL = "https://crm.worklash.com.br";

/**
 * A Torre de Controle roda num servidor próprio (crm.worklash.com.br) e
 * aparece aqui dentro.
 * O login dele é separado do Escritório: na primeira vez cada pessoa entra com
 * o e-mail e a senha dela e o navegador guarda a sessão.
 */
export default function Crm() {
  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col gap-3 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" /> Torre de Controle
          </h1>
          <p className="text-sm text-muted-foreground">
            WhatsApp e Instagram da equipe, com funil de vendas. Na primeira vez, entre
            com seu e-mail e senha.
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href={CRM_URL} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1 h-4 w-4" /> Abrir em tela cheia
          </a>
        </Button>
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border border-border bg-card">
        <iframe
          src={CRM_URL}
          title="Torre de Controle"
          className="h-full w-full"
          allow="clipboard-write; microphone"
        />
      </div>
    </div>
  );
}
