"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EMPTY_DRAFT, restoreNeedsConfirmation, type FormDraft } from "@/lib/formDraft";
import { focusTargetAfterRemoval } from "@/lib/listFocus";
import {
  computeStats,
  filterQuests,
  FILTER_LABELS,
  QUEST_FILTERS,
  type Quest,
  type QuestFilter,
  type QuestInput,
  type QuestStats,
} from "@/lib/quests";
import {
  createQuest,
  deleteQuest,
  setQuestCompleted,
  subscribeToQuests,
  translateFirestoreError,
  updateQuest,
} from "@/lib/questsRepo";
import { addNotice, lateErrorNotice, removeNotice, type LateWrite, type SyncNotice } from "@/lib/syncNotices";
import { runWrite } from "@/lib/writes";
import { ConfirmDialog } from "./ConfirmDialog";
import { QuestForm } from "./QuestForm";
import { QuestItem } from "./QuestItem";
import { RouteProfile } from "./RouteProfile";
import { buttonClass, cardClass, containerClass, ErrorBox, mutedText } from "./ui";

type ListState =
  | { status: "loading" }
  | { status: "ready"; quests: Quest[] }
  | { status: "error"; message: string };

const EMPTY_MESSAGES: Record<QuestFilter, { title: string; body: string }> = {
  all: {
    title: "Aún no tienes misiones",
    body: "Crea la primera desde Nueva misión y empieza a trazar tu ruta.",
  },
  active: {
    title: "No tienes misiones activas",
    body: "Todo hecho. Crea otra misión para seguir ganando altura.",
  },
  completed: {
    title: "Todavía no has completado ninguna misión",
    body: "Completa una misión activa para sumar su XP a tu ruta.",
  },
};

/**
 * Destino de foco pendiente tras borrar: id de misión, o null para el encabezado.
 * `waitUpdates`: cuántas actualizaciones de la lista se espera a que aparezca la
 * misión (tras un borrado rechazado, Firestore la vuelve a insertar).
 */
type FocusRequest = { questId: string | null; waitUpdates: number } | null;

const NEW_QUEST_REGION_ID = "new-quest-region";

function LoadingList() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">Cargando misiones…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} aria-hidden="true" className={`${cardClass} p-5`}>
          <div className="flex gap-2">
            <div className="h-4 w-20 rounded-full bg-ink/10 motion-safe:animate-pulse" />
            <div className="h-4 w-12 rounded-full bg-ink/10 motion-safe:animate-pulse" />
          </div>
          <div className="mt-4 h-5 w-3/4 rounded-full bg-ink/10 motion-safe:animate-pulse" />
          <div className="mt-3 h-4 w-1/2 rounded-full bg-ink/10 motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function StatsPanel({ stats, loading, className = "" }: { stats: QuestStats; loading: boolean; className?: string }) {
  const items = [
    { label: "Misiones", value: String(stats.total) },
    { label: "Completadas", value: String(stats.completed) },
    { label: "XP ganada", value: String(stats.xpEarned) },
    { label: "Progreso", value: `${stats.progressPercent} %` },
  ];
  return (
    <section
      aria-labelledby="stats-heading"
      aria-busy={loading || undefined}
      className={`${containerClass} px-5 py-4 ${className}`}
    >
      <h2 id="stats-heading" className="sr-only">
        Estadísticas
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className={`text-small ${mutedText}`}>{item.label}</dt>
            <dd className="font-display text-heading font-bold tabular-nums">
              {loading ? (
                <>
                  <span className="sr-only">Cargando</span>
                  <span aria-hidden="true">–</span>
                </>
              ) : (
                item.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className={`size-4 shrink-0 ${open ? "rotate-180" : ""}`}>
      <path d="m3.5 6 4.5 4.5L12.5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmptyGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" fill="none" className="size-12 shrink-0">
      <path d="M4 40c6-1 9-8 14-15s8-13 11-13 6 9 9 15 5 11 6 13" className="stroke-ink-soft" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="3 4" />
      <path d="M29 12V4.5l7 2.6-7 2.6" className="stroke-contour" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="29" cy="12" r="2.6" className="fill-marker stroke-contour" strokeWidth="1.4" />
    </svg>
  );
}

/**
 * Dashboard del usuario `uid`. El padre lo monta con key={uid}, así que un cambio
 * de usuario desmonta este componente y cancela la suscripción anterior.
 */
export function Dashboard({ uid }: { uid: string }) {
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<QuestFilter>("all");
  const [toDelete, setToDelete] = useState<Quest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncNotices, setSyncNotices] = useState<SyncNotice[]>([]);
  const noticeIdRef = useRef(0);
  // Remontar el formulario de creación (key) permite devolverle una misión rechazada.
  const [createForm, setCreateForm] = useState<{ key: number; initial?: QuestInput }>({ key: 0 });
  // Formulario "Nueva misión" desplegado en pantallas estrechas (desde 1024 px siempre se ve).
  const [formOpen, setFormOpen] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const focusRequest = useRef<FocusRequest>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const createTitleRef = useRef<HTMLInputElement>(null);
  // Borrador actual del formulario de creación (QA-010) y aviso a restaurar pendiente de confirmar.
  const createDraftRef = useRef<FormDraft>(EMPTY_DRAFT);
  const handleCreateDraftChange = useCallback((draft: FormDraft) => {
    createDraftRef.current = draft;
  }, []);
  const [toRestore, setToRestore] = useState<SyncNotice | null>(null);
  const [titleFocusTick, setTitleFocusTick] = useState(0);

  // Enfoca el título del formulario de creación cuando se pide (restaurar, "Crear una misión").
  // Corre después del efecto de ConfirmDialog (hijo), que al cerrar el <dialog>
  // intentaría devolver el foco al botón ya retirado.
  useEffect(() => {
    if (titleFocusTick > 0) createTitleRef.current?.focus();
  }, [titleFocusTick]);

  useEffect(() => {
    const unsubscribe = subscribeToQuests(
      uid,
      (quests) => setList({ status: "ready", quests }),
      (error) => setList({ status: "error", message: translateFirestoreError(error) }),
    );
    return unsubscribe;
  }, [uid, attempt]);

  const quests = useMemo(() => (list.status === "ready" ? list.quests : []), [list]);
  const stats = useMemo(() => computeStats(quests), [quests]);
  const visible = useMemo(() => filterQuests(quests, filter), [quests, filter]);

  // QA-005: tras borrar, el foco va a la siguiente misión o al encabezado.
  // Corre después del efecto de ConfirmDialog (hijo), que cierra el <dialog>.
  useEffect(() => {
    const request = focusRequest.current;
    if (!request) return;
    const target = request.questId
      ? listRef.current?.querySelector<HTMLElement>(`[data-quest-id="${CSS.escape(request.questId)}"]`)
      : null;
    if (!target && request.questId && request.waitUpdates > 0) {
      focusRequest.current = { ...request, waitUpdates: request.waitUpdates - 1 };
      return;
    }
    focusRequest.current = null;
    (target ?? listHeadingRef.current)?.focus();
  }, [focusTick, visible]);
  const loading = list.status === "loading";

  /**
   * Devuelve el manejador de un rechazo que llega después de liberar la UI:
   * añade un aviso (sin sobrescribir los anteriores) que nombra la misión.
   */
  const lateErrorHandler = useCallback(
    (write: LateWrite, onRejected?: () => void) => (error: unknown) => {
      onRejected?.();
      noticeIdRef.current += 1;
      const notice = lateErrorNotice(noticeIdRef.current, write, translateFirestoreError(error));
      setSyncNotices((list) => addNotice(list, notice));
    },
    [],
  );

  /** Despliega "Nueva misión" (en móvil) y enfoca su título. */
  function openCreateForm() {
    setFormOpen(true);
    setTitleFocusTick((n) => n + 1);
  }

  function applyRestore(notice: SyncNotice) {
    if (!notice.restore) return;
    setFormOpen(true);
    setCreateForm((current) => ({ key: current.key + 1, initial: notice.restore }));
    setSyncNotices((list) => removeNotice(list, notice.id));
  }

  /** QA-010: si el formulario tiene texto, pide confirmación antes de sustituirlo. */
  function restoreCreation(notice: SyncNotice) {
    if (!notice.restore) return;
    if (restoreNeedsConfirmation(createDraftRef.current, notice.restore)) {
      setToRestore(notice);
      return;
    }
    applyRestore(notice);
  }

  function confirmRestore() {
    const notice = toRestore;
    setToRestore(null);
    if (!notice) return;
    applyRestore(notice);
    setTitleFocusTick((n) => n + 1);
  }

  function retry() {
    setList({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  async function confirmDelete() {
    if (!toDelete || deleting) return;
    const quest = toDelete;
    const nextId = focusTargetAfterRemoval(
      visible.map((q) => q.id),
      quest.id,
    );
    setDeleting(true);
    setActionError(null);
    try {
      await runWrite(deleteQuest(quest.id), lateErrorHandler({ kind: "delete", title: quest.title }));
      focusRequest.current = { questId: nextId, waitUpdates: 0 };
      setFocusTick((n) => n + 1);
    } catch (error) {
      // Rechazado: Firestore ya la había quitado en local y la vuelve a insertar
      // (nodo nuevo), así que el foco va a esa misión en cuanto reaparece.
      focusRequest.current = { questId: quest.id, waitUpdates: 2 };
      setFocusTick((n) => n + 1);
      setActionError(`No se pudo eliminar «${quest.title}». ${translateFirestoreError(error)}`);
    } finally {
      setToDelete(null);
      setDeleting(false);
    }
  }

  const empty = EMPTY_MESSAGES[filter];

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-x-8 lg:gap-y-6">
      <RouteProfile quests={quests} stats={stats} loading={loading} />

      {/* Columna de herramientas: fija al desplazar desde 1024 px. En móvil las estadísticas van primero. */}
      <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto">
        <section aria-labelledby="new-quest-heading" className={`${containerClass} p-4 sm:p-5`}>
          <h2 id="new-quest-heading" className="font-display text-title font-bold tracking-tight">
            <button
              type="button"
              aria-expanded={formOpen}
              aria-controls={NEW_QUEST_REGION_ID}
              onClick={() => setFormOpen((open) => !open)}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-control text-left lg:hidden"
            >
              <span>Nueva misión</span>
              <span aria-hidden="true" className={`flex items-center gap-1.5 font-sans text-small font-semibold ${mutedText}`}>
                {formOpen ? "Ocultar" : "Mostrar"}
                <Chevron open={formOpen} />
              </span>
            </button>
            <span className="hidden lg:inline">Nueva misión</span>
          </h2>
          <div id={NEW_QUEST_REGION_ID} className={formOpen ? "mt-3 lg:mt-4" : "mt-3 max-lg:hidden lg:mt-4"}>
            <QuestForm
              key={createForm.key}
              initial={createForm.initial}
              focusOnMount={createForm.key > 0}
              submitLabel="Crear misión"
              pendingLabel="Creando…"
              resetOnSuccess
              successMessage="Misión creada."
              titleRef={createTitleRef}
              onDraftChange={handleCreateDraftChange}
              errorMessage={translateFirestoreError}
              onSubmit={(value, { retract }) =>
                runWrite(createQuest(value), lateErrorHandler({ kind: "create", value }, retract))
              }
            />
          </div>
        </section>

        <StatsPanel stats={stats} loading={loading} className="order-first lg:order-none" />
      </div>

      <section aria-labelledby="quests-heading" className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="quests-heading"
            ref={listHeadingRef}
            tabIndex={-1}
            className="scroll-mt-6 rounded-control font-display text-title font-bold tracking-tight"
          >
            Tus misiones
          </h2>
          <div role="group" aria-label="Filtrar misiones" className="flex flex-wrap gap-2">
            {QUEST_FILTERS.map((value) => {
              const count = value === "all" ? stats.total : value === "active" ? stats.active : stats.completed;
              const selected = filter === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFilter(value)}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-small font-semibold ${
                    selected ? "border-ink bg-ink text-paper" : "border-line text-ink hover:bg-ink/5"
                  }`}
                >
                  {FILTER_LABELS[value]}
                  {!loading && (
                    <span className={`tabular-nums ${selected ? "text-paper" : mutedText}`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {syncNotices.length > 0 && (
          <ul aria-label="Cambios no sincronizados" className="flex flex-col gap-2">
            {syncNotices.map((notice) => (
              <li key={notice.id}>
                <ErrorBox
                  title="Cambio no sincronizado"
                  action={
                    <div className="flex flex-wrap gap-2">
                      {notice.restore && (
                        <button type="button" onClick={() => restoreCreation(notice)} className={buttonClass("secondary", "sm")}>
                          Restaurar en el formulario
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSyncNotices((list) => removeNotice(list, notice.id))}
                        className={buttonClass("secondary", "sm")}
                      >
                        Cerrar aviso
                      </button>
                    </div>
                  }
                >
                  {notice.message}
                </ErrorBox>
              </li>
            ))}
          </ul>
        )}
        {actionError && (
          <ErrorBox
            action={
              <button type="button" onClick={() => setActionError(null)} className={buttonClass("secondary", "sm")}>
                Cerrar aviso
              </button>
            }
          >
            {actionError}
          </ErrorBox>
        )}

        {list.status === "loading" && <LoadingList />}
        {list.status === "error" && (
          <ErrorBox
            title="No se pudieron cargar las misiones"
            action={
              <button type="button" onClick={retry} className={buttonClass("secondary", "sm")}>
                Reintentar
              </button>
            }
          >
            {list.message}
          </ErrorBox>
        )}
        {list.status === "ready" && visible.length === 0 && (
          <div className={`${cardClass} flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:p-6`}>
            <EmptyGlyph />
            <div className="min-w-0 flex-1">
              <p className="font-display text-title font-bold tracking-tight">{empty.title}</p>
              <p className={`mt-1 text-small ${mutedText}`}>{empty.body}</p>
            </div>
            {filter !== "all" && stats.total > 0 ? (
              <button type="button" onClick={() => setFilter("all")} className={buttonClass("secondary", "sm")}>
                Ver todas las misiones
              </button>
            ) : (
              <button type="button" onClick={openCreateForm} className={buttonClass("secondary", "sm")}>
                Crear una misión
              </button>
            )}
          </div>
        )}
        {list.status === "ready" && visible.length > 0 && (
          <ul ref={listRef} className="flex flex-col gap-3">
            {visible.map((quest) => (
              <QuestItem
                key={quest.id}
                quest={quest}
                errorMessage={translateFirestoreError}
                onToggle={(q) =>
                  runWrite(
                    setQuestCompleted(q.id, !q.completed),
                    lateErrorHandler({ kind: "toggle", title: q.title, completed: !q.completed }),
                  )
                }
                onSave={(q, value) =>
                  runWrite(
                    updateQuest(q.id, value),
                    lateErrorHandler({ kind: "update", title: q.title, newTitle: value.title }),
                  )
                }
                onRequestDelete={(q) => {
                  setActionError(null);
                  setToDelete(q);
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={toDelete !== null}
        title="¿Eliminar misión?"
        message={toDelete ? `Se eliminará «${toDelete.title}» de forma permanente. Esta acción no se puede deshacer.` : ""}
        confirmLabel="Eliminar misión"
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />

      <ConfirmDialog
        open={toRestore !== null}
        title="¿Sustituir el borrador?"
        message={
          toRestore?.restore
            ? `El formulario de nueva misión tiene texto sin guardar. Si restauras «${toRestore.restore.title}», ese texto se perderá.`
            : ""
        }
        confirmLabel="Sustituir borrador"
        pendingLabel="Sustituyendo…"
        onConfirm={confirmRestore}
        onCancel={() => setToRestore(null)}
      />
    </div>
  );
}
