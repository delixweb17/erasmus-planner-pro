import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  LayoutDashboard,
  Map as MapIcon,
  LogOut,
  MessageCircle,
  Moon,
  PiggyBank,
  Plane,
  Receipt,
  Settings,
  Sun,
} from "lucide-react";
import type { ReactNode } from "react";
import { useConfirm } from "@/components/Confirm";
import { useAuth } from "@/data/auth";
import { useChat } from "@/data/chat";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Painel", icon: LayoutDashboard, exact: true },
  { to: "/viagens", label: "Viagens", icon: Plane },
  { to: "/despesas", label: "Despesas", icon: Receipt },
  { to: "/poupanca", label: "Poupança", icon: PiggyBank },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/calendario", label: "Calendário", icon: CalendarDays },
  { to: "/mapa", label: "Mapa", icon: MapIcon },
] as const;

// No telemóvel não cabem todos: o Mapa sai da barra (abre-se a partir das Viagens).
const NAV_MOBILE = NAV.filter((n) => n.to !== "/mapa");

function UnreadBadge({ className }: { className?: string }) {
  const { unread } = useChat();
  if (unread === 0) return null;
  return (
    <span
      className={cn(
        "tabular inline-flex min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4.5 text-primary-foreground",
        className,
      )}
    >
      {unread > 99 ? "99+" : unread}
    </span>
  );
}

function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className={cn(
        "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function SignOutButton({ className }: { className?: string }) {
  const { signOut, email } = useAuth();
  const confirm = useConfirm();
  return (
    <button
      type="button"
      onClick={async () => {
        if (await confirm({ title: "Sair da conta?", description: email ?? undefined, confirmLabel: "Sair" }))
          void signOut();
      }}
      aria-label="Sair da conta"
      title="Sair da conta"
      className={cn(
        "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      <LogOut className="size-4" />
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      {/* Barra lateral (desktop) */}
      <aside className="hidden border-r border-sidebar-border bg-sidebar lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="px-6 pt-7 pb-6">
          <Link to="/" className="block">
            <p className="eyebrow">Erasmus · Pisa</p>
            <h1 className="mt-1 text-2xl font-semibold text-sidebar-foreground">
              Semestre 27/28
            </h1>
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map(({ to, label, icon: Icon, ...rest }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: "exact" in rest && rest.exact }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-primary"
            >
              <Icon className="size-4" />
              {label}
              {to === "/chat" && <UnreadBadge className="ml-auto" />}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-between border-t border-sidebar-border px-4 py-3">
          <Link
            to="/definicoes"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent data-[status=active]:text-sidebar-primary"
          >
            <Settings className="size-4" /> Definições
          </Link>
          <div className="flex items-center">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Cabeçalho (mobile) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/">
          <p className="eyebrow">Erasmus · Pisa</p>
          <p className="font-display text-lg font-semibold leading-tight">Semestre 27/28</p>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            to="/definicoes"
            aria-label="Definições"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
          >
            <Settings className="size-4" />
          </Link>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <main className="min-w-0 pb-24 lg:pb-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>

      {/* Navegação inferior (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t bg-background/90 backdrop-blur lg:hidden">
        {NAV_MOBILE.map(({ to, label, icon: Icon, ...rest }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: "exact" in rest && rest.exact }}
            className="relative flex flex-col items-center gap-1 py-2 text-[10px] font-medium text-muted-foreground data-[status=active]:text-primary"
          >
            <Icon className="size-5" />
            {label}
            {to === "/chat" && <UnreadBadge className="absolute left-1/2 top-1 ml-1.5" />}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="fade-up mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
