"use client";

import { useEffect, useRef, useState } from "react";
import { DIFFICULTY_LABELS, xpFor, type Quest, type QuestInput } from "@/lib/quests";
import type { WriteOutcome } from "@/lib/writes";
import { QuestForm } from "./QuestForm";
import { buttonClass, CheckGlyph, mutedText, Spinner, TerrainIcon } from "./ui";

interface QuestItemProps {
  quest: Quest;
  onToggle: (quest: Quest) => Promise<WriteOutcome>;
  onSave: (quest: Quest, value: QuestInput) => Promise<WriteOutcome>;
  onRequestDelete: (quest: Quest) => void;
  errorMessage: (error: unknown) => string;
}

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

  const xp = xpFor(quest.difficulty);
  const titleId = `quest-${quest.id}-title`;

  return (
    <li
      data-quest-id={quest.id}
      data-tour={editing ? undefined : "quest-card"}
      tabIndex={-1}
      aria-labelledby={titleId}
      className={`min-w-0 scroll-mt-6 rounded-card border border-ink/10 p-4 sm:p-5 ${quest.completed ? "bg-paper" : "bg-surface"}`}
    >
      {editing ? (
        <>
          <h3 id={titleId} className="sr-only">
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
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-1.5 text-small font-semibold text-ink">
              <TerrainIcon difficulty={quest.difficulty} />
              <span>{DIFFICULTY_LABELS[quest.difficulty]}</span>
            </span>
            {quest.completed ? (
              <span className="inline-flex items-center rounded-full bg-marker px-2.5 py-0.5 text-small font-semibold tabular-nums text-on-marker">
                +{xp} XP<span className="sr-only"> ganados</span>
              </span>
            ) : (
              <span className={`text-small tabular-nums ${mutedText}`}>{xp} XP</span>
            )}
            <span className="ml-auto inline-flex items-center gap-2">
              {quest.pendingSync && (
                <span className={`rounded-full border border-dashed border-line px-2.5 py-0.5 text-small ${mutedText}`}>
                  Pendiente de sincronizar
                </span>
              )}
              {quest.completed ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-contour px-2.5 py-0.5 text-small font-semibold text-ink">
                  <CheckGlyph className="size-3.5 text-contour" />
                  Hecha
                </span>
              ) : (
                <span className={`rounded-full border border-line px-2.5 py-0.5 text-small ${mutedText}`}>Activa</span>
              )}
            </span>
          </div>
          <div className="min-w-0">
            <h3
              id={titleId}
              className={`font-display text-title font-semibold tracking-snug wrap-anywhere ${
                quest.completed ? `${mutedText} line-through decoration-1` : "text-ink"
              }`}
            >
              {quest.title}
            </h3>
            {quest.description && (
              <p className={`mt-1 whitespace-pre-line text-small wrap-anywhere ${mutedText}`}>{quest.description}</p>
            )}
          </div>
          {toggleError && (
            <p role="alert" className="text-small text-danger">
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
              className={buttonClass(quest.completed ? "secondary" : "primary", "sm")}
            >
              {toggling && <Spinner className="size-3.5" />}
              {toggling ? "Guardando…" : quest.completed ? "Reabrir" : "Completar"}
            </button>
            <button
              ref={editButtonRef}
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Editar misión: ${quest.title}`}
              className={buttonClass("secondary", "sm")}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onRequestDelete(quest)}
              aria-label={`Eliminar misión: ${quest.title}`}
              className={buttonClass("dangerQuiet", "sm")}
            >
              Eliminar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
