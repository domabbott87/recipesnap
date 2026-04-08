import { Link, useLocation } from "wouter";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sun, Moon, BookOpen, Camera, Grid3X3, UserCircle2 } from "lucide-react";

interface LayoutProps { children: React.ReactNode; }

function Logo() {
  return (
    <Link href="/">
      <a className="flex items-center gap-0 group" data-testid="link-home">
        <div className="border-2 border-foreground px-2.5 py-1 rounded-sm group-hover:border-primary group-hover:text-primary transition-colors">
          <span className="font-bold text-base leading-none tracking-tight">RecipeSnap</span>
        </div>
      </a>
    </Link>
  );
}

export function Layout({ children }: LayoutProps) {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const [location] = useLocation();

  const navLinks = [
    { href: "/", label: "Recipes", icon: BookOpen },
    { href: "/collections", label: "Collections", icon: Grid3X3 },
    { href: "/profile", label: user?.name?.split(" ")[0] ?? "Account", icon: UserCircle2 },
  ];

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Logo />
          <nav className="flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = location === href;
              return (
                <Link key={href} href={href}>
                  <a className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                    active ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}>
                    <Icon size={14} />
                    {label}
                  </a>
                </Link>
              );
            })}
            <Link href="/snap">
              <a className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ml-1 ${
                location === "/snap" ? "bg-primary/90 text-white" : "bg-primary text-white hover:bg-primary/90"
              }`}>
                <Camera size={14} />
                <span className="hidden sm:inline">Snap</span>
              </a>
            </Link>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme"
              data-testid="button-theme-toggle"
              className="ml-1 text-muted-foreground hover:text-foreground rounded-full">
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* ── Bottom tab bar (mobile only) ──────────────────────────────────── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border">
        <div
          className="flex items-end px-2"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
        >
          {/* Recipes */}
          <MobileTab href="/" label="Recipes" icon={BookOpen} active={location === "/"} />

          {/* Collections */}
          <MobileTab href="/collections" label="Collections" icon={Grid3X3} active={location === "/collections"} />

          {/* Hero Snap — centre */}
          <div style={{ flex: 1 }} className="flex flex-col items-center justify-end pb-1">
            <Link href="/snap">
              <a className="flex flex-col items-center gap-1">
                <div className={`w-13 h-13 rounded-full flex items-center justify-center shadow-lg transition-all ${
                  location === "/snap"
                    ? "bg-primary/80 shadow-primary/20 scale-95"
                    : "bg-primary shadow-primary/40"
                }`}
                  style={{ width: 52, height: 52, marginTop: -20 }}
                >
                  <Camera size={22} className="text-white" />
                </div>
                <span className={`text-[10px] font-bold leading-none ${location === "/snap" ? "text-primary" : "text-muted-foreground"}`}>
                  Snap
                </span>
              </a>
            </Link>
          </div>

          {/* Account */}
          <MobileTab href="/profile" label={user?.name?.split(" ")[0] ?? "Account"} icon={UserCircle2} active={location === "/profile"} />
        </div>
      </nav>
    </div>
  );
}

function MobileTab({
  href, label, icon: Icon, active,
}: {
  href: string; label: string; icon: any; active: boolean;
}) {
  return (
    <Link href={href} style={{ flex: 1 }}>
      <a className="flex flex-col items-center gap-0.5 py-2 relative">
        {/* Active pill background under icon */}
        <div className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
          active ? "bg-primary/12" : ""
        }`}>
          <Icon
            size={22}
            className={active ? "text-primary" : "text-muted-foreground"}
            strokeWidth={active ? 2.5 : 1.8}
          />
          <span className={`text-[10px] font-bold leading-none ${
            active ? "text-primary" : "text-muted-foreground"
          }`}>
            {label}
          </span>
        </div>
        {/* Active dot indicator at bottom */}
        {active && (
          <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary" />
        )}
      </a>
    </Link>
  );
}
