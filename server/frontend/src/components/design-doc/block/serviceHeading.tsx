import { HeadingNum, inlineRender } from '@/components/design-doc/block/shared';

export const serviceHeading = inlineRender(({ block, children }) => (
  <h3 className="dd-sec">
    <HeadingNum blockId={block.id} />
    {children}
  </h3>
));
