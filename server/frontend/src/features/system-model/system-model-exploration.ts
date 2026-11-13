/*
 * The scanned model read as a graph: its modules, building blocks and
 * behaviors, and its list of relations read as it is. A module contains the
 * modules and building blocks it holds ('module_contains_module',
 * 'module_contains_block'); a building block contains the behaviors it
 * exposes. A building block has as state the blocks its state is typed by
 * ('has_state'), a behavior has as input the blocks it takes ('has_input')
 * and as output the block it gives back ('has_output'); a block works with
 * the blocks it holds to do its work — a repository, a service, an
 * integration ('has_collaborator'); a block extends the
 * blocks it extends or implements. "Is part of" is containment read from the
 * inside. A behavior invokes the behaviors the scan found it calls, in the
 * order of the calls — where the scanner records calls; one that does not
 * leaves the model without any. An actor performs manual processes
 * ('performs'), and a manual process invokes behaviors in order
 * ('process_invokes_behavior'), as a behavior does; neither is contained by
 * anything. What the code is built into and runs on cuts across the modules,
 * so none of it contains anything either: a deployable unit ships modules
 * ('unit_contains_module'), a library provides blocks
 * ('library_contains_block'), a layer places blocks in its slice of the
 * code ('layer_contains_block'), and a deployment container runs units
 * ('container_contains_unit'), each an edge.
 */

export * from './exploration-relations.ts';
export * from './exploration.model.ts';
export * from './exploration-sections.ts';
export * from './exploration-choice.ts';
export * from './exploration-graph.ts';
export * from './exploration-reach.ts';
export * from './exploration-slots.ts';
