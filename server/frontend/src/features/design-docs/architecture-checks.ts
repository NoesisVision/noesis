import { plural } from '#/shared/ui/plural.ts';
import {
  type ArchitectureCheck,
  type ArchitectureOutline,
  elementsOf,
} from './architecture-outline.ts';
import { moduleOf, nameOf } from './element-id.ts';

/*
 * What a hexagonal architecture asks of a design, checked against what the
 * document holds: building block types, visibility, and the types properties,
 * inputs and outputs use. The document has no calls, so nothing here says
 * which service uses which port — only what the types already give away.
 *
 * Each check names the elements it concerns, or, when it passes, the ones it
 * looked at, so a reviewer can see what a pass covers.
 */

type Placed = Pick<ArchitectureOutline, 'hexagons' | 'unplaced'>;

const LEVEL_ORDER: ArchitectureCheck['level'][] = ['warning', 'note', 'pass'];

/** Every check, the failing ones first and in the order a reviewer acts on them. */
export function architectureChecks(placed: Placed): ArchitectureCheck[] {
  return [
    domainDependsOnNoPort(placed),
    onlyApplicationServicesArePublic(placed),
    noTypeCrossesHexagons(placed),
    typeInNoContract(placed),
    callerUnknown(placed),
  ].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));
}

function domainDependsOnNoPort({ hexagons }: Placed): ArchitectureCheck {
  const ports = new Set(
    hexagons.flatMap((hexagon) =>
      [...hexagon.drivenPorts, ...hexagon.applicationServices].map(
        ({ id }) => id,
      ),
    ),
  );
  const core = hexagons.flatMap(({ domainCore }) => domainCore);
  const offending = core.flatMap((element) =>
    element.uses
      .filter((used) => ports.has(used))
      .map((used) => [element.id, used] as const),
  );
  const title = 'Domain depends on no port';
  if (offending.length === 0)
    return pass(
      'domain-depends-on-no-port',
      title,
      'No property, input or output of a domain block uses a repository, an external integration or an application service.',
      core.map(({ id }) => id),
    );
  return {
    id: 'domain-depends-on-no-port',
    level: 'warning',
    title,
    text: `${sentence(offending.map(([element, used]) => `${nameOf(element)} uses ${nameOf(used)}`))}: the domain core reaches out past its ports.`,
    elementIds: unique(offending.flat()),
  };
}

function onlyApplicationServicesArePublic({
  hexagons,
}: Placed): ArchitectureCheck {
  const exposed = hexagons.flatMap((hexagon) => hexagon.exposed);
  const title = 'Only application services are public';
  if (exposed.length === 0) {
    const ports = hexagons.flatMap(({ drivingPorts }) =>
      drivingPorts.map(({ behaviour }) => behaviour),
    );
    return pass(
      'only-application-services-are-public',
      title,
      ports.length === 0
        ? 'The design makes no behaviour public.'
        : `Every public behaviour, ${list(ports)}, is on an application service.`,
      ports.map(({ id }) => id),
    );
  }
  return {
    id: 'only-application-services-are-public',
    level: 'warning',
    title,
    text: `${list(exposed)} ${plural(exposed.length, 'is', 'are')} public on a block that is not an application service: the core is exposed past its ports.`,
    elementIds: exposed.map(({ id }) => id),
  };
}

function noTypeCrossesHexagons({ hexagons }: Placed): ArchitectureCheck {
  const crossing = hexagons.flatMap((hexagon) =>
    elementsOf(hexagon).flatMap((element) =>
      element.uses
        .filter((used) => moduleOf(used) !== hexagon.module.id)
        .map((used) => [element.id, used] as const),
    ),
  );
  const title = 'No type crosses hexagons';
  if (crossing.length === 0)
    return pass(
      'no-type-crosses-hexagons',
      title,
      crossingPassText(hexagons.map(({ module }) => module.name)),
      hexagons.map(({ module }) => module.id),
    );
  return {
    id: 'no-type-crosses-hexagons',
    level: 'warning',
    title,
    text: `${sentence(crossing.map(([element, used]) => `${nameOf(element)} uses ${nameOf(used)} of ${nameOf(moduleOf(used))}`))}.`,
    elementIds: unique(crossing.flat()),
  };
}

/** Types: the blocks a property, an input or an output can be of. */
const TYPES = ['aggregate', 'entity', 'value_object'];

function typeInNoContract({ hexagons, unplaced }: Placed): ArchitectureCheck {
  const used = new Set(
    [...hexagons.flatMap(elementsOf), ...unplaced].flatMap(({ uses }) => uses),
  );
  const types = hexagons
    .flatMap(({ domainCore }) => domainCore)
    .filter(({ pattern }) => pattern !== null && TYPES.includes(pattern));
  const unused = types.filter(({ id }) => !used.has(id));
  const title = 'Type in no contract';
  if (unused.length === 0)
    return pass(
      'type-in-no-contract',
      title,
      'Every aggregate, entity and value object is used by a property, an input or an output.',
      types.map(({ id }) => id),
    );
  return {
    id: 'type-in-no-contract',
    level: 'warning',
    title,
    text: `${list(unused)} ${plural(unused.length, 'is', 'are')} used by no property, input or output.`,
    elementIds: unused.map(({ id }) => id),
  };
}

function callerUnknown({ hexagons }: Placed): ArchitectureCheck {
  const ports = hexagons.flatMap(({ drivingPorts }) => drivingPorts);
  const unknown = ports.filter(({ actors }) => actors.length === 0);
  const title = 'Caller unknown';
  if (unknown.length === 0)
    return pass(
      'caller-unknown',
      title,
      'Every public behaviour names the actors that call it.',
      ports.map(({ behaviour }) => behaviour.id),
    );
  const behaviours = unknown.map(({ behaviour }) => behaviour);
  return {
    id: 'caller-unknown',
    level: 'note',
    title,
    text: `${list(behaviours)} ${plural(behaviours.length, 'is', 'are')} public and ${plural(behaviours.length, 'names', 'name')} no actor, so another subsystem calls ${plural(behaviours.length, 'it', 'them')}. Which one is not in the design document.`,
    elementIds: behaviours.map(({ id }) => id),
  };
}

function crossingPassText(modules: string[]): string {
  const [one, other] = modules;
  if (modules.length === 2)
    return `No property, input or output in ${one} uses a type of ${other}, or the other way round.`;
  return modules.length < 2
    ? 'No property, input or output uses a type of another module.'
    : 'No property, input or output in one hexagon uses a type of another.';
}

function pass(
  id: string,
  title: string,
  text: string,
  elementIds: string[],
): ArchitectureCheck {
  return { id, level: 'pass', title, text, elementIds };
}

/** `A`, `A and B`, `A, B and C`. */
function list(named: { name: string }[]): string {
  const names = named.map(({ name }) => name);
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** Clauses of one finding, joined into one sentence. */
const sentence = (clauses: string[]) => clauses.join('; ');

const unique = (ids: readonly string[]) => [...new Set(ids)];
