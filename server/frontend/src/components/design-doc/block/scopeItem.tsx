import {
  inlineRender,
  withSection,
} from '@/components/design-doc/block/shared';
import { cn } from '@/lib/utils';

export const scopeItem = withSection(
  inlineRender(({ block, children }) => (
    <div className="pl-4">
      <span
        contentEditable={false}
        className={cn(
          'mr-2 select-none rounded px-1 text-[10px] font-semibold uppercase',
          block.props.scope === 'out'
            ? 'bg-secondary text-muted-foreground'
            : 'bg-secondary text-secondary-foreground',
        )}
      >
        {block.props.scope === 'out' ? 'out' : 'in'}
      </span>
      {children}
    </div>
  )),
);
