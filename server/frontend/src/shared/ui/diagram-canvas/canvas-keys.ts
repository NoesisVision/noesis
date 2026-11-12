import { useEffect } from 'react';

/** The roles whose keys are their own: a tree, a dialog, a menu. */
const ELSEWHERE_ROLES = ['tree', 'dialog', 'menu'] as const;
type ElsewhereRole = (typeof ELSEWHERE_ROLES)[number];

/**
 * Whether a key pressed there is meant for something else than the canvas:
 * a field, a select, editable text, or anything inside one of `roles`. A
 * canvas that itself sits in a dialog — the mermaid canvas in full screen —
 * leaves `dialog` out.
 */
export const isElsewhere = (
  target: EventTarget | null,
  roles: readonly ElsewhereRole[] = ELSEWHERE_ROLES,
): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (roles.length > 0 &&
      target.closest(roles.map((role) => `[role="${role}"]`).join(', ')) !==
        null));

/**
 * Escape lets go of what the canvas holds, while it holds anything. Heard on
 * its way down, as a card's tooltip stops it on its way back up; in a field,
 * or inside one of `roles`, it is theirs.
 */
export function useLetGoOnEscape(
  holding: boolean,
  letGo: () => void,
  roles: readonly ElsewhereRole[] = ELSEWHERE_ROLES,
): void {
  useEffect(() => {
    if (!holding) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isElsewhere(event.target, roles)) return;
      letGo();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [holding, letGo, roles]);
}
