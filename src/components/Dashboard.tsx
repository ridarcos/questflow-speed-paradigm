"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { focusTargetAfterRemoval } from "@/lib/listFocus";
import {
  computeStats,
  filterQuests,
  FILTER_LABELS,
  levelFromXp,
  QUEST_FILTERS,
  type Quest,
  type QuestFilter,
} from "@/lib/quests";
import {
  createQuest,
  deleteQuest,
  setQuestCompleted,
  subscribeToQuests,
  translateFirestoreError,
  updateQuest,
} from "@/lib/questsRepo";
import { runWrite } from "@/lib/writes";
import { ConfirmDialog } from "./ConfirmDialog";
import { QuestForm } from "./QuestForm";
import { QuestItem } from "./QuestItem";
import { cardClass, ErrorBox, focusRing, mutedText, secondaryButton } from "./ui";

type ListState =
  | { status: "loading" }
  | { status: "ready"; quests: Quest[] }
  | { status: "error"; message: string };

const EMPTY_MESSAGES: Record<QuestFilter, { title: string; body: string }> = {
  all: {
    title: "Aún no tienes misiones",
    body: "Crea la primera con el formulario y empieza a ganar XP.",
  },
  active: {
    title: "No hay misiones activas",
    body: "¡Todo completado! Crea una nueva misión para seguir subiendo de nivel.",
  },
  completed: {
    title: "Todavía no has completado ninguna misión",
    body: "Completa una misión activa para ganar su XP.",
  },
};

/**
 * Destino de foco pendiente tras borrar: id de misión, o null para el encabezado.
 * `waitUpdates`: cuántas actualizaciones de la lista se espera a que aparezca la
 * misión (tras un borrado rechazado, Firestore la vuelve a insertar).
 */
type FocusRequest = { questId: string | null; waitUpdates: number } | null;

function LoadingList() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">Cargando misiones…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} aria-hidden="true" className={`${cardClass} p-4`}>
          <div className="flex gap-2">
            <div className="h-5 w-16 rounded-full bg-slate-200 motion-safe:animate-pulse dark:bg-slate-700" />
            <div className="h-5 w-12 rounded-full bg-slate-200 motion-safe:animate-pulse dark:bg-slate-700" />
          </div>
          <div className="mt-3 h-5 w-3/4 rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-700" />
          <div className="mt-2 h-4 w-1/2 rounded bg-slate-100 motion-safe:animate-pulse dark:bg-slate-800" />
        </div>
      ))}
    </div>
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
  const [syncError, setSyncError] = useState<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const focusRequest = useRef<FocusRequest>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const createTitleRef = useRef<HTMLInputElement>(null);

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
  const level = useMemo(() => levelFromXp(stats.xpEarned), [stats.xpEarned]);
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

  /** Error de una escritura rechazada por el servidor después de liberar la UI. */
  const reportLateError = useCallback((error: unknown) => {
    setSyncError(`Un cambio no se pudo sincronizar y se ha revertido. ${translateFirestoreError(error)}`);
  }, []);

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
      await runWrite(deleteQuest(quest.id), reportLateError);
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

  const statCards = [
    { label: "Misiones", value: String(stats.total) },
    { label: "Completadas", value: String(stats.completed) },
    { label: "XP ganada", value: String(stats.xpEarned) },
    { label: "Progreso", value: `${stats.progressPercent} %` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="stats-heading" aria-busy={loading || undefined} className="flex flex-col gap-3">
        <h2 id="stats-heading" className="sr-only">
          Estadísticas
        </h2>
        <div className="rounded-2xl bg-gradient-to-br from-indigo-700 to-violet-700 p-4 text-white shadow-sm sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-sm font-medium text-indigo-100">
              Nivel
              <span className="ml-2 text-3xl font-bold tabular-nums text-white">
                {loading ? "–" : level.level}
              </span>
            </p>
            <p className="text-sm tabular-nums text-indigo-100">
              {loading ? "Cargando…" : `${level.xpIntoLevel}/${level.xpIntoLevel + level.xpToNext} XP · faltan ${level.xpToNext} XP para el nivel ${level.level + 1}`}
            </p>
          </div>
          <div
            role="progressbar"
            aria-label="Progreso del nivel"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={loading ? undefined : level.percent}
            aria-valuetext={loading ? "Cargando" : `Nivel ${level.level}: ${level.xpIntoLevel} de ${level.xpIntoLevel + level.xpToNext} XP`}
            className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/25"
          >
            <div
              className="h-full rounded-full bg-amber-300 motion-safe:transition-[width]"
              style={{ width: `${loading ? 0 : level.percent}%` }}
            />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((stat) => (
            <div key={stat.label} className={`${cardClass} min-w-0 p-4`}>
              <dt className={`text-sm font-medium ${mutedText}`}>{stat.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">
                {loading ? <span aria-label="Cargando">–</span> : stat.value}
              </dd>
            </div>
          ))}
        </dl>
        <div>
          <div
            role="progressbar"
            aria-label="Progreso de misiones completadas"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={stats.progressPercent}
            aria-valuetext={`${stats.completed} de ${stats.total} misiones completadas (${stats.progressPercent} %)`}
            className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          >
            <div
              className="h-full rounded-full bg-indigo-600 motion-safe:transition-[width] dark:bg-indigo-400"
              style={{ width: `${stats.progressPercent}%` }}
            />
          </div>
          <p className={`mt-1 text-xs ${mutedText}`}>
            {stats.xpEarned} de {stats.xpAvailable} XP posibles
          </p>
        </div>
      </section>

      <section aria-labelledby="new-quest-heading" className={`${cardClass} p-4 sm:p-6`}>
        <h2 id="new-quest-heading" className="mb-3 text-lg font-semibold">
          Nueva misión
        </h2>
        <QuestForm
          submitLabel="Crear misión"
          pendingLabel="Creando…"
          resetOnSuccess
          successMessage="Misión creada."
          titleRef={createTitleRef}
          errorMessage={translateFirestoreError}
          onSubmit={(value) => runWrite(createQuest(value), reportLateError)}
        />
      </section>

      <section aria-labelledby="quests-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="quests-heading"
            ref={listHeadingRef}
            tabIndex={-1}
            className={`rounded text-lg font-semibold ${focusRing}`}
          >
            Tus misiones
          </h2>
          <div role="group" aria-label="Filtrar misiones" className="flex flex-wrap gap-2">
            {QUEST_FILTERS.map((value) => {
              const count = value === "all" ? stats.total : value === "active" ? stats.active : stats.completed;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${focusRing} ${
                    filter === value
                      ? "border-indigo-700 bg-indigo-700 text-white"
                      : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  {FILTER_LABELS[value]}
                  {!loading && (
                    <span
                      className={`rounded-full px-1.5 text-xs tabular-nums ${
                        filter === value ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {syncError && (
          <ErrorBox
            title="Error de sincronización"
            action={
              <button type="button" onClick={() => setSyncError(null)} className={`${secondaryButton} px-3 py-1.5 text-sm`}>
                Cerrar aviso
              </button>
            }
          >
            {syncError}
          </ErrorBox>
        )}
        {actionError && (
          <ErrorBox
            action={
              <button type="button" onClick={() => setActionError(null)} className={`${secondaryButton} px-3 py-1.5 text-sm`}>
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
              <button type="button" onClick={retry} className={`${secondaryButton} px-3 py-1.5 text-sm`}>
                Reintentar
              </button>
            }
          >
            {list.message}
          </ErrorBox>
        )}
        {list.status === "ready" && visible.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-10 w-10 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.4 7.2 17.9l.9-5.4-3.9-3.8 5.4-.8L12 3z" />
            </svg>
            <div>
              <p className="font-semibold">{EMPTY_MESSAGES[filter].title}</p>
              <p className={`mt-1 text-sm ${mutedText}`}>{EMPTY_MESSAGES[filter].body}</p>
            </div>
            {filter !== "all" && stats.total > 0 ? (
              <button type="button" onClick={() => setFilter("all")} className={`${secondaryButton} px-3 py-1.5 text-sm`}>
                Ver todas las misiones
              </button>
            ) : (
              <button
                type="button"
                onClick={() => createTitleRef.current?.focus()}
                className={`${secondaryButton} px-3 py-1.5 text-sm`}
              >
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
                onToggle={(q) => runWrite(setQuestCompleted(q.id, !q.completed), reportLateError)}
                onSave={(q, value) => runWrite(updateQuest(q.id, value), reportLateError)}
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
        confirmLabel="Eliminar"
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
