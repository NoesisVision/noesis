import {
  inlineRender,
  withUseCaseTail,
} from '@/components/design-doc/block/shared';

export const useCaseSummary = withUseCaseTail(
  inlineRender(({ children }) => (
    <div className="text-[16px] leading-relaxed">{children}</div>
  )),
);
