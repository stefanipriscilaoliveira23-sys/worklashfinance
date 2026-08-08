import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  // remove leading zeros
  digits = digits.replace(/^0+/, "");
  // add Brazilian country code when missing
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 12) return null;
  return digits;
}

interface Props {
  phone?: string | null;
  nome?: string | null;
  message?: string;
  className?: string;
  size?: "icon" | "sm";
  label?: string;
}

export default function WhatsAppButton({ phone, nome, message, className, size = "icon", label }: Props) {
  const num = normalizePhone(phone);

  const abrir = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!num) {
      toast.error(nome ? `${nome} não tem WhatsApp cadastrado` : "Sem WhatsApp cadastrado");
      return;
    }
    const texto = message ?? `Oi${nome ? `, ${String(nome).split(" ")[0]}` : ""}! Tudo bem?`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={num ? "Chamar no WhatsApp" : "Sem WhatsApp cadastrado"}
      onClick={abrir}
      className={`${size === "icon" ? "h-7 w-7 p-0" : "h-7 px-2 gap-1.5"} ${
        num ? "text-emerald-500 hover:text-emerald-400" : "text-muted-foreground/40"
      } ${className ?? ""}`}
    >
      <MessageCircle className="h-3.5 w-3.5" />
      {size === "sm" && <span className="text-xs">{label ?? "WhatsApp"}</span>}
    </Button>
  );
}
