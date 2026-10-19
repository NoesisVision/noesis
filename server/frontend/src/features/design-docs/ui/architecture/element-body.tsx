import type { OutlineTree } from '#/features/design-docs/ui/model-tree/outline-tree.ts';
import { Box } from '#/shared/design-system/box.tsx';
import { Stack } from '#/shared/design-system/stack.tsx';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { bodySections } from '../element-details/body/body-sections.tsx';
import {
  SCENARIO_COLUMN_ID,
  ScenarioColumn,
} from '../element-details/body/scenario-column.tsx';
import { ScenarioFocusProvider } from '../element-details/body/scenario-focus.tsx';
import { scenariosOf } from '../element-details/body/scenarios-of.ts';
import classes from './architecture-details.module.css';

/**
 * The element as the model reads it, below what the architecture finds. The
 * document and the way to another element are the details' own, given
 * around it.
 */
export function ElementBody({
  id,
  document: doc,
  modelTree,
}: {
  id: string;
  document: DesignDocumentInput;
  /** The model's own tree, which the body sections read through. */
  modelTree: OutlineTree;
}) {
  const node = modelTree.byPath.get(id);
  if (node === undefined) return null;
  const scenarios = scenariosOf(node, doc);
  return (
    // Keyed, so every scenario is folded again on another element.
    <ScenarioFocusProvider key={id} scenarios={scenarios}>
      <Stack gap="xl">{bodySections(node, doc, modelTree)}</Stack>
      {/* Under the sections: the pane is too narrow for a column beside them. */}
      {scenarios.length > 0 && (
        <Box mx="-md" className={classes.scenarios}>
          <ScenarioColumn scenarios={scenarios} id={SCENARIO_COLUMN_ID} />
        </Box>
      )}
    </ScenarioFocusProvider>
  );
}
