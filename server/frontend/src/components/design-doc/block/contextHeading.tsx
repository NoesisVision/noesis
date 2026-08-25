import {
  HeadingNum,
  inlineRender,
  withSection,
} from '@/components/design-doc/block/shared';

// withSection so the first context anchors any trailing empty fixed
// sections' "not written yet" headings (it draws no heading of its own).
export const contextHeading = withSection(
  inlineRender(({ block, children }) => (
    <h2 className="dd-sec">
      <HeadingNum blockId={block.id} />
      {children}
      <span
        contentEditable={false}
        className="ml-2 select-none align-middle text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
      >
        context
      </span>
    </h2>
  )),
);
