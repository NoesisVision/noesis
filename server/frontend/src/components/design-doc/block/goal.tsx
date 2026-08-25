import {
  inlineRender,
  withSection,
} from '@/components/design-doc/block/shared';

export const goal = withSection(
  inlineRender(({ children }) => (
    <div className="text-[17px] leading-relaxed">{children}</div>
  )),
);
