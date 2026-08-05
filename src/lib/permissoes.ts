export type ModuloDef = { key: string; label: string; setor: string };

/** Módulos controláveis por usuário (a chave é a rota). */
export const MODULOS: ModuloDef[] = [
  { key: "/", label: "Início", setor: "Geral" },
  { key: "/dashboard", label: "Dashboard", setor: "Geral" },
  { key: "/receitas", label: "Receitas", setor: "Financeiro" },
  { key: "/parcelas", label: "Parcelas de Mentoria", setor: "Financeiro" },
  { key: "/despesas-empresa", label: "Despesas Empresa", setor: "Financeiro" },
  { key: "/despesas-pessoal", label: "Despesas Pessoal", setor: "Financeiro" },
  { key: "/dre", label: "DRE", setor: "Financeiro" },
  { key: "/projecao", label: "Projeção", setor: "Financeiro" },
  { key: "/pl-diario", label: "P&L Diário", setor: "Financeiro" },
  { key: "/cofrinho", label: "Cofrinho", setor: "Financeiro" },
  { key: "/dividas", label: "Dívidas", setor: "Financeiro" },
  { key: "/eventos", label: "Eventos Especiais", setor: "Financeiro" },
  { key: "/mentoria", label: "Mentoria", setor: "Mentoria" },
  { key: "/biblioteca", label: "Biblioteca de POP", setor: "Mentoria" },
  { key: "/scripts", label: "Scripts", setor: "Comercial" },
  { key: "/produtos", label: "Nossos Produtos", setor: "Comercial" },
  { key: "/formularios", label: "Formulários", setor: "Comercial" },
  { key: "/clientes", label: "Clientes", setor: "Clientes" },
  { key: "/agenda", label: "Agenda", setor: "Agenda" },
  { key: "/bi", label: "Business Intelligence", setor: "Administração" },
];

export const SETORES_MODULOS = Array.from(new Set(MODULOS.map((m) => m.setor)));
