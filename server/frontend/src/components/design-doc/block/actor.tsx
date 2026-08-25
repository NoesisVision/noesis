import {
  inlineRender,
  withSection,
} from '@/components/design-doc/block/shared';

export const actor = withSection(
  inlineRender(({ block, children }) => (
    <div className="pl-4">
      <span
        contentEditable={false}
        className="mr-2 select-none text-muted-foreground"
      >
        •
      </span>
      <strong className="font-semibold">{children}</strong>
      <span
        contentEditable={false}
        className="ml-2 select-none text-[13px] text-muted-foreground"
      >
        — {block.props.kind === 'system' ? 'external system' : 'human role'}
        {typeof block.props.description === 'string' &&
          block.props.description !== '' &&
          ` · ${block.props.description}`}
      </span>
    </div>
  )),
);
