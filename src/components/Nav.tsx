"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Route, Search, Layers, Grid3X3, Compass, Zap } from "lucide-react";

const links = [
  { href: "/", label: "Home", icon: Route },
  { href: "/tools", label: "Tools", icon: Search },
  { href: "/categories", label: "Categories", icon: Grid3X3 },
  { href: "/composites", label: "Composites", icon: Layers },
  { href: "/discover", label: "Discover", icon: Compass },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border bg-bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded bg-accent flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight">
            Tool<span className="text-accent">Route</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
                  active
                    ? "bg-accent/15 text-accent"
                    : "text-text-dim hover:text-text hover:bg-bg-surface"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
