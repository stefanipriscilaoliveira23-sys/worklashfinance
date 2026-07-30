import ProcessosTab from "@/components/mentoria/ProcessosTab";
import { ListChecks } from "lucide-react";

export default function Processos() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ListChecks className="h-6 w-6 text-primary" /> Processos
        </h1>
        <p className="text-sm text-muted-foreground">
          Checklists por etapa da jornada, aplicados automaticamente às mentoradas.
        </p>
      </div>
      <ProcessosTab />
    </div>
  );
}
