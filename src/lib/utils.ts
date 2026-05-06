import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEuro(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return "€ " + v.toFixed(2).replace(".", ",");
}

export function formatPercent(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return v.toFixed(0) + "%";
}

export function marginColor(margin: number | null | undefined): string {
  if (margin == null) return "text-slate-400";
  if (margin >= 50) return "text-emerald-600";
  if (margin >= 30) return "text-lime-600";
  if (margin >= 15) return "text-amber-600";
  return "text-rose-600";
}
