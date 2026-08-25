import {
  HeadingNum,
  inlineRender,
  withUseCaseTail,
} from '@/components/design-doc/block/shared';
import { cn } from '@/lib/utils';

/** The use-case type badge colours: command blue, query green, event orange. */
const TYPE_BADGE_CLASSES: Record<string, string> = {
  Command: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  Query: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  Event:
    'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
};

export const useCaseHeading = withUseCaseTail(
  inlineRender(({ block, children }) => (
    <h4 className="dd-sec">
      <HeadingNum blockId={block.id} />
      {children}
      {typeof block.props.type === 'string' && block.props.type !== '' && (
        <span
          contentEditable={false}
          className={cn(
            'ml-2 inline-block select-none rounded px-1.5 align-middle text-[10.5px] font-semibold tracking-wide uppercase',
            TYPE_BADGE_CLASSES[block.props.type] ??
              'bg-secondary text-secondary-foreground',
          )}
        >
          {block.props.type}
        </span>
      )}
    </h4>
  )),
);
