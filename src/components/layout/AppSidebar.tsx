import {
  LayoutDashboard, DollarSign, CalendarCheck, Building2, User, Users, PartyPopper,
  Package, TrendingUp, BarChart3, Settings, LogOut, TrendingUp as Logo, FileSpreadsheet, PiggyBank
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth, isAdmin } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter
} from "@/components/ui/sidebar";

const allMenuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, adminOnly: false },
  { title: "Receitas", url: "/receitas", icon: DollarSign, adminOnly: false },
  { title: "Parcelas de Mentoria", url: "/parcelas", icon: CalendarCheck, adminOnly: false },
  { title: "Clientes", url: "/clientes", icon: Users, adminOnly: false },
  { title: "Despesas — Empresa", url: "/despesas-empresa", icon: Building2, adminOnly: true },
  { title: "Despesas — Pessoal", url: "/despesas-pessoal", icon: User, adminOnly: true },
  { title: "Eventos Especiais", url: "/eventos", icon: PartyPopper, adminOnly: true },
  { title: "Produtos e Margem", url: "/produtos", icon: Package, adminOnly: true },
  { title: "Projeção", url: "/projecao", icon: TrendingUp, adminOnly: true },
  { title: "P&L Diário", url: "/pl-diario", icon: FileSpreadsheet, adminOnly: true },
  { title: "Cofrinho", url: "/cofrinho", icon: PiggyBank, adminOnly: true },
];

const adminItems = [
  { title: "Business Intelligence", url: "/bi", icon: BarChart3 },
  { title: "Configurações", url: "/config", icon: Settings },
];

export function AppSidebar() {
  const { role, signOut, user } = useAuth();
  const admin = isAdmin(role);
  const visibleItems = allMenuItems.filter(item => !item.adminOnly || admin);

  return (
    <Sidebar className="border-r border-border bg-sidebar">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gold-gradient">
            <Logo className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold truncate">
              <span className="gold-text">Worklash</span>{" "}
              <span className="text-foreground">Finance</span>
            </h2>
          </div>
        </div>
      </div>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {admin && (
                <>
                  <div className="my-3 mx-3 h-px bg-border" />
                  {adminItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                          activeClassName="bg-primary/10 text-primary font-medium"
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
