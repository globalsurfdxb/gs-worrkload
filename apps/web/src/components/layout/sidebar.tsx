"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { adminNavItems, primaryNavItems, type NavItem } from "./nav-items";

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role);

  return (
    <nav className="flex flex-col gap-1">
      {items
        .filter((item) => !item.roles || (role && item.roles.includes(role)))
        .map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6">
      <Link href="/dashboard" className="flex items-center gap-2 px-1">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-primary-foreground shadow-sm"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))" }}
        >
          GS
        </span>
        <span className="text-base font-semibold">WorkHub</span>
      </Link>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
        <NavList items={primaryNavItems} onNavigate={onNavigate} />
        <div>
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Administration</p>
          <NavList items={adminNavItems} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card px-4 py-6 lg:block">
      <SidebarContent />
    </aside>
  );
}
