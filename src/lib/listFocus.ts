/**
 * Destino del foco tras eliminar un elemento de una lista (QA-005, AC-25):
 * el siguiente elemento; si era el último, el anterior; si la lista queda
 * vacía, null (la UI enfoca entonces el encabezado de la lista).
 */
export function focusTargetAfterRemoval(ids: readonly string[], removedId: string): string | null {
  const index = ids.indexOf(removedId);
  if (index === -1) {
    return ids[0] ?? null;
  }
  return ids[index + 1] ?? ids[index - 1] ?? null;
}
