import { accessMapContours } from "@/lib/contours";

const CONTOURS = accessMapContours();

/**
 * Mapa de curvas de nivel del acceso. Es el único patrón de curvas de la app
 * (AC-52): decorativo (aria-hidden) y tenue. contour al 25 % sobre paper claro
 * da 1.41:1 y al 15 % sobre paper oscuro 1.34:1, por debajo del 1.5:1 pedido.
 * `slice` hace que cubra cualquier proporción: franja baja en móvil y columna
 * alta en escritorio.
 */
export function ContourMap({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      data-contour-map=""
      viewBox="0 0 600 600"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      className={`pointer-events-none ${className}`}
    >
      {CONTOURS.map((line, index) => (
        <path
          key={index}
          d={line.d}
          vectorEffect="non-scaling-stroke"
          strokeWidth={line.index ? 1.6 : 1}
          className="stroke-contour/25 dark:stroke-contour/15"
        />
      ))}
    </svg>
  );
}
