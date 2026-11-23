"use client";

import { useEffect, useRef, useState } from "react";
import { DIFFICULTY_LABELS, xpFor, type Quest, type QuestInput } from "@/lib/quests";
import type { WriteOutcome } from "@/lib/writes";
import { QuestForm } from "./QuestForm";
import { DIFFICULTY_STYLES, focusRing, mutedText, Spinner } from "./ui";

interface QuestItemProps {
  quest: Quest;
  onToggle: (quest: Quest) => Promise<WriteOutcome>;
  onSave: (quest: Quest, value: QuestInput) => Promise<WriteOutcome>;
  onRequestDelete: (quest: Quest) => void;
  errorMessage: (error: unknown) => string;
}

const smallButton = `inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

export function QuestItem({ quest, onToggle, onSave, onRequestDelete, errorMessage }: QuestItemProps) {
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const togglingRef = useRef(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  // Al cerrar el editor, el foco vuelve al botón "Editar" de esta misión.
  useEffect(() => {
    if (!editing && restoreFocus.current) {
      restoreFocus.current = false;
      editButtonRef.current?.focus();
    }
  }, [editing]);

  function closeEditor() {
    restoreFocus.current = true;
    setEditing(false);
  }

  async function handleToggle() {
    if (togglingRef.current) return;
    togglingRef.current = true;
    setToggleError(null);
    setToggling(true);
    try {
      await onToggle(quest);
    } catch (error) {
      setToggleError(errorMessage(error));
    } finally {
      togglingRef.current = false;
      setToggling(false);
    }
  }

  const styles = DIFFICULTY_STYLES[quest.difficulty];
  const xp = xpFor(quest.difficulty);

  return (
    <li
      data-quest-id={quest.id}
      tabIndex={-1}
      aria-labelledby={`quest-${quest.id}-title`}
      className={`scroll-mt-4 rounded-2xl border border-l-4 border-slate-200 p-4 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 dark:border-slate-800 dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-slate-950 ${styles.accent} ${
        quest.completed ? "bg-slate-50 dark:bg-slate-900/60" : "bg-white dark:bg-slate-900"
      }`}
    >
      {editing ? (
        <>
          <h3 id={`quest-${quest.id}-title`} className="sr-only">
            Editando: {quest.title}
          </h3>
          <QuestForm
            initial={{ title: quest.title, description: quest.description, difficulty: quest.difficulty }}
            submitLabel="Guardar cambios"
            pendingLabel="Guardando…"
            errorMessage={errorMessage}
            focusOnMount
            onCancel={closeEditor}
            onSubmit={async (value) => {
              const outcome = await onSave(quest, value);
              closeEditor();
              return outcome;
            }}
          />
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles.badge}`}>
              {DIFFICULTY_LABELS[quest.difficulty]}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                quest.completed
                  ? "bg-indigo-700 text-white dark:bg-indigo-400 dark:text-slate-950"
                  : "bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-200 dark:ring-indigo-800"
              }`}
            >
              {quest.completed ? `+${xp} XP ganados` : `${xp} XP`}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                quest.completed
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                  : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {quest.completed ? "Completada" : "Activa"}
            </span>
            {quest.pendingSync && (
              <span className="rounded-full border border-dashed border-slate-400 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-500 dark:text-slate-300">
                Pendiente de sincronizar
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h3
              id={`quest-${quest.id}-title`}
              className={`text-base font-semibold wrap-anywhere ${
                quest.completed ? "text-slate-600 line-through decoration-2 dark:text-slate-400" : ""
              }`}
            >
              {quest.title}
            </h3>
            {quest.description && (
              <p className={`mt-1 whitespace-pre-line text-sm wrap-anywhere ${mutedText}`}>
                {quest.description}
              </p>
            )}
          </div>
          {toggleError && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {toggleError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleToggle}
              disabled={toggling}
              aria-busy={toggling || undefined}
              aria-label={`${quest.completed ? "Reabrir" : "Completar"} misión: ${quest.title}`}
              className={`${smallButton} ${
                quest.completed
                  ? "border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  : "border-indigo-700 bg-indigo-700 text-white hover:bg-indigo-800"
              }`}
            >
              {toggling && <Spinner className="h-3.5 w-3.5" />}
              {toggling ? "Guardando…" : quest.completed ? "Reabrir" : "Completar"}
            </button>
            <button
              ref={editButtonRef}
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Editar misión: ${quest.title}`}
              className={`${smallButton} border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800`}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onRequestDelete(quest)}
              aria-label={`Eliminar misión: ${quest.title}`}
              className={`${smallButton} border-red-300 bg-white text-red-800 hover:bg-red-50 dark:border-red-800 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/40`}
            >
              Eliminar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
