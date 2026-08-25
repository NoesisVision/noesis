import {
  inlineRender,
  withGroup,
  withUseCaseTail,
} from '@/components/design-doc/block/shared';

export const qualityAttribute = withUseCaseTail(
  withGroup(
    inlineRender(({ block, children }) => (
      <div className="pl-4">
        <span
          contentEditable={false}
          className="mr-2 select-none text-muted-foreground"
        >
          •
        </span>
        {typeof block.props.name === 'string' && block.props.name !== '' && (
          <strong
            contentEditable={false}
            className="mr-1 select-none font-semibold"
          >
            {block.props.name}:
          </strong>
        )}
        {children}
      </div>
    )),
  ),
);
