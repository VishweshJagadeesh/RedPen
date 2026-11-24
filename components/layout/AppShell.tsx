"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BellRing, ClipboardCheck, FlaskConical, Home, Menu, Settings, Users, X } from "lucide-react";
import { MockModeBadge } from "@/components/shared/MockModeBadge";
import { cn } from "@/lib/utils";

export interface AppShellProps {
  teacherName: string;
  subject: string;
  mode: "live" | "mock";
  sections: { id: string; name: string }[];
  openFlags: number;
  children: ReactNode;
}

/** Presentational app chrome: sidebar on desktop, slide-over menu on phones. */
export function AppShell({ teacherName, subject, mode, sections, openFlags, children }: AppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = [
    { href: "/dashboard", label: "Home", icon: Home, demoId: "nav-home" },
    { href: "/assessments", label: "Assessments", icon: ClipboardCheck, demoId: "nav-assessments" },
    { href: "/alerts", label: "Needs attention", icon: BellRing, demoId: "nav-alerts", count: openFlags },
    { href: "/evals", label: "Evals", icon: FlaskConical, demoId: "nav-evals" },
    { href: "/settings", label: "Settings", icon: Settings, demoId: "nav-settings" },
  ];
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const links = (
    <nav className="flex flex-col gap-1 text-sm" aria-label="Main">
      {nav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          data-demo-id={item.demoId}
          onClick={() => setOpen(false)}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted",
            isActive(item.href) && "bg-accent font-medium text-accent-foreground",
          )}
        >
          <item.icon className="h-4 w-4" aria-hidden />
          <span className="flex-1">{item.label}</span>
          {item.count ? <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{item.count}</span> : null}
        </Link>
      ))}
      <div className="mt-4 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Sections</div>
      {sections.map((s) => (
        <Link
          key={s.id}
          href={`/sections/${s.id}`}
          data-demo-id={`nav-section-${s.name}`}
          onClick={() => setOpen(false)}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted",
            isActive(`/sections/${s.id}`) && "bg-accent font-medium text-accent-foreground",
          )}
        >
          <Users className="h-4 w-4" aria-hidden />
          Class {s.name}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur lg:hidden">
        <button className="rounded-md p-2 hover:bg-muted" onClick={() => setOpen(true)} aria-label="Open menu" data-demo-id="mobile-menu">
          <Menu className="h-5 w-5" />
        </button>
        <Logo />
        <div className="ml-auto">
          <MockModeBadge mode={mode} />
        </div>
      </header>
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-card p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <Logo />
              <button className="rounded-md p-2 hover:bg-muted" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {links}
          </div>
        </div>
      )}
      <aside className="no-print fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-card p-4 lg:flex">
        <div className="mb-6">
          <Logo />
        </div>
        {links}
        <div className="mt-auto space-y-2 border-t pt-4 text-sm">
          <MockModeBadge mode={mode} />
          <div>
            <div className="font-medium" data-demo-id="teacher-name">{teacherName}</div>
            <div className="text-xs text-muted-foreground">{subject}</div>
          </div>
        </div>
      </aside>
      <main className="lg:pl-60">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}

export function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight" data-demo-id="logo">
      <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">R</span>
      RedPen
    </Link>
  );
}
