import type {
  CodeModelFile,
  DeclarationNode,
  MethodNode,
  NodeId,
  ParseManifest,
  StubNode,
  TypeNode,
  TypeRef,
} from '../code-model/code-model';

/*
 * The code model files indexed for lookup: nodes, stubs and edges by id, per
 * artifact, and the resolution of an id across artifacts (section 8 of
 * docs/plans/code-model-to-system-model.md): the referencing artifact's own
 * nodes first, then its `source` dependencies in manifest order, each with
 * its own dependencies after it, then its stubs.
 */

/** A declaration found in the artifact that declares it. */
export interface Located<N extends DeclarationNode = DeclarationNode> {
  readonly artifact: IndexedArtifact;
  readonly node: N;
}

/** `(artifact id, node id)`: what identifies a declaration across the whole scan. */
export type GlobalId = string & { readonly __brand: 'GlobalId' };

export function globalId(artifact: IndexedArtifact, nodeId: NodeId): GlobalId {
  return `${artifact.id}\u0000${nodeId}` as GlobalId;
}

export class IndexedArtifact {
  readonly id: NodeId;
  readonly file: CodeModelFile;
  readonly nodes = new Map<NodeId, DeclarationNode>();
  readonly stubs = new Map<NodeId, StubNode>();
  /** `CONTAINS`: the parent of each node. */
  readonly parentOf = new Map<NodeId, NodeId>();
  /** `CONTAINS`: the children of each node, in edge order. */
  readonly childrenOf = new Map<NodeId, NodeId[]>();
  /** `EXTENDS` and `IMPLEMENTS`: the direct supertypes of each type. */
  readonly supertypesOf = new Map<NodeId, TypeRef[]>();
  /** `OVERRIDES` and `IMPLEMENTS_MEMBER`: the members each member stands in for. */
  readonly overriddenBy = new Map<NodeId, NodeId[]>();
  /** `INVOKES`: the methods each node calls, in edge order, repeats kept. */
  readonly invokedBy = new Map<NodeId, NodeId[]>();
  /** The ids of the `source` artifacts this one depends on, in declaration order. */
  readonly sourceDependencies: readonly NodeId[];

  constructor(file: CodeModelFile) {
    this.id = file.artifact.id;
    this.file = file;
    for (const node of file.nodes) this.nodes.set(node.id, node);
    for (const stub of file.stubs) this.stubs.set(stub.id, stub);
    for (const edge of file.edges) {
      switch (edge.kind) {
        case 'CONTAINS':
          this.parentOf.set(edge.to, edge.from);
          push(this.childrenOf, edge.from, edge.to);
          break;
        case 'EXTENDS':
        case 'IMPLEMENTS':
          push(this.supertypesOf, edge.from, edge.to);
          break;
        case 'OVERRIDES':
        case 'IMPLEMENTS_MEMBER':
          push(this.overriddenBy, edge.from, edge.to);
          break;
        case 'INVOKES':
          push(this.invokedBy, edge.from, edge.to);
          break;
        default:
          break;
      }
    }
    this.sourceDependencies = file.artifact.dependencies
      .filter((dependency) => dependency.kind === 'source')
      .map((dependency) => dependency.id);
  }

  /** The nodes `parent` contains, in edge order. */
  children(parent: NodeId): DeclarationNode[] {
    return (this.childrenOf.get(parent) ?? []).flatMap((id) => {
      const node = this.nodes.get(id);
      return node === undefined ? [] : [node];
    });
  }

  /** The types enclosing `id`, outermost first, then the namespace's dotted name. */
  enclosing(id: NodeId): { types: TypeNode[]; namespace: string | null } {
    const types: TypeNode[] = [];
    let current = this.parentOf.get(id);
    while (current !== undefined) {
      const node = this.nodes.get(current);
      if (node === undefined) break;
      if (node.kind === 'namespace') {
        return { types: types.reverse(), namespace: namespaceName(node.id) };
      }
      if (node.kind === 'type') types.push(node);
      current = this.parentOf.get(current);
    }
    return { types: types.reverse(), namespace: null };
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

/** `N:A.B` is the namespace `A.B`; `N:` is the global namespace, which has no name. */
export function namespaceName(id: NodeId): string | null {
  const name = id.slice(2);
  return name === '' ? null : name;
}

export class CodeModelIndex {
  /** In manifest order, which is dependency order. */
  readonly artifacts: readonly IndexedArtifact[];
  private readonly byId = new Map<NodeId, IndexedArtifact>();
  /** The artifacts each one looks ids up in, itself first. */
  private readonly lookupOrder = new Map<NodeId, IndexedArtifact[]>();

  constructor(manifest: ParseManifest, files: readonly CodeModelFile[]) {
    const indexed = new Map(
      files.map((file) => [file.artifact.id, new IndexedArtifact(file)]),
    );
    this.artifacts = manifest.artifacts.flatMap(({ id }) => {
      const artifact = indexed.get(id);
      return artifact === undefined ? [] : [artifact];
    });
    for (const artifact of this.artifacts) this.byId.set(artifact.id, artifact);
  }

  /**
   * The declaration `id` names from `from`: its own, or one of a `source`
   * dependency's; null for a stub or an unknown id.
   */
  resolve(from: IndexedArtifact, id: NodeId): Located | null {
    for (const artifact of this.orderFor(from)) {
      const node = artifact.nodes.get(id);
      if (node !== undefined) return { artifact, node };
    }
    return null;
  }

  resolveMethod(from: IndexedArtifact, id: NodeId): Located<MethodNode> | null {
    const located = this.resolve(from, id);
    return located?.node.kind === 'method'
      ? (located as Located<MethodNode>)
      : null;
  }

  private orderFor(from: IndexedArtifact): IndexedArtifact[] {
    let order = this.lookupOrder.get(from.id);
    if (order === undefined) {
      order = [];
      const seen = new Set<NodeId>();
      const visit = (artifact: IndexedArtifact) => {
        if (seen.has(artifact.id)) return;
        seen.add(artifact.id);
        order!.push(artifact);
        for (const dependency of artifact.sourceDependencies) {
          const next = this.byId.get(dependency);
          if (next !== undefined) visit(next);
        }
      };
      visit(from);
      this.lookupOrder.set(from.id, order);
    }
    return order;
  }
}
