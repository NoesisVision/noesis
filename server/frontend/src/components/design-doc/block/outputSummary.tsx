import {
  inlineRender,
  withGroup,
  withUseCaseTail,
} from '@/components/design-doc/block/shared';

export const outputSummary = withUseCaseTail(
  withGroup(inlineRender(({ children }) => <div>{children}</div>)),
);
