import { IconArrowsExchange } from '@tabler/icons-react';
import type { ChangeListItem } from '../../change-list-items.ts';
import { type ElementRef, partOwnerOf } from '../../element-ref.ts';
import { SignatureCard } from './behaviors-section.tsx';
import { DetailSection } from './detail-section.tsx';

interface InputOutputSectionProps {
  element: ElementRef;
  input: ChangeListItem[];
  output: ChangeListItem[];
}

/**
 * What a behavior takes and what it gives back, as its signature, as its
 * block's Behaviors list writes it — one way wherever the behavior is read:
 * the model as it stands, a design, the details over a card. In a design,
 * what it removes is struck and an input it adds is named in place.
 */
export function InputOutputSection({
  element,
  input,
  output,
}: InputOutputSectionProps) {
  return (
    <DetailSection title="Input / Output" icon={<IconArrowsExchange />}>
      <SignatureCard
        inputs={input}
        outputs={output}
        owner={partOwnerOf(element)}
      />
    </DetailSection>
  );
}

/** Shown only when the behavior takes or gives anything at all. */
InputOutputSection.shows = ({ input, output }: InputOutputSectionProps) =>
  input.length + output.length > 0;
