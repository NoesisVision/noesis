import { IconMaximize, IconMinimize } from '@tabler/icons-react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { useFullscreenElement } from '#/shared/design-system/hooks.ts';
import { Text } from '#/shared/design-system/text.tsx';
import { IconHeading } from '#/shared/ui/icon-heading.tsx';
import { ModelTree } from '#/shared/ui/model-tree.tsx';
import { useModelTree } from '#/shared/ui/use-model-tree.ts';
import type { DesignDocDetail } from '../design-docs.api.ts';
import { DesignDocsIcon } from '../design-docs.model.ts';
import { ElementDetail } from './element-detail.tsx';
import classes from './design-doc-workbench.module.css';

/*
 * The design read as what it designs: the model on the left, the element in
 * hand on the right. The document's own name heads the page; the element's
 * name heads the panel, so the outline of the page is the outline of what is
 * being read.
 *
 * Mount it under the document's id — every piece of state here is about the
 * document open, and opening another one starts again rather than carrying a
 * selection that names nothing.
 */
export function DesignDocWorkbench({ detail }: { detail: DesignDocDetail }) {
  const { document: doc, outline } = detail;
  const controller = useModelTree(outline);
  const { ref, toggle, fullscreen } = useFullscreenElement<HTMLDivElement>();
  const fullscreenLabel = fullscreen ? 'Exit full screen' : 'Full screen';
  // A browser that refuses leaves the pane as it is, which is what the button
  // already shows, so there is nothing to report.
  const toggleFullscreen = () => void toggle().catch(() => {});
  const selected = controller.selectedNode;

  return (
    <Box component="article" ref={ref} className={classes.surface}>
      <Group justify="space-between" wrap="nowrap" className={classes.header}>
        <IconHeading
          title={doc.name.value}
          icon={DesignDocsIcon}
          description={detail.summary.implemented ? 'Implemented' : 'Draft'}
        />
        <ActionIcon
          variant="default"
          size="lg"
          aria-label={fullscreenLabel}
          title={fullscreenLabel}
          onClick={toggleFullscreen}
        >
          {fullscreen ? (
            <IconMinimize size={22} stroke={1.6} aria-hidden />
          ) : (
            <IconMaximize size={22} stroke={1.6} aria-hidden />
          )}
        </ActionIcon>
      </Group>

      <Box className={classes.columns}>
        <Box className={classes.pane}>
          {outline.length > 0 ? (
            <ModelTree controller={controller} label="Design outline" />
          ) : (
            <Text c="dimmed">This design names no elements yet.</Text>
          )}
        </Box>
        <Box className={classes.pane}>
          {selected === null ? (
            <Text c="dimmed">Choose an element to read it.</Text>
          ) : (
            <ElementDetail
              node={selected}
              path={controller.tree
                .ancestryOf(selected.path)
                .map((path) => controller.tree.byPath.get(path))
                .filter((node) => node !== undefined)}
              document={doc}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}
