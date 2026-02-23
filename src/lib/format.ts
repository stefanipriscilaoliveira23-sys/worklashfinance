export function formatCurrency(value: number | null | undefined, currency = "BRL"): string {
  const v = value ?? 0;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR");
}

export function formatPercent(value: number | null | undefined): string {
  const v = value ?? 0;
  return `${v.toFixed(1)}%`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = getDaysInMonth(year, month);
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function getWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { start: fmt(startOfWeek), end: fmt(endOfWeek) };
}
