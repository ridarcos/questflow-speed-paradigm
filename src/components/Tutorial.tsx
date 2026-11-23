"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { hasSeenTutorial, markTutorialSeen } from "@/lib/localFlags";
import {
  clampStep,
  isFirstStep,
  isLastStep,
  nextStep,
  placePanel,
  previousStep,
  RING_OFFSET,
  ringBox,
  roundedRectPath,
  scrollDeltaFor,
  stepLabel,
  TUTORIAL_STEP_COUNT,
  TUTORIAL_STEPS,
  type TourTarget,
} from "@/lib/tutorial";
import { buttonClass, mutedText } from "./ui";

/**
 * Tutorial de 5 pasos (AC-63 a AC-66). Un <dialog> nativo con showModal()
 * (foco atrapado, Esc, fondo inerte) que se coloca junto al elemento real de
 * cada paso (`data-tour`). El destino se resalta con un anillo y el resto de
 * la página queda bajo una niebla tenue; ambos son decorativos y están fuera
 * del diálogo. Sin animaciones: el desplazamiento y la colocación son
 * inmediatos.
 */

interface TutorialContextValue {
  open: boolean;
  /** "Ver tutorial": abre en el paso 1. */
  start: () => void;
  /** El dashboard está listo: abre solo la primera vez para este UID y navegador. */
  requestAutoStart: () => void;
}

/** Botón "Ver tutorial" de la cabecera: recibe el foco al cerrar el tutorial. */
const TUTORIAL_BUTTON_ID = "tutorial-button";

const TutorialContext = createContext<TutorialContextValue | null>(null);

interface TourState {
  open: boolean;
  step: number;
  /** El destino del paso existe y se ve; si no, panel centrado con texto alternativo. */
  hasTarget: boolean;
}

/** Primer elemento con ese `data-tour` que se está mostrando (display: none no tiene cajas). */
function findTourTarget(target: TourTarget): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    if (element.getClientRects().length > 0) return element;
  }
  return null;
}

export function TutorialProvider({ uid, children }: { uid: string | null; children: ReactNode }) {
  const [tour, setTour] = useState<TourState>({ open: false, step: 0, hasTarget: false });
  const autoChecked = useRef(false);

  const show = useCallback((step: number) => {
    const index = clampStep(step);
    setTour({ open: true, step: index, hasTarget: findTourTarget(TUTORIAL_STEPS[index].target) !== null });
  }, []);

  const start = useCallback(() => {
    if (uid) show(0);
  }, [uid, show]);

  const requestAutoStart = useCallback(() => {
    // Una sola comprobación por sesión de este UID (StrictMode llama dos veces).
    if (!uid || autoChecked.current) return;
    autoChecked.current = true;
    if (hasSeenTutorial(uid)) return;
    markTutorialSeen(uid);
    show(0);
  }, [uid, show]);

  // Idempotente: lo llaman los botones de cierre y el evento close (Esc).
  const handleClosed = useCallback(() => {
    if (uid) markTutorialSeen(uid);
    setTour((current) => (current.open ? { ...current, open: false } : current));
    const button = document.getElementById(TUTORIAL_BUTTON_ID);
    if (button && button.getClientRects().length > 0) {
      button.focus();
    } else {
      document.getElementById("quests-heading")?.focus();
    }
  }, [uid]);

  const handleTargetChange = useCallback((hasTarget: boolean) => {
    setTour((current) => (current.hasTarget === hasTarget ? current : { ...current, hasTarget }));
  }, []);

  const value = useMemo<TutorialContextValue>(
    () => ({ open: tour.open, start, requestAutoStart }),
    [tour.open, start, requestAutoStart],
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {uid && (
        <TutorialDialog
          open={tour.open}
          step={tour.step}
          hasTarget={tour.hasTarget}
          onNavigate={show}
          onTargetChange={handleTargetChange}
          onClosed={handleClosed}
        />
      )}
    </TutorialContext.Provider>
  );
}

/** Botón "Ver tutorial" de la cabecera. */
export function TutorialButton() {
  const tutorial = useContext(TutorialContext);
  if (!tutorial) return null;
  return (
    <button
      id={TUTORIAL_BUTTON_ID}
      type="button"
      aria-haspopup="dialog"
      onClick={tutorial.start}
      className={buttonClass("quiet", "sm", "shrink-0")}
    >
      Ver tutorial
    </button>
  );
}

/** El dashboard avisa cuando está listo (lista cargada, sin siembra pendiente ni otro diálogo). */
export function useTutorialAutoStart(ready: boolean): void {
  const request = useContext(TutorialContext)?.requestAutoStart;
  useEffect(() => {
    if (ready) request?.();
  }, [ready, request]);
}

/** Recorrido del tutorial en miniatura: los pasos como hitos de una ruta. Decorativo. */
function StepTrail({ step }: { step: number }) {
  const xs = Array.from({ length: TUTORIAL_STEP_COUNT }, (_, i) => 6 + i * 15);
  const current = clampStep(step);
  return (
    <svg aria-hidden="true" viewBox="0 0 72 12" fill="none" className="h-3 w-[4.5rem] shrink-0">
      <line x1={xs[0]} x2={xs[xs.length - 1]} y1={6} y2={6} className="stroke-line" strokeWidth={1.5} strokeDasharray="2 3" />
      {current > 0 && <line x1={xs[0]} x2={xs[current]} y1={6} y2={6} className="stroke-contour" strokeWidth={2} />}
      {xs.map((x, i) => (
        <circle
          key={x}
          cx={x}
          cy={6}
          r={i === current ? 4.25 : 3.25}
          className={i <= current ? "fill-marker stroke-contour" : "fill-surface stroke-line"}
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}

function paintHighlight(
  ring: HTMLDivElement | null,
  fog: SVGPathElement | null,
  element: HTMLElement | null,
  viewport: { width: number; height: number },
) {
  if (!ring || !fog) return;
  const outer = `M0 0H${viewport.width}V${viewport.height}H0Z`;
  if (!element) {
    ring.hidden = true;
    fog.setAttribute("d", outer);
    return;
  }
  const box = ringBox(element.getBoundingClientRect());
  const ownRadius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
  const radius = Math.min(Math.max(ownRadius, 4) + RING_OFFSET, box.width / 2, box.height / 2);
  ring.hidden = false;
  ring.style.top = `${box.top}px`;
  ring.style.left = `${box.left}px`;
  ring.style.width = `${box.width}px`;
  ring.style.height = `${box.height}px`;
  ring.style.borderRadius = `${radius}px`;
  fog.setAttribute("d", `${outer} ${roundedRectPath(box, radius)}`);
}

interface TutorialDialogProps {
  open: boolean;
  step: number;
  hasTarget: boolean;
  onNavigate: (step: number) => void;
  onTargetChange: (hasTarget: boolean) => void;
  onClosed: () => void;
}

function TutorialDialog({ open, step, hasTarget, onNavigate, onTargetChange, onClosed }: TutorialDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const fogRef = useRef<SVGPathElement>(null);
  const id = useId();
  const index = clampStep(step);
  const current = TUTORIAL_STEPS[index];
  const first = isFirstStep(index);
  const last = isLastStep(index);

  // Abre y cierra el <dialog>. Comprueba dialog.open: en StrictMode el efecto corre dos veces.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      primaryRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Destino al viewport; anillo, niebla y panel en su sitio. Se recoloca al
  // cambiar el tamaño, al desplazar o si cambia el contenido de la página.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const target = current.target;

    const place = (element: HTMLElement | null) => {
      const viewport = { width: document.documentElement.clientWidth, height: window.innerHeight };
      const position = placePanel(
        viewport,
        { width: dialog.offsetWidth, height: dialog.offsetHeight },
        element ? element.getBoundingClientRect() : null,
      );
      dialog.style.top = `${position.top}px`;
      dialog.style.left = `${position.left}px`;
      dialog.dataset.side = position.side;
      paintHighlight(ringRef.current, fogRef.current, element, viewport);
    };

    const element = hasTarget ? findTourTarget(target) : null;
    if (element) {
      element.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
      const delta = scrollDeltaFor(element.getBoundingClientRect(), window.innerHeight, dialog.offsetHeight);
      if (delta !== 0) window.scrollBy({ top: delta, behavior: "instant" });
    }
    place(element);

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const found = findTourTarget(target);
        if ((found !== null) !== hasTarget) {
          onTargetChange(found !== null);
          return;
        }
        place(found);
      });
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    observer.observe(dialog);
    if (element) observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, { capture: true });
      observer.disconnect();
    };
  }, [open, index, hasTarget, current.target, onTargetChange]);

  function close() {
    dialogRef.current?.close();
    onClosed();
  }

  return (
    <>
      {open && (
        <div aria-hidden="true" data-tour-overlay="" className="pointer-events-none fixed inset-0 z-10">
          <svg className="absolute inset-0 size-full" fill="none">
            <path ref={fogRef} fillRule="evenodd" className="fill-paper/70" />
          </svg>
          <div ref={ringRef} hidden className="absolute border-2 border-contour" />
        </div>
      )}
      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-step ${id}-body`}
        onClose={onClosed}
        data-tutorial=""
        className="fixed inset-auto m-0 max-h-[calc(100dvh-1.5rem)] w-[min(24rem,calc(100vw-1.5rem))] max-w-none overflow-y-auto rounded-container border border-line bg-surface p-5 text-ink backdrop:bg-transparent sm:p-6"
      >
        <div aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <p id={`${id}-step`} className={`text-small font-semibold tabular-nums ${mutedText}`}>
              {stepLabel(index)}
            </p>
            <StepTrail step={index} />
          </div>
          <h2 id={`${id}-title`} className="mt-3 font-display text-title font-bold tracking-tight">
            {current.title}
          </h2>
          <p id={`${id}-body`} className="mt-2 text-body text-ink">
            {hasTarget ? current.body : current.fallback}
          </p>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={close} className={buttonClass("quiet", "sm", "mr-auto")}>
            Saltar
          </button>
          <button
            type="button"
            aria-disabled={first || undefined}
            onClick={() => {
              if (!first) onNavigate(previousStep(index));
            }}
            className={buttonClass("secondary")}
          >
            Anterior
          </button>
          <button
            ref={primaryRef}
            type="button"
            onClick={() => (last ? close() : onNavigate(nextStep(index)))}
            className={buttonClass("primary")}
          >
            {last ? "Terminar" : "Siguiente"}
          </button>
        </div>
      </dialog>
    </>
  );
}
