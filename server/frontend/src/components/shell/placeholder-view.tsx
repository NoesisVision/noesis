import type * as React from 'react';

// Views ship as placeholders in this feature — each real view (dashboard
// widgets, canvas, editor, settings forms) is its own piece of work. This keeps
// their framing consistent in the meantime.
export function PlaceholderView({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}
