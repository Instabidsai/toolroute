"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Route,
  Search,
  Layers,
  Grid3X3,
  Compass,
  Zap,
  LogIn,
  LogOut,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

const links = [
  { href: "/", label: "Home", icon: Route },
  { href: "/tools", label: "Tools", icon: Search },
  { href: "/categories", label: "Categories", icon: Grid3X3 },
  { href: "/composites", label: "Composites", icon: Layers },
  { href: "/discover", label: "Discover", icon: Compass },
];

export function Nav() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

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

          {/* Auth */}
          {user ? (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-text-dim hover:text-text hover:bg-bg-surface transition-colors ml-2"
              title={user.email ?? "Sign out"}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          ) : (
            <Link
              href="/login"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ml-2 ${
                pathname === "/login"
                  ? "bg-accent/15 text-accent"
                  : "text-text-dim hover:text-text hover:bg-bg-surface"
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign in</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
