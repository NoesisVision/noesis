import {
  inlineRender,
  withGroup,
  withUseCaseTail,
} from '@/components/design-doc/block/shared';

export const useCaseDescription = withUseCaseTail(
  withGroup(
    inlineRender(({ children }) => (
      <div className="whitespace-pre-wrap">{children}</div>
    )),
  ),
);
