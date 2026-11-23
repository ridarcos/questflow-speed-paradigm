"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Difficulty, Quest, QuestStats } from "@/lib/quests";
import { computeRouteProfile, routeProfileLabel, type Milestone } from "@/lib/routeProfile";
import { containerClass, mutedText } from "./ui";

interface RouteProfileProps {
  quests: readonly Quest[];
  stats: QuestStats;
  loading: boolean;
}

const TERRAIN_STROKE: Readonly<Record<Difficulty, string>> = {
  easy: "stroke-trail",
  medium: "stroke-slope",
  hard: "stroke-summit",
};

/** La única animación de la app (AC-56): el tramo avanza y el hito se rellena, < 1 s en total. */
const EASE = "cubic-bezier(0.22, 0.75, 0.25, 1)";
const LINE_MS = 620;
const FILL_MS = 320;
const FILL_OVERLAP_MS = 220;

interface Snapshot {
  width: number;
  ids: Set<string>;
  completed: Set<string>;
  walkedLength: number;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function checkPath({ x, y, r }: Milestone): string {
  const p = (dx: number, dy: number) => `${Math.round((x + dx * r) * 100) / 100} ${Math.round((y + dy * r) * 100) / 100}`;
  return `M${p(-0.42, 0.02)} L${p(-0.1, 0.34)} L${p(0.44, -0.3)}`;
}

function animateCompletion(
  svg: SVGSVGElement | null,
  walked: SVGPathElement | null,
  fromLength: number,
  toLength: number,
  ids: readonly string[],
) {
  const grows = walked !== null && toLength - fromLength > 0.5;
  if (grows && walked) {
    const dash = `${toLength} ${toLength}`;
    walked.animate(
      [
        { strokeDasharray: dash, strokeDashoffset: toLength - fromLength },
        { strokeDasharray: dash, strokeDashoffset: 0 },
      ],
      { duration: LINE_MS, easing: EASE },
    );
  }
  for (const id of ids) {
    const fill = svg?.querySelector(`[data-milestone="${CSS.escape(id)}"] [data-milestone-fill]`);
    fill?.animate(
      [
        { transform: "scale(0.25)", opacity: 0 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: FILL_MS, delay: grows ? LINE_MS - FILL_OVERLAP_MS : 0, easing: EASE, fill: "backwards" },
    );
  }
}

/**
 * Perfil de ruta (AC-55): un hito por misión, de la más antigua a la más
 * reciente, sobre una línea de cresta. Los completados se rellenan de marker
 * con contorno contour y check; el tramo recorrido llega hasta el completado
 * más reciente por fecha de creación. Nada del SVG recibe foco ni lleva texto
 * del usuario (solo IDs en data-milestone).
 */
export function RouteProfile({ quests, stats, loading }: RouteProfileProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const walkedRef = useRef<SVGPathElement>(null);
  const previous = useRef<Snapshot | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  // El viewBox se ajusta al tamaño real en píxeles: hitos y trazos no se deforman.
  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (width <= 0 || height <= 0) return;
      setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(
    () => (size ? computeRouteProfile(loading ? [] : quests, size) : null),
    [quests, size, loading],
  );

  // Anima solo la transición de "activa" a "completada" de un hito que ya
  // existía. Carga inicial, filtros, recargas, altas y bajas no se animan.
  useLayoutEffect(() => {
    if (!geometry || loading) return;
    const walked = walkedRef.current;
    const snapshot: Snapshot = {
      width: geometry.width,
      ids: new Set(geometry.milestones.map((m) => m.id)),
      completed: new Set(geometry.milestones.filter((m) => m.completed).map((m) => m.id)),
      walkedLength: walked ? walked.getTotalLength() : 0,
    };
    const prev = previous.current;
    previous.current = snapshot;
    if (!prev || prev.width !== snapshot.width || prefersReducedMotion()) return;
    const newlyCompleted = geometry.milestones
      .filter((m) => m.completed && prev.ids.has(m.id) && !prev.completed.has(m.id))
      .map((m) => m.id);
    if (newlyCompleted.length === 0) return;
    animateCompletion(svgRef.current, walked, prev.walkedLength, snapshot.walkedLength, newlyCompleted);
  }, [geometry, loading]);

  const label = loading ? "Cargando tu ruta" : routeProfileLabel(stats.completed, stats.total, stats.xpEarned);

  return (
    <section
      aria-labelledby="route-heading"
      aria-busy={loading || undefined}
      data-tour="profile"
      className={`${containerClass} grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-3 p-4 sm:p-6 lg:col-span-2`}
    >
      <div className="min-w-0">
        <h2 id="route-heading" className="type-route text-heading font-bold tracking-tight">
          Tu ruta
        </h2>
        <p className={`mt-0.5 text-small ${mutedText}`}>
          {loading ? "Cargando tus misiones…" : `${stats.completed} de ${stats.total} misiones completadas`}
        </p>
      </div>

      <div className="text-right lg:row-span-2 lg:self-end">
        <p className="type-route whitespace-nowrap text-display font-bold tabular-nums">
          {loading ? (
            <>
              <span className="sr-only">Cargando</span>
              <span aria-hidden="true">–</span>
            </>
          ) : (
            stats.xpEarned
          )}
          <span className="ml-1.5 text-title font-semibold">XP</span>
        </p>
        <p className={`text-small ${mutedText}`}>{loading ? " " : `de ${stats.xpAvailable} XP posibles`}</p>
      </div>

      <div ref={chartRef} className="col-span-2 h-28 min-w-0 sm:h-32 lg:col-span-1 lg:h-40">
        <svg
          ref={svgRef}
          role="img"
          aria-label={label}
          viewBox={geometry ? `0 0 ${geometry.width} ${geometry.height}` : "0 0 640 140"}
          preserveAspectRatio="none"
          className="block size-full"
          fill="none"
        >
          {geometry && (
            <>
              <defs>
                <clipPath id="route-relief-clip">
                  <path d={geometry.area} />
                </clipPath>
              </defs>
              {/* Relieve decorativo: superficie y curvas de nivel suaves bajo la cresta. */}
              <g data-layer="relief">
                <path d={geometry.area} className="fill-contour/7" />
                <g clipPath="url(#route-relief-clip)">
                  {geometry.levels.map((y) => (
                    <line key={y} x1={0} x2={geometry.width} y1={y} y2={y} className="stroke-contour/20" strokeWidth={1} />
                  ))}
                </g>
              </g>
              <path
                d={geometry.ridge}
                data-route="ridge"
                className="stroke-ink-soft"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                strokeLinecap="round"
              />
              {geometry.walked && (
                <path
                  ref={walkedRef}
                  d={geometry.walked}
                  data-route="walked"
                  className="stroke-contour"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {!loading &&
                geometry.milestones.map((m) => (
                  <g key={m.id} data-milestone={m.id} data-completed={m.completed ? "true" : "false"} data-terrain={m.difficulty}>
                    <circle cx={m.x} cy={m.y} r={m.r} className="fill-surface" />
                    {m.completed && (
                      <g data-milestone-fill="" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
                        <circle cx={m.x} cy={m.y} r={m.r} className="fill-marker" />
                        {m.r >= 5 && (
                          <path
                            d={checkPath(m)}
                            className="stroke-on-marker"
                            strokeWidth={1.6}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                      </g>
                    )}
                    <circle
                      cx={m.x}
                      cy={m.y}
                      r={m.r}
                      className={m.completed ? "stroke-contour" : TERRAIN_STROKE[m.difficulty]}
                      strokeWidth={m.completed ? 2 : 1.75}
                    />
                  </g>
                ))}
            </>
          )}
        </svg>
      </div>
    </section>
  );
}
