"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import {
  charCountTone,
  DESCRIPTION_MAX_LENGTH,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  TITLE_MAX_LENGTH,
  validateQuestInput,
  xpFor,
  type CharCountTone,
  type Difficulty,
  type QuestInput,
  type QuestValidationErrors,
} from "@/lib/quests";
import { queuedSuccessMessage } from "@/lib/syncNotices";
import type { WriteOutcome } from "@/lib/writes";
import { DIFFICULTY_STYLES, ErrorBox, fieldClass, mutedText, primaryButton, secondaryButton, Spinner } from "./ui";

interface QuestFormProps {
  initial?: QuestInput;
  submitLabel: string;
  pendingLabel: string;
  /**
   * Debe lanzar si la escritura falla (el formulario muestra el error).
   * "queued" indica que quedó guardada en local pendiente de sincronizar.
   * `retract` retira el aviso de éxito de este envío (p. ej. si el servidor
   * rechaza la escritura más tarde); no hace nada si ya hay otro aviso.
   */
  onSubmit: (value: QuestInput, submission: { retract: () => void }) => Promise<WriteOutcome | void>;
  onCancel?: () => void;
  /** Vacía los campos tras un envío correcto (modo creación). */
  resetOnSuccess?: boolean;
  /** Mensajes anunciados tras guardar (modo creación). */
  successMessage?: string;
  errorMessage?: (error: unknown) => string;
  /** Enfoca el título al montar (modo edición). */
  focusOnMount?: boolean;
  titleRef?: RefObject<HTMLInputElement | null>;
}

const toneClass: Record<CharCountTone, string> = {
  ok: mutedText,
  near: "font-medium text-amber-800 dark:text-amber-300",
  limit: "font-semibold text-red-700 dark:text-red-400",
};

function CharCount({ id, length, max }: { id: string; length: number; max: number }) {
  return (
    <p id={id} className={`text-xs tabular-nums ${toneClass[charCountTone(length, max)]}`}>
      <span className="sr-only">Caracteres usados: </span>
      {length}/{max}
    </p>
  );
}

export function QuestForm({
  initial,
  submitLabel,
  pendingLabel,
  onSubmit,
  onCancel,
  resetOnSuccess = false,
  successMessage,
  errorMessage = () => "No se pudo guardar la misión.",
  focusOnMount = false,
  titleRef,
}: QuestFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? "easy");
  const [errors, setErrors] = useState<QuestValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ text: string; submission: number } | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const submissionRef = useRef(0);
  const localTitleRef = useRef<HTMLInputElement>(null);
  const inputRef = titleRef ?? localTitleRef;
  const id = useId();

  useEffect(() => {
    if (focusOnMount) inputRef.current?.focus();
  }, [focusOnMount, inputRef]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Anti doble envío: el ref bloquea aunque el estado aún no se haya renderizado.
    if (pendingRef.current) return;
    setSubmitError(null);
    setInfo(null);
    const result = validateQuestInput({ title, description, difficulty });
    if (!result.ok) {
      setErrors(result.errors);
      if (result.errors.title) inputRef.current?.focus();
      return;
    }
    setErrors({});
    pendingRef.current = true;
    setPending(true);
    submissionRef.current += 1;
    const submission = submissionRef.current;
    let retracted = false;
    const retract = () => {
      retracted = true;
      setInfo((current) => (current?.submission === submission ? null : current));
    };
    try {
      const outcome = await onSubmit(result.value, { retract });
      if (resetOnSuccess) {
        setTitle("");
        setDescription("");
        setDifficulty("easy");
      }
      if (successMessage && !retracted) {
        const online = typeof navigator === "undefined" || navigator.onLine;
        setInfo({
          text: outcome === "queued" ? queuedSuccessMessage(successMessage, online) : successMessage,
          submission,
        });
      }
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const describedBy = (base: string, hasError: boolean) =>
    `${base}-count${hasError ? ` ${base}-error` : ""}`;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <div className="flex items-end justify-between gap-2">
          <label htmlFor={titleId} className="block text-sm font-medium">
            Título <span aria-hidden="true" className="text-red-700 dark:text-red-400">*</span>
            <span className="sr-only">(obligatorio)</span>
          </label>
          <CharCount id={`${titleId}-count`} length={title.length} max={TITLE_MAX_LENGTH} />
        </div>
        <input
          ref={inputRef}
          id={titleId}
          type="text"
          required
          autoComplete="off"
          maxLength={TITLE_MAX_LENGTH}
          value={title}
          placeholder="Ej.: Salir a correr 5 km"
          onChange={(e) => {
            setTitle(e.target.value);
            setInfo(null);
            if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
          }}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={describedBy(titleId, Boolean(errors.title))}
          className={fieldClass}
        />
        {errors.title && (
          <p id={`${titleId}-error`} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">
            {errors.title}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-end justify-between gap-2">
          <label htmlFor={descId} className="block text-sm font-medium">
            Descripción <span className={`font-normal ${mutedText}`}>(opcional)</span>
          </label>
          <CharCount id={`${descId}-count`} length={description.length} max={DESCRIPTION_MAX_LENGTH} />
        </div>
        <textarea
          id={descId}
          rows={2}
          maxLength={DESCRIPTION_MAX_LENGTH}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={describedBy(descId, Boolean(errors.description))}
          className={`${fieldClass} resize-y`}
        />
        {errors.description && (
          <p id={`${descId}-error`} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">
            {errors.description}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Dificultad</legend>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {DIFFICULTIES.map((value) => (
            <label
              key={value}
              className={`relative flex min-w-0 cursor-pointer flex-col items-center gap-0.5 rounded-lg border-2 border-slate-200 bg-white px-2 py-2 text-center has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-600 has-[:focus-visible]:ring-offset-2 dark:border-slate-700 dark:bg-slate-950 dark:has-[:focus-visible]:ring-indigo-400 dark:has-[:focus-visible]:ring-offset-slate-900 ${DIFFICULTY_STYLES[value].choice}`}
            >
              <input
                type="radio"
                name={`${id}-difficulty`}
                value={value}
                checked={difficulty === value}
                onChange={() => setDifficulty(value)}
                className="absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none rounded-lg opacity-0"
              />
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${DIFFICULTY_STYLES[value].dot}`} />
                {DIFFICULTY_LABELS[value]}
              </span>
              <span className={`text-xs tabular-nums ${mutedText}`}>{xpFor(value)} XP</span>
            </label>
          ))}
        </div>
        {errors.difficulty && (
          <p role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">
            {errors.difficulty}
          </p>
        )}
      </fieldset>

      {submitError && <ErrorBox title="No se pudo guardar">{submitError}</ErrorBox>}
      <p aria-live="polite" className="text-sm text-emerald-800 dark:text-emerald-300">
        {info?.text}
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={pending} className={secondaryButton}>
            Cancelar
          </button>
        )}
        <button type="submit" disabled={pending} aria-busy={pending || undefined} className={primaryButton}>
          {pending && <Spinner className="h-4 w-4" />}
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
