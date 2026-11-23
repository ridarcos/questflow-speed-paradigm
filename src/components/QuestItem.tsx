"use client";

import { useState } from "react";
import { DIFFICULTY_LABELS, xpFor, type Quest, type QuestInput } from "@/lib/quests";
import { QuestForm } from "./QuestForm";

interface QuestItemProps {
  quest: Quest;
  onToggle: (quest: Quest) => Promise<void>;
  onSave: (quest: Quest, value: QuestInput) => Promise<void>;
  onRequestDelete: (quest: Quest) => void;
  errorMessage: (error: unknown) => string;
}

const badgeClass: Record<Quest["difficulty"], string> = {
  easy: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100",
  medium: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
  hard: "bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100",
};

const smallButton =
  "rounded-lg border px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:cursor-not-allowed disabled:opacity-60";

export function QuestItem({ quest, onToggle, onSave, onRequestDelete, errorMessage }: QuestItemProps) {
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  async function handleToggle() {
    setToggleError(null);
    setToggling(true);
    try {
      await onToggle(quest);
    } catch (error) {
      setToggleError(errorMessage(error));
    } finally {
      setToggling(false);
    }
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {editing ? (
        <QuestForm
          initial={{ title: quest.title, description: quest.description, difficulty: quest.difficulty }}
          submitLabel="Guardar cambios"
          pendingLabel="Guardando…"
          errorMessage={errorMessage}
          onCancel={() => setEditing(false)}
          onSubmit={async (value) => {
            await onSave(quest, value);
            setEditing(false);
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass[quest.difficulty]}`}>
              {DIFFICULTY_LABELS[quest.difficulty]} · {xpFor(quest.difficulty)} XP
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                quest.completed
                  ? "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/50 dark:text-indigo-100"
                  : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {quest.completed ? "Completada" : "Activa"}
            </span>
          </div>
          <div className="min-w-0">
            <h3
              className={`break-words text-base font-semibold ${
                quest.completed ? "text-slate-500 line-through dark:text-slate-400" : ""
              }`}
            >
              {quest.title}
            </h3>
            {quest.description && (
              <p className="mt-1 whitespace-pre-line break-words text-sm text-slate-700 dark:text-slate-300">
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
              aria-label={`${quest.completed ? "Reabrir" : "Completar"} misión: ${quest.title}`}
              className={`${smallButton} ${
                quest.completed
                  ? "border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                  : "border-indigo-700 bg-indigo-700 text-white hover:bg-indigo-800"
              }`}
            >
              {toggling ? "Guardando…" : quest.completed ? "Reabrir" : "Completar"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Editar misión: ${quest.title}`}
              className={`${smallButton} border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800`}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onRequestDelete(quest)}
              aria-label={`Eliminar misión: ${quest.title}`}
              className={`${smallButton} border-red-300 text-red-800 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40`}
            >
              Eliminar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
