import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { renderTemplate, copyToClipboard, type TemplateContext } from "@/lib/mensagensTemplates";

interface Props {
  open: boolean;
  onClose: () => void;
  context: TemplateContext;
}

export default function ComprovanteDialog({ open, onClose, context }: Props) {
  const handleGerar = async () => {
    const text = renderTemplate("comprovante", context);
    const ok = await copyToClipboard(text);
    if (ok) {
      toast.success("Comprovante copiado! Cole no WhatsApp pra mandar pra cliente.");
    } else {
      toast.error("Não consegui copiar. Tente novamente.");
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Pagamento registrado!</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Quer gerar o comprovante já formatado pra mandar pra cliente?
          </p>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="border-border">
            Agora não
          </Button>
          <Button onClick={handleGerar} className="gold-gradient text-primary-foreground">
            <Copy className="h-4 w-4 mr-1.5" />
            Gerar comprovante
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
