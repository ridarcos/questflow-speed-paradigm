import { accessMapContours } from "@/lib/contours";

const CONTOURS = accessMapContours();

/**
 * Mapa de curvas de nivel del acceso. Es el único patrón de curvas de la app
 * (AC-52): decorativo (aria-hidden) y tenue, por debajo del 1.5:1 pedido
 * contra paper: contour al 20 % da 1.31:1 en claro y al 15 % 1.34:1 en oscuro.
 *
 * Desde 1024 px el lema, la descripción y los terrenos van encima del mapa, así
 * que el trazo es también el fondo más oscuro (o más claro, en oscuro) que
 * puede tener ese texto. Los anillos no se cruzan, de modo que ningún píxel
 * pasa del color del trazo: ink-soft conserva 4.73:1 en claro (medido en
 * Chromium; 4.78:1 por cálculo en sRGB) y 6.11:1 en oscuro (QA-014; al 25 % en
 * claro bajaba a 4.43:1).
 *
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
          className="stroke-contour/20 dark:stroke-contour/15"
        />
      ))}
    </svg>
  );
}
