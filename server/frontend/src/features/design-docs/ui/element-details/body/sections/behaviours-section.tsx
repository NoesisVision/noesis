import { Card } from '#/shared/design-system/card.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { KindIcon } from '#/shared/ui/model-tree/kind-icon.tsx';
import type { OutlineNode } from '#/shared/ui/model-tree/model-outline.ts';
import type { DesignedBehaviourInput } from '#backend/app/design-docs/design-doc.ts';
import { valueOf } from '../../../../design-doc-field.ts';
import { parameterItems, resultItems } from '../../change-list-items.ts';
import { useElementNavigation } from '../../element-navigation.ts';
import type { ElementRef } from '../../element-ref.ts';
import { DetailSection } from './detail-section.tsx';
import { InputOutputLists } from './input-output-section.tsx';
import { Ref } from './ref.tsx';
import classes from './change-list-section.module.css';

interface BehavioursSectionProps {
  element: ElementRef;
  /**
   * Each behaviour as the tree has it, with what the document says about it —
   * none for one the document only removes, or never names.
   */
  behaviours: { node: OutlineNode; behaviour: DesignedBehaviourInput | null }[];
}

/**
 * A building block's behaviours, each read in brief: what kind it is, what it
 * takes and gives back, and what it is for. Its name opens its row.
 */
export function BehavioursSection({ behaviours }: BehavioursSectionProps) {
  return (
    <DetailSection
      title="Behaviours"
      icon={<KindIcon kind="behaviour" pattern={null} />}
    >
      <Stack component="ul" gap="xs" p={0} m={0} style={{ listStyle: 'none' }}>
        {behaviours.map(({ node, behaviour }) => (
          <Card component="li" key={node.path} p="sm">
            <BehaviourName node={node} />
            {behaviour !== null && <BehaviourBody behaviour={behaviour} />}
          </Card>
        ))}
      </Stack>
    </DetailSection>
  );
}

function BehaviourName({ node }: { node: OutlineNode }) {
  const { has, select } = useElementNavigation();
  // Hidden from a screen reader by `KindIcon` itself: decorative.
  const icon = <KindIcon kind="behaviour" pattern={node.pattern} />;
  return has(node.path) ? (
    <UnstyledButton className={classes.item} onClick={() => select(node.path)}>
      {icon}
      <Ref change={node.change} name={node.name} interactive />
    </UnstyledButton>
  ) : (
    <Group gap="xs" wrap="nowrap">
      {icon}
      <Ref change={node.change} name={node.name} />
    </Group>
  );
}

function BehaviourBody({ behaviour }: { behaviour: DesignedBehaviourInput }) {
  const description = valueOf(behaviour.description)?.trim();
  return (
    <>
      <InputOutputLists
        input={parameterItems(behaviour.input)}
        output={resultItems(behaviour.output)}
      />
      {/* As written: a markdown reader per behaviour is too heavy a list. */}
      {description && (
        <Text size="xs" c="dimmed" mt="xs" style={{ whiteSpace: 'pre-line' }}>
          {description}
        </Text>
      )}
    </>
  );
}

/** Shown only when the block has behaviours at all. */
BehavioursSection.shows = ({ behaviours }: BehavioursSectionProps) =>
  behaviours.length > 0;
