import {
  inlineRender,
  type RenderProps,
  useGroupInfo,
  withGroup,
  withUseCaseTail,
} from '@/components/design-doc/block/shared';

/** A rule's `1.` marker — its position in the use case's rule list. */
// biome-ignore lint/style/useComponentExportOnlyModules: this module also exports the non-component rule renderer; RuleMarker is a private helper for it.
function RuleMarker({ block }: { block: RenderProps['block'] }) {
  const { index } = useGroupInfo(block);
  return (
    <span
      contentEditable={false}
      className="mr-2 select-none text-[13px] text-muted-foreground tabular-nums"
    >
      {index}.
    </span>
  );
}

export const rule = withUseCaseTail(
  withGroup(
    inlineRender(({ block, children }) => (
      <div className="pl-4">
        <RuleMarker block={block} />
        {children}
      </div>
    )),
  ),
);
