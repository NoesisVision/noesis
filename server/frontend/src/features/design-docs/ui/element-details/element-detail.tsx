import { clsx } from 'clsx';
import { useMemo } from 'react';
import { KindIcon } from '#/features/design-docs/ui/model-tree/kind-icon.tsx';
import type { OutlineNode } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import type { OutlineTree } from '#/features/design-docs/ui/model-tree/outline-tree.ts';
import { Group } from '#/shared/design-system/group.tsx';
import { useElementSize } from '#/shared/design-system/hooks.ts';
import { Title } from '#/shared/design-system/title.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { findById } from '../../change-set.ts';
import type { PartOwner, UnitRef } from '../../design-doc-edit.ts';
import { type DesignDocFieldInput, valueOf } from '../../design-doc-field.ts';
import { InlineText } from '../unit-editor/inline-text.tsx';
import { useWritableUnit } from '../unit-editor/writable-unit.ts';
import { bodySections } from './body/body-sections.tsx';
import { SCENARIO_COLUMN_ID, ScenarioColumn } from './body/scenario-column.tsx';
import { ScenarioFocusProvider } from './body/scenario-focus.tsx';
import { scenariosOf } from './body/scenarios-of.ts';
import { ChangeBadge } from './change-badge.tsx';
import { implementerItems, refItems } from './change-list-items.ts';
import { DesignDocumentContext } from './design-document-context.ts';
import { DetailBreadcrumb } from './detail-breadcrumb.tsx';
import { ElementColumns } from './element-columns.tsx';
import { ElementDefinition } from './element-definition.tsx';
import { ElementNavigationContext } from './element-navigation.ts';
import { humanText, WrittenBy, writtenByHuman } from './human-mark.tsx';
import { ImplementedByModal } from './implemented-by-modal.tsx';
import { ImplementsLine } from './implements-line.tsx';
import { VisibilityBadge } from './visibility-badge.tsx';
import classes from './element-detail.module.css';

/*
 * One element of the design, read whole: where it sits, what it is, and what
 * the document says about it. The tree beside it says what changed; this says
 * what the thing is.
 */

export function ElementDetail({
  node,
  path,
  document: doc,
  onSelect,
  tree,
}: {
  node: OutlineNode;
  /** The line from the top of the tree down to the node, the node last. */
  path: readonly OutlineNode[];
  document: DesignDocumentInput;
  /** Takes the reader to another element, as the tree itself would. */
  onSelect: (path: string) => void;
  /** The tree beside the panel: what a section may open, and what changed under an element. */
  tree: OutlineTree;
}) {
  const navigation = useMemo(
    () => ({ has: (path: string) => tree.byPath.has(path), select: onSelect }),
    [tree, onSelect],
  );
  // Only a behaviour says who may call it.
  const visibility =
    node.kind === 'behaviour' && node.elementId
      ? valueOf(findById(doc.behaviours, node.elementId)?.visibility)
      : null;
  // Only a building block implements anything; it reads after its name.
  const implemented =
    node.kind === 'building_block' && node.elementId
      ? refItems(findById(doc.buildingBlocks, node.elementId)?.implements)
      : [];
  // And what implements it — found in the document even when it leaves the
  // block itself alone.
  const implementers =
    node.kind === 'building_block' && node.elementId
      ? implementerItems(doc, node.elementId)
      : [];
  // What the element is, under its name: a module's, a block's, a behaviour's.
  const designed = designedOf(doc, node);
  // An element the design leaves alone is still shown: its definition is too.
  const definition: DesignDocFieldInput<string> | undefined =
    designed === undefined
      ? undefined
      : (designed?.definition ?? { changed: false });
  // Scenarios read beside the sections, not as one more of them.
  const scenarios = scenariosOf(node, doc);
  // Where the element may be written, the column shows with none yet, for
  // the first to be added there.
  const scenariosWritable = useWritableUnit(elementRefOf(node)) !== null;
  // Measured outside the key below, so the width is known on every element.
  const { ref: bodyRef, width: bodyWidth } = useElementSize();
  const badges = (
    <Group gap="xs" ml="auto" className={classes.badges}>
      <VisibilityBadge visibility={visibility} />
      <ChangeBadge change={node.change} />
      <ImplementedByModal items={implementers} />
    </Group>
  );
  return (
    <DesignDocumentContext.Provider value={doc}>
      <ElementNavigationContext.Provider value={navigation}>
        <DetailBreadcrumb path={path} onSelect={onSelect} />
        <header className={classes.header}>
          <span className={classes.tile}>
            <KindIcon kind={node.kind} pattern={node.pattern} />
          </span>
          <div className={classes.heading}>
            {/* What it is on the left, what the design does to it on the
                right; with no kind to name, the badges end the name's line
                and the tile centres on the name alone. */}
            {node.patternLabel !== null && (
              <div className={classes.kind}>
                <span className={classes.pattern}>{node.patternLabel}</span>
                {badges}
              </div>
            )}
            <div className={classes.title}>
              <Title order={2} className={classes.name}>
                <NodeName node={node} field={designed?.name} />
              </Title>
              <ImplementsLine items={implemented} />
              {node.patternLabel === null && badges}
            </div>
          </div>
        </header>
        {definition !== undefined && (
          <ElementDefinition
            // Another element is another editor: it reads its markdown once.
            key={node.path}
            element={elementRefOf(node)}
            field={definition}
          />
        )}
        <div ref={bodyRef} className={classes.body}>
          {/* Under the key, so every scenario is folded again on another element. */}
          <ScenarioFocusProvider key={node.path} scenarios={scenarios}>
            <ElementColumns
              width={bodyWidth}
              sections={bodySections(node, doc, tree)}
              scenarios={
                scenarios.length > 0 || scenariosWritable ? (
                  <ScenarioColumn
                    scenarios={scenarios}
                    id={SCENARIO_COLUMN_ID}
                    owner={ownerOfScenarios(node)}
                  />
                ) : null
              }
            />
          </ScenarioFocusProvider>
        </div>
      </ElementNavigationContext.Provider>
    </DesignDocumentContext.Provider>
  );
}

/** The element a row stands for, as a unit; null for a part or a row of none. */
function elementRefOf(node: OutlineNode): UnitRef | null {
  if (node.elementId === null) return null;
  return node.kind === 'module' ||
    node.kind === 'building_block' ||
    node.kind === 'behaviour'
    ? { kind: node.kind, id: node.elementId }
    : null;
}

/** The element's name, written in place where the document may be written. */
function NodeName({
  node,
  field,
}: {
  node: OutlineNode;
  /** The name as the design writes it, for who wrote it. */
  field: DesignDocFieldInput<string> | undefined;
}) {
  const writable = useWritableUnit(elementRefOf(node));
  if (writable === null)
    return <WrittenBy fields={[field]}>{node.name}</WrittenBy>;
  return (
    <InlineText
      label="Name"
      human={writtenByHuman([field])}
      value={node.name}
      className={clsx(classes.nameText, humanText([field]))}
      onSave={(name) => writable.save({ name })}
    />
  );
}

/** The element the scenarios beside it are written in. */
/** What the design writes for the element a node shows; none for anything else. */
function designedOf(doc: DesignDocumentInput, node: OutlineNode) {
  if (!node.elementId) return undefined;
  const collection =
    node.kind === 'module'
      ? doc.modules
      : node.kind === 'building_block'
        ? doc.buildingBlocks
        : node.kind === 'behaviour'
          ? doc.behaviours
          : undefined;
  return collection === undefined
    ? undefined
    : (findById(collection, node.elementId) ?? null);
}

function ownerOfScenarios(node: OutlineNode): PartOwner | undefined {
  const ref = elementRefOf(node);
  return ref === null
    ? undefined
    : { kind: ref.kind as PartOwner['kind'], id: ref.id };
}
