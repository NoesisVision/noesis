import type { PropsWithChildren } from 'react';
import { Text } from '#/shared/design-system/text.tsx';
import { DetailSection } from './detail-section.tsx';

/** A word about the element itself, where the document has no field to show. */
export function NoteSection({ children }: PropsWithChildren) {
  return (
    <DetailSection>
      <Text c="dimmed">{children}</Text>
    </DetailSection>
  );
}
