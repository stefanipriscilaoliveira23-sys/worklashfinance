import {
  LayoutDashboard, DollarSign, CalendarCheck, Building2, User, Users, PartyPopper,
  Package, TrendingUp, BarChart3, Settings, LogOut, TrendingUp as Logo, FileSpreadsheet, PiggyBank, Home, Scale, GraduationCap, CalendarDays,
  MessageSquareText, ClipboardList, BookOpen, ListChecks
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth, isAdmin } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter
} from "@/components/ui/sidebar";

type MenuItem = {
  title: string;
  url: string;
  icon: any;
  adminOnly?: boolean;
  roles?: string[];
};

type Setor = { setor: string; items: MenuItem[] };

/** Estrutura por setores. Para criar um setor novo, basta adicionar um bloco aqui. */
const setores: Setor[] = [
  {
    setor: "Geral",
    items: [
      { title: "Início", url: "/", icon: Home },
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, adminOnly: true },
    ],
  },
  {
    setor: "Financeiro",
    items: [
      { title: "Receitas", url: "/receitas", icon: DollarSign },
      { title: "Parcelas de Mentoria", url: "/parcelas", icon: CalendarCheck },
      { title: "Despesas Empresa", url: "/despesas-empresa", icon: Building2, adminOnly: true },
      { title: "Despesas Pessoal", url: "/despesas-pessoal", icon: User, adminOnly: true },
      { title: "DRE", url: "/dre", icon: FileSpreadsheet, adminOnly: true },
      { title: "Projeção", url: "/projecao", icon: TrendingUp, adminOnly: true },
      { title: "P&L Diário", url: "/pl-diario", icon: FileSpreadsheet, adminOnly: true },
      { title: "Cofrinho", url: "/cofrinho", icon: PiggyBank, adminOnly: true },
      { title: "Dívidas", url: "/dividas", icon: Scale, adminOnly: true },
      { title: "Eventos Especiais", url: "/eventos", icon: PartyPopper, adminOnly: true },
    ],
  },
  {
    setor: "Mentoria",
    items: [
      { title: "Mentoria", url: "/mentoria", icon: GraduationCap },
      { title: "Biblioteca de POP", url: "/biblioteca", icon: BookOpen },
    ],
  },
  {
    setor: "Comercial",
    items: [
      { title: "Scripts", url: "/scripts", icon: MessageSquareText },
      { title: "Nossos Produtos", url: "/produtos", icon: Package },
      { title: "Formulários", url: "/formularios", icon: ClipboardList },
    ],
  },
  {
    setor: "Clientes",
    items: [{ title: "Clientes", url: "/clientes", icon: Users }],
  },
  {
    setor: "Agenda",
    items: [{ title: "Agenda", url: "/agenda", icon: CalendarDays }],
  },
];

const adminItems: MenuItem[] = [
  { title: "Business Intelligence", url: "/bi", icon: BarChart3 },
  { title: "Configurações", url: "/config", icon: Settings },
];

export function AppSidebar() {
  const { role, signOut, user } = useAuth();
  const admin = isAdmin(role);

  const podeVer = (item: MenuItem) => {
    if (item.roles) return item.roles.includes(role ?? "");
    return !item.adminOnly || admin;
  };

  const linkClass = "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground";

  return (
    <Sidebar className="border-r border-border bg-sidebar">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gold-gradient">
            <Logo className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold truncate">
              <span className="text-foreground">Escritório</span>{" "}
              <span className="gold-text">Worklash</span>
            </h2>
          </div>
        </div>
      </div>

      <SidebarContent className="px-2 py-4">
        {setores.map((s) => {
          const items = s.items.filter(podeVer);
          if (!items.length) return null;
          return (
            <SidebarGroup key={s.setor}>
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {s.setor}
              </p>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={item.url === "/"}
                          className={linkClass}
                          activeClassName="bg-primary/10 text-primary font-medium"
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {admin && (
          <SidebarGroup>
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Administração
            </p>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={linkClass} activeClassName="bg-primary/10 text-primary font-medium">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 mr-2">
            <p className="text-xs font-medium text-foreground truncate">
              {user?.user_metadata?.display_name || user?.email}
            </p>
            <p className="text-xs text-muted-foreground capitalize">{role}</p>
          </div>
          <button
            onClick={signOut}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
