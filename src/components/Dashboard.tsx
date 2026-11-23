"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeStats,
  filterQuests,
  FILTER_LABELS,
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
import { ConfirmDialog } from "./ConfirmDialog";
import { QuestForm } from "./QuestForm";
import { QuestItem } from "./QuestItem";

type ListState =
  | { status: "loading" }
  | { status: "ready"; quests: Quest[] }
  | { status: "error"; message: string };

const EMPTY_MESSAGES: Record<QuestFilter, string> = {
  all: "Aún no tienes misiones. Crea la primera con el formulario.",
  active: "No hay misiones activas. ¡Todo completado!",
  completed: "Todavía no has completado ninguna misión.",
};

/**
 * Dashboard del usuario `uid`. El padre lo monta con key={uid}, así que un cambio
 * de usuario desmonta este componente y cancela la suscripción anterior.
 */
export function Dashboard({ uid }: { uid: string }) {
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [filter, setFilter] = useState<QuestFilter>("all");
  const [toDelete, setToDelete] = useState<Quest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToQuests(
      uid,
      (quests) => setList({ status: "ready", quests }),
      (error) => setList({ status: "error", message: translateFirestoreError(error) }),
    );
    return unsubscribe;
  }, [uid]);

  const quests = useMemo(() => (list.status === "ready" ? list.quests : []), [list]);
  const stats = useMemo(() => computeStats(quests), [quests]);
  const visible = useMemo(() => filterQuests(quests, filter), [quests, filter]);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteQuest(toDelete.id);
      setToDelete(null);
    } catch (error) {
      setActionError(translateFirestoreError(error));
      setToDelete(null);
    } finally {
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
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Estadísticas
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <dt className="text-sm font-medium text-slate-600 dark:text-slate-400">{stat.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">{stat.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3">
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
              className="h-full rounded-full bg-indigo-600 transition-[width]"
              style={{ width: `${stats.progressPercent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {stats.xpEarned} de {stats.xpAvailable} XP posibles
          </p>
        </div>
      </section>

      <section
        aria-labelledby="new-quest-heading"
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 id="new-quest-heading" className="mb-3 text-lg font-semibold">
          Nueva misión
        </h2>
        <QuestForm
          submitLabel="Crear misión"
          pendingLabel="Creando…"
          resetOnSuccess
          errorMessage={translateFirestoreError}
          onSubmit={async (value) => {
            await createQuest(value);
          }}
        />
      </section>

      <section aria-labelledby="quests-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="quests-heading" className="text-lg font-semibold">
            Tus misiones
          </h2>
          <div role="group" aria-label="Filtrar misiones" className="flex flex-wrap gap-2">
            {QUEST_FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  filter === value
                    ? "border-indigo-700 bg-indigo-700 text-white"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {FILTER_LABELS[value]}
              </button>
            ))}
          </div>
        </div>

        {actionError && (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {actionError}
          </p>
        )}

        {list.status === "loading" && (
          <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            Cargando misiones…
          </p>
        )}
        {list.status === "error" && (
          <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-6 text-center text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            No se pudieron cargar las misiones. {list.message}
          </p>
        )}
        {list.status === "ready" && visible.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            {EMPTY_MESSAGES[filter]}
          </p>
        )}
        {list.status === "ready" && visible.length > 0 && (
          <ul className="flex flex-col gap-3">
            {visible.map((quest) => (
              <QuestItem
                key={quest.id}
                quest={quest}
                errorMessage={translateFirestoreError}
                onToggle={(q) => setQuestCompleted(q.id, !q.completed)}
                onSave={(q, value) => updateQuest(q.id, value)}
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
