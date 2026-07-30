const CORES = [
  "bg-primary/10 text-primary border-primary/30",
  "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  "bg-amber-500/10 text-amber-600 border-amber-500/30",
  "bg-sky-500/10 text-sky-600 border-sky-500/30",
  "bg-destructive/10 text-destructive border-destructive/30",
  "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/30",
];

const ALERTA = "bg-destructive/15 text-destructive border-destructive/40";

function normalizar(tag: string) {
  return tag.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function corDa(tag: string) {
  const n = normalizar(tag);
  if (n.includes("JURIDICO") || n.includes("INADIMPLENTE")) return ALERTA;
  let soma = 0;
  for (let i = 0; i < tag.length; i++) soma += tag.charCodeAt(i);
  return CORES[soma % CORES.length];
}


type Props = { tags?: string[] | null; className?: string };

export default function TagsAluna({ tags, className }: Props) {
  const lista = (tags ?? []).filter(Boolean);
  if (!lista.length) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className ?? "mt-1"}`}>
      {lista.map((t) => (
        <span
          key={t}
          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${corDa(t)}`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}
