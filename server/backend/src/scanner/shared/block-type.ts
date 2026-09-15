import type { DesignedBuildingBlockType } from '@repo/shared-contracts';

/**
 * A conventional-name heuristic shared by the scanners for classes that
 * carry no stereotype annotation; everything else is left for a person to type.
 */
export function typeOfName(
  className: string,
): DesignedBuildingBlockType | null {
  if (/Repository$/.test(className)) return 'repository';
  if (/Service$/.test(className)) return 'application_service';
  if (/Factory$/.test(className)) return 'factory';
  if (/(Client|Gateway|Adapter)$/.test(className))
    return 'external_integration';
  if (/(Event)$/.test(className)) return 'domain_event';
  if (/(Command)$/.test(className)) return 'domain_command';
  if (/(Query)$/.test(className)) return 'domain_query';
  return null;
}
