"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * A thin bar at the top while an in-app link navigation is loading. (The app has no route-level
 * loading.tsx: with one, Next 15.5 intermittently drops client navigations in production builds.)
 * Clicks the draft guard intercepts never reach this listener, so the bar only shows for real navigations.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);

  useEffect(() => setActive(false), [pathname, search]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setActive(true);
    }
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(false), 15000);
    return () => clearTimeout(t);
  }, [active]);

  if (!active) return null;
  return (
    <div className="no-print fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-primary/20" role="progressbar" aria-label="Loading page" data-demo-id="nav-progress">
      <div className="h-full w-1/3 animate-[navprogress_1s_ease-in-out_infinite] bg-primary" />
    </div>
  );
}
