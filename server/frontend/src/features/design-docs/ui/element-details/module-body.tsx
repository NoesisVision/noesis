import type { DesignedDomainModuleInput } from '#backend/app/design-docs/design-doc.ts';
import { Description } from './description.tsx';

export function ModuleBody({ module }: { module: DesignedDomainModuleInput }) {
  return <Description field={module.description} />;
}
