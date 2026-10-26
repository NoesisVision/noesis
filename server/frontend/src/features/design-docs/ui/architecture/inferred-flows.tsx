import { KindIcon } from '#/features/design-docs/ui/model-tree/kind-icon.tsx';
import type { OutlineTree } from '#/features/design-docs/ui/model-tree/outline-tree.ts';
import { Anchor } from '#/shared/design-system/anchor.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import type { InferredFlow } from '../../design-doc-architecture.ts';
import { addressOf, nameOf, ownerOf } from '../../element-id.ts';
import { DetailSection } from '../element-details/body/sections/detail-section.tsx';
import { useElementNavigation } from '../element-details/element-navigation.ts';
import { ElementTooltip } from '../element-details/element-tooltip.tsx';
import classes from './architecture-details.module.css';

/**
 * What the element's types suggest flows to and from other behaviours, under
 * the block each of those behaviours belongs to: `gives Money to ApplyOn`
 * under `ThresholdDiscount`. A type, a behaviour and a block each open their
 * row when the tree has one, and say what they are on hover, as a
 * behaviour's signature does.
 */
export function InferredFlows({
  flows,
  modelTree,
}: {
  flows: InferredFlow[];
  /** The model's own tree, where each block finds its kind. */
  modelTree: OutlineTree;
}) {
  return (
    <DetailSection
      title="Flow inferred from types"
      count={flows.length}
      order={3}
    >
      <Stack gap="sm">
        {byOwner(flows).map(([owner, owned]) => {
          const node = modelTree.byPath.get(owner);
          return (
            <Stack key={owner} component="section" gap={4}>
              <Group gap={6} wrap="nowrap" fz="sm" fw={600}>
                {node !== undefined && (
                  <KindIcon kind={node.kind} pattern={node.pattern} size={14} />
                )}
                <ElementLink id={owner} />
              </Group>
              <Stack
                component="ul"
                gap={4}
                m={0}
                pl={20}
                fz="sm"
                className={classes.list}
              >
                {owned.map((flow) => (
                  <Group
                    component="li"
                    key={`${flow.direction}:${flow.type}:${flow.other.id}`}
                    align="baseline"
                    gap="xs"
                    wrap="nowrap"
                  >
                    <Text
                      component="span"
                      flex="none"
                      w="3.5rem"
                      fz="xs"
                      fw={600}
                      c="var(--noesis-secondary-text)"
                    >
                      {flow.direction}
                    </Text>
                    <Text component="span" inherit>
                      <ElementLink id={flow.type} code />
                      {flow.direction === 'gives' ? ' to ' : ' from '}
                      <ElementLink id={flow.other.id} />
                      {flow.typeMatchOnly && (
                        <Text
                          component="span"
                          inherit
                          fs="italic"
                          c="var(--noesis-secondary-text)"
                        >
                          {' · type match only'}
                        </Text>
                      )}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Stack>
          );
        })}
      </Stack>
    </DetailSection>
  );
}

/** The flows by the block their other end belongs to, each block where its first flow stands. */
function byOwner(flows: InferredFlow[]): [string, InferredFlow[]][] {
  const owners = new Map<string, InferredFlow[]>();
  for (const flow of flows) {
    const owner = ownerOf(flow.other.id);
    const owned = owners.get(owner);
    if (owned) owned.push(flow);
    else owners.set(owner, [flow]);
  }
  return [...owners];
}

/**
 * An element by its own name, what it is on hover, and a link to its row
 * when the tree has one; a type set as code, as a signature sets it.
 */
function ElementLink({ id, code = false }: { id: string; code?: boolean }) {
  const { has, select } = useElementNavigation();
  const ff = code ? 'monospace' : undefined;
  return (
    <ElementTooltip name={addressOf(id)} hint>
      {has(id) ? (
        <Anchor component="button" inherit ff={ff} onClick={() => select(id)}>
          {nameOf(id)}
        </Anchor>
      ) : (
        <Text component="span" inherit ff={ff}>
          {nameOf(id)}
        </Text>
      )}
    </ElementTooltip>
  );
}
