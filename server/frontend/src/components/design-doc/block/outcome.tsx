import {
  inlineRender,
  withSection,
} from '@/components/design-doc/block/shared';

export const outcome = withSection(
  inlineRender(({ block, children }) => (
    <div className="pl-4">
      <span
        contentEditable={false}
        className="mr-2 select-none text-muted-foreground"
      >
        •
      </span>
      {children}
      {typeof block.props.measure === 'string' &&
        block.props.measure !== '' && (
          <span
            contentEditable={false}
            className="ml-2 select-none text-[13px] text-muted-foreground"
          >
            measure: {block.props.measure}
          </span>
        )}
    </div>
  )),
);
