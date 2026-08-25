import {
  inlineRender,
  withSection,
} from '@/components/design-doc/block/shared';

export const contextParagraph = withSection(
  inlineRender(({ children }) => (
    <p className="my-0.5 whitespace-pre-wrap">{children}</p>
  )),
);
