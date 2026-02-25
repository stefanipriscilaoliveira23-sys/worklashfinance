import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ImportRowData {
  data: string;
  produto_nome: string;
  valor_bruto: number;
  taxa_plataforma_valor: number;
  valor_liquido: number;
  cliente_nome: string;
  cliente_email: string;
  forma_pagamento: string;
  moeda_original: string;
  utm_source?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  row: ImportRowData | null;
  onSave: (row: ImportRowData) => void;
}

export function ImportRowEditDialog({ open, onClose, row, onSave }: Props) {
  const [form, setForm] = useState<ImportRowData | null>(null);

  useEffect(() => {
    if (row) setForm({ ...row });
  }, [row]);

  if (!form) return null;

  const set = (key: keyof ImportRowData, value: any) => setForm({ ...form, [key]: value });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Editar venda importada</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-foreground/80">Data</Label>
              <Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} className="bg-secondary/50 border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-foreground/80">Moeda</Label>
              <Select value={form.moeda_original} onValueChange={(v) => set("moeda_original", v)}>
                <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-foreground/80">Produto</Label>
            <Input value={form.produto_nome} onChange={(e) => set("produto_nome", e.target.value)} className="bg-secondary/50 border-border" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-foreground/80">Valor bruto</Label>
              <Input type="number" step="0.01" value={form.valor_bruto || ""} onChange={(e) => set("valor_bruto", Number(e.target.value))} className="bg-secondary/50 border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-foreground/80">Taxa</Label>
              <Input type="number" step="0.01" value={form.taxa_plataforma_valor || ""} onChange={(e) => set("taxa_plataforma_valor", Number(e.target.value))} className="bg-secondary/50 border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-foreground/80">Líquido</Label>
              <Input type="number" step="0.01" value={form.valor_liquido || ""} onChange={(e) => set("valor_liquido", Number(e.target.value))} className="bg-secondary/50 border-border" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-foreground/80">Cliente nome</Label>
              <Input value={form.cliente_nome} onChange={(e) => set("cliente_nome", e.target.value)} className="bg-secondary/50 border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-foreground/80">Cliente email</Label>
              <Input type="email" value={form.cliente_email} onChange={(e) => set("cliente_email", e.target.value)} className="bg-secondary/50 border-border" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-foreground/80">Forma de pagamento</Label>
            <Input value={form.forma_pagamento} onChange={(e) => set("forma_pagamento", e.target.value)} className="bg-secondary/50 border-border" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="border-border text-muted-foreground">Cancelar</Button>
            <Button onClick={() => { onSave(form); onClose(); }} className="gold-gradient text-primary-foreground">Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
