import type { ReactNode } from "react";
import type { Difficulty } from "@/lib/quests";

/** Clases compartidas para mantener foco visible y contraste coherentes (AC-25). */

export const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-slate-900";

export const primaryButton = `inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

export const secondaryButton = `inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 ${focusRing}`;

export const fieldClass = `mt-1 block w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm placeholder:text-slate-500 focus:border-indigo-600 aria-[invalid=true]:border-red-600 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:aria-[invalid=true]:border-red-400 ${focusRing}`;

export const cardClass =
  "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

/** Texto secundario: slate-600 / slate-400 cumplen 4.5:1 sobre los fondos usados. */
export const mutedText = "text-slate-600 dark:text-slate-400";

export const DIFFICULTY_STYLES: Readonly<
  Record<Difficulty, { badge: string; accent: string; choice: string; dot: string }>
> = {
  easy: {
    badge: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800",
    accent: "border-l-emerald-500 dark:border-l-emerald-500",
    choice: "has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 dark:has-[:checked]:border-emerald-500 dark:has-[:checked]:bg-emerald-950/60",
    dot: "bg-emerald-500",
  },
  medium: {
    badge: "bg-amber-100 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
    accent: "border-l-amber-500 dark:border-l-amber-500",
    choice: "has-[:checked]:border-amber-600 has-[:checked]:bg-amber-50 dark:has-[:checked]:border-amber-500 dark:has-[:checked]:bg-amber-950/60",
    dot: "bg-amber-500",
  },
  hard: {
    badge: "bg-rose-100 text-rose-900 ring-1 ring-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-800",
    accent: "border-l-rose-500 dark:border-l-rose-500",
    choice: "has-[:checked]:border-rose-600 has-[:checked]:bg-rose-50 dark:has-[:checked]:border-rose-500 dark:has-[:checked]:bg-rose-950/60",
    dot: "bg-rose-500",
  },
};

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={`motion-safe:animate-spin ${className}`}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Mensaje de error accesible (role="alert") con acción opcional. */
export function ErrorBox({
  title,
  children,
  action,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex flex-col gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-start sm:justify-between dark:border-red-800 dark:bg-red-950/50 dark:text-red-100 ${className}`}
    >
      <div className="min-w-0 wrap-anywhere">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? "mt-0.5" : ""}>{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
