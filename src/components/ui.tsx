import type { ReactNode } from "react";
import { logoRings } from "@/lib/contours";
import type { Difficulty } from "@/lib/quests";

/**
 * Piezas visuales compartidas del sistema "Ruta". Solo usan tokens de
 * globals.css (paleta, escala de texto y radios). El foco visible es global:
 * contorno de 2 px en contour con 2 px de separación (globals.css).
 */

export type ButtonVariant = "primary" | "secondary" | "danger" | "dangerQuiet" | "quiet";
export type ButtonSize = "md" | "sm";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold select-none disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

const BUTTON_SIZES: Record<ButtonSize, string> = {
  md: "min-h-11 px-5 text-body",
  sm: "min-h-9 px-3 text-small",
};

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // Texto paper sobre contour (nunca blanco): 5.22:1 en claro, 8.67:1 en oscuro.
  primary: "bg-contour text-paper enabled:not-aria-disabled:hover:bg-ink",
  secondary: "border border-line text-ink enabled:not-aria-disabled:hover:bg-ink/5",
  danger: "bg-danger text-paper enabled:not-aria-disabled:hover:bg-ink",
  dangerQuiet: "border border-line text-danger enabled:not-aria-disabled:hover:bg-danger/10",
  quiet: "px-1 text-ink underline decoration-line underline-offset-4 enabled:hover:decoration-ink",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra = ""): string {
  const sizeClass = variant === "quiet" ? (size === "sm" ? "min-h-9 text-small" : "min-h-11 text-body") : BUTTON_SIZES[size];
  return `${BUTTON_BASE} ${sizeClass} ${BUTTON_VARIANTS[variant]} ${extra}`.trim();
}

export const primaryButton = buttonClass("primary");
export const secondaryButton = buttonClass("secondary");

export const fieldClass =
  "mt-1.5 block w-full min-w-0 rounded-control border border-line bg-paper px-3 py-2.5 text-body text-ink placeholder:text-ink-soft aria-[invalid=true]:border-danger";

export const labelClass = "block text-small font-semibold text-ink";

/** Contenedores (paneles y secciones): radio 20 px, borde ink al 10 %, sin sombra. */
export const containerClass = "rounded-container border border-ink/10 bg-surface";

/** Tarjetas: radio 14 px, borde ink al 10 %, sin sombra. */
export const cardClass = "rounded-card border border-ink/10 bg-surface";

/** Texto secundario: ink-soft cumple 6.25:1 o más sobre paper y surface en los dos temas. */
export const mutedText = "text-ink-soft";

/** Color del icono de cada terreno. El texto del terreno siempre va en ink (QA-012). */
export const TERRAIN_COLOR: Readonly<Record<Difficulty, string>> = Object.freeze({
  easy: "text-trail",
  medium: "text-slope",
  hard: "text-summit",
});

/** Icono de terreno: Sendero (camino ondulado), Ladera (loma de dos cimas), Cumbre (pico relleno). */
export function TerrainIcon({ difficulty, className = "size-4" }: { difficulty: Difficulty; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      data-terrain-icon={difficulty}
      className={`shrink-0 ${TERRAIN_COLOR[difficulty]} ${className}`}
    >
      {difficulty === "easy" && (
        <path
          d="M1.25 11.5c1.7 0 2.5-3 4.4-3s2.6 3 4.45 3c1.7 0 2.4-1.75 4.65-1.75"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
      {difficulty === "medium" && (
        <path
          d="M1.25 13.25 6.4 5.6l2.9 3.9 1.85-2.05 3.6 5.8Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      )}
      {difficulty === "hard" && <path d="M1.5 14.25 8 1.75l6.5 12.5Z" fill="currentColor" />}
    </svg>
  );
}

const LOGO_RINGS = logoRings();

/** Logo: tres curvas de nivel y la cima marcada. */
export function Logo({ className = "size-8" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className={`shrink-0 ${className}`}>
      {LOGO_RINGS.map((d, index) => (
        <path
          key={index}
          d={d}
          className="stroke-contour"
          strokeWidth={index === LOGO_RINGS.length - 1 ? 1.7 : 1.35}
          strokeLinejoin="round"
        />
      ))}
      <circle cx="17.5" cy="14.5" r="2.5" className="fill-marker stroke-contour" strokeWidth="1.3" />
    </svg>
  );
}

export function CheckGlyph({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className={`shrink-0 ${className}`}>
      <path d="m3.5 8.4 2.9 2.85L12.6 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Spinner({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={`shrink-0 motion-safe:animate-spin ${className}`}>
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2.5" opacity="0.3" />
      <path d="M21.5 12A9.5 9.5 0 0 0 12 2.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function AlertGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="mt-px size-5 shrink-0 text-danger">
      <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 5.6v5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="14.2" r="1.05" fill="currentColor" />
    </svg>
  );
}

/** Mensaje de error accesible (role="alert") con acción opcional. Dice qué pasó y cómo seguir. */
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
      className={`flex flex-col gap-3 rounded-card border border-danger bg-surface p-4 text-small text-ink sm:flex-row sm:items-start sm:justify-between ${className}`}
    >
      <div className="flex min-w-0 gap-3">
        <AlertGlyph />
        <div className="min-w-0 wrap-anywhere">
          {title && <p className="font-semibold text-ink">{title}</p>}
          <div className={title ? "mt-0.5 text-ink-soft" : "text-ink"}>{children}</div>
        </div>
      </div>
      {action && <div className="shrink-0 sm:pl-2">{action}</div>}
    </div>
  );
}
