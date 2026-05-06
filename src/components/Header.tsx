"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, BookOpen, List, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/",          label: "Zoeker",         icon: Search },
  { href: "/catalogus", label: "Catalogus",      icon: BookOpen },
  { href: "/overzicht", label: "Volledig SKU's", icon: List },
  { href: "/dashboard", label: "Dashboard",      icon: BarChart3 },
];

export default function Header() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 h-16">
        <Link href="/" className="flex flex-col leading-none shrink-0 mr-4">
          <span className="text-[15px] sm:text-[17px] font-black uppercase tracking-[0.15em] text-slate-900">
            Rokers
          </span>
          <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.42em] text-slate-500 mt-1">
            benodigheden — Admin
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2 ml-auto overflow-x-auto scrollbar-none">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-[12px] sm:text-[13px] font-semibold transition-colors whitespace-nowrap",
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
