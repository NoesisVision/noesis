import { useParams } from '@tanstack/react-router';
import { readLastChange } from '#/components/core/last-change.ts';

export function useChangeId() {
  const { changeId } = useParams({ strict: false });
  const lastChangeId = readLastChange();
  return { changeId: changeId ?? lastChangeId ?? null };
}
