"use client";

import { useId, useState, type FormEvent } from "react";
import {
  DESCRIPTION_MAX_LENGTH,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  TITLE_MAX_LENGTH,
  validateQuestInput,
  xpFor,
  type Difficulty,
  type QuestInput,
  type QuestValidationErrors,
} from "@/lib/quests";

interface QuestFormProps {
  initial?: QuestInput;
  submitLabel: string;
  pendingLabel: string;
  /** Debe lanzar si la escritura falla; el formulario muestra el error recibido. */
  onSubmit: (value: QuestInput) => Promise<void>;
  onCancel?: () => void;
  /** Vacía los campos tras un envío correcto (modo creación). */
  resetOnSuccess?: boolean;
  errorMessage?: (error: unknown) => string;
}

const fieldClass =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100";

export function QuestForm({
  initial,
  submitLabel,
  pendingLabel,
  onSubmit,
  onCancel,
  resetOnSuccess = false,
  errorMessage = () => "No se pudo guardar la misión.",
}: QuestFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? "easy");
  const [errors, setErrors] = useState<QuestValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const id = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    const result = validateQuestInput({ title, description, difficulty });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await onSubmit(result.value);
      if (resetOnSuccess) {
        setTitle("");
        setDescription("");
        setDifficulty("easy");
      }
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const diffId = `${id}-difficulty`;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      <div>
        <label htmlFor={titleId} className="block text-sm font-medium">
          Título <span aria-hidden="true">*</span>
        </label>
        <input
          id={titleId}
          type="text"
          required
          maxLength={TITLE_MAX_LENGTH}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? `${titleId}-error` : undefined}
          className={fieldClass}
        />
        {errors.title && (
          <p id={`${titleId}-error`} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">
            {errors.title}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={descId} className="block text-sm font-medium">
          Descripción <span className="font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
        </label>
        <textarea
          id={descId}
          rows={2}
          maxLength={DESCRIPTION_MAX_LENGTH}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={`${descId}-count${errors.description ? ` ${descId}-error` : ""}`}
          className={fieldClass}
        />
        <p id={`${descId}-count`} className="mt-1 text-right text-xs text-slate-600 dark:text-slate-400">
          {description.length}/{DESCRIPTION_MAX_LENGTH}
        </p>
        {errors.description && (
          <p id={`${descId}-error`} role="alert" className="text-sm text-red-700 dark:text-red-400">
            {errors.description}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={diffId} className="block text-sm font-medium">
          Dificultad
        </label>
        <select
          id={diffId}
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          aria-invalid={errors.difficulty ? true : undefined}
          className={fieldClass}
        >
          {DIFFICULTIES.map((value) => (
            <option key={value} value={value}>
              {DIFFICULTY_LABELS[value]} · {xpFor(value)} XP
            </option>
          ))}
        </select>
        {errors.difficulty && (
          <p role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">
            {errors.difficulty}
          </p>
        )}
      </div>

      {submitError && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {submitError}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-60 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
