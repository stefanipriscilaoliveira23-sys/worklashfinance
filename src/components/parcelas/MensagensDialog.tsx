import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TEMPLATES_META,
  type TemplateKey,
  type TemplateContext,
  renderTemplate,
  copyToClipboard,
} from "@/lib/mensagensTemplates";

interface Props {
  open: boolean;
  onClose: () => void;
  context: TemplateContext;
  /** Default selected template (e.g. "comprovante" no fluxo pós-pagamento). */
  defaultKey?: TemplateKey;
}

export default function MensagensDialog({ open, onClose, context, defaultKey }: Props) {
  const [copiedKey, setCopiedKey] = useState<TemplateKey | null>(null);
  const [previewKey, setPreviewKey] = useState<TemplateKey>(defaultKey ?? "pre_vencimento");

  const handleCopy = async (key: TemplateKey) => {
    const text = renderTemplate(key, context);
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedKey(key);
      toast.success("Mensagem copiada! Cole no WhatsApp.");
      setTimeout(() => setCopiedKey(null), 2000);
    } else {
      toast.error("Não consegui copiar. Copie manualmente abaixo.");
    }
  };

  const previewText = renderTemplate(previewKey, context);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            📋 Mensagens para a cliente
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Clique em uma opção para copiar — todos os campos são preenchidos automaticamente.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
          {/* Lista de templates */}
          <div className="space-y-2 overflow-y-auto pr-1">
            {TEMPLATES_META.map((t) => {
              const isSelected = previewKey === t.key;
              const isCopied = copiedKey === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onMouseEnter={() => setPreviewKey(t.key)}
                  onFocus={() => setPreviewKey(t.key)}
                  onClick={() => handleCopy(t.key)}
                  className={`w-full text-left rounded-lg border p-3 transition-all ${
                    isSelected
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-secondary/30 hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{t.emoji}</span>
                      <span className="text-sm font-medium text-foreground">{t.titulo}</span>
                    </div>
                    {isCopied ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 ml-6">{t.preview}</p>
                </button>
              );
            })}
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-border bg-secondary/20 flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Preview</span>
              <button
                type="button"
                onClick={() => handleCopy(previewKey)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Copy className="h-3 w-3" /> Copiar
              </button>
            </div>
            <ScrollArea className="flex-1 p-3">
              <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                {previewText}
              </pre>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
