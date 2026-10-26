import { z } from 'zod';

/**
 * The common code model every parser writes: one manifest and one file per
 * artifact under `<output root>/code-model/<language>/`. Described in
 * docs/arch/code-model.md. The .NET and Java parsers keep their own copies
 * of these shapes; their golden files are checked against this schema.
 * Objects are strict so a field added on one side fails the other.
 */

export const Language = z.enum(['csharp', 'java', 'typescript', 'php']);
export type Language = z.infer<typeof Language>;

/** `<kind-letter>:<canonical path>`; unique within one artifact file. */
export const NodeId = z.string().regex(/^[ANTMPF]:/);
export type NodeId = z.infer<typeof NodeId>;

const bagValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

/** Flat, scalar, language-prefixed facts; unknown keys are allowed and ignored. */
export const LanguageBag = z.record(z.string(), bagValue);
export type LanguageBag = z.infer<typeof LanguageBag>;

export const SourceSpan = z.strictObject({
  file: z.string(),
  startLine: z.number().int(),
  startColumn: z.number().int(),
  endLine: z.number().int(),
  endColumn: z.number().int(),
});
export type SourceSpan = z.infer<typeof SourceSpan>;

export const Visibility = z.enum([
  'public',
  'protected',
  'private',
  'artifact',
  'namespace',
  'file',
  'protectedOrArtifact',
  'protectedAndArtifact',
  'protectedOrNamespace',
]);
export type Visibility = z.infer<typeof Visibility>;

export const Modifier = z.enum([
  'static',
  'abstract',
  'final',
  'virtual',
  'hiding',
  'readonly',
  'record',
  'volatile',
  'async',
  'external',
]);
export type Modifier = z.infer<typeof Modifier>;

export const Passing = z.enum(['value', 'ref']);
export type Passing = z.infer<typeof Passing>;

export const Origin = z.enum(['declared', 'generated']);
export type Origin = z.infer<typeof Origin>;

export const TypeKind = z.enum([
  'class',
  'interface',
  'struct',
  'enum',
  'delegate',
  'trait',
  'typeAlias',
]);
export type TypeKind = z.infer<typeof TypeKind>;

export interface Signature {
  readonly parameters: readonly Parameter[];
  readonly returnType: TypeRef;
  readonly returnPassing: Passing;
  readonly returnAnnotations: readonly Annotation[];
}

export interface Parameter {
  readonly name: string;
  readonly type: TypeRef;
  readonly passing: Passing;
  readonly variadic: boolean;
  readonly optional: boolean;
  readonly defaultValue: string | null;
  readonly annotations: readonly Annotation[];
  readonly languageSpecific: LanguageBag;
}

export interface Annotation {
  readonly type: TypeRef;
  readonly arguments: readonly {
    readonly name: string;
    readonly positional: boolean;
    readonly value: AnnotationValue;
  }[];
}

export type AnnotationValue =
  | { readonly kind: 'literal'; readonly text: string }
  | { readonly kind: 'type'; readonly type: TypeRef }
  | { readonly kind: 'enum'; readonly type: TypeRef; readonly member: string }
  | { readonly kind: 'array'; readonly items: readonly AnnotationValue[] }
  | { readonly kind: 'annotation'; readonly annotation: Annotation }
  | { readonly kind: 'other'; readonly text: string };

export type TypeRef =
  | {
      readonly kind: 'named';
      readonly type: NodeId;
      readonly typeArguments: readonly TypeRef[];
      readonly unbound: boolean;
      readonly nullable: boolean;
    }
  | {
      readonly kind: 'typeParameter';
      readonly owner: NodeId;
      readonly ordinal: number;
      readonly nullable: boolean;
    }
  | {
      readonly kind: 'array';
      readonly element: TypeRef;
      readonly rank: number;
      readonly nullable: boolean;
    }
  | {
      readonly kind: 'tuple';
      readonly elements: readonly {
        readonly name: string | null;
        readonly type: TypeRef;
      }[];
    }
  | {
      readonly kind: 'function';
      readonly signature: Signature;
      readonly callingConvention: string | null;
    }
  | {
      readonly kind: 'structural';
      readonly members: readonly {
        readonly name: string;
        readonly type: TypeRef;
      }[];
    }
  | { readonly kind: 'pointer'; readonly pointee: TypeRef }
  | { readonly kind: 'union'; readonly members: readonly TypeRef[] }
  | { readonly kind: 'intersection'; readonly members: readonly TypeRef[] }
  | { readonly kind: 'literal'; readonly text: string }
  | {
      readonly kind: 'primitive';
      readonly name: string;
      readonly nullable: boolean;
    }
  | { readonly kind: 'dynamic' }
  | { readonly kind: 'void' }
  | { readonly kind: 'unresolved'; readonly text: string }
  | { readonly kind: 'other'; readonly text: string };

export const TypeRef: z.ZodType<TypeRef> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('named'),
      type: NodeId,
      typeArguments: z.array(TypeRef),
      unbound: z.boolean(),
      nullable: z.boolean(),
    }),
    z.strictObject({
      kind: z.literal('typeParameter'),
      owner: NodeId,
      ordinal: z.number().int(),
      nullable: z.boolean(),
    }),
    z.strictObject({
      kind: z.literal('array'),
      element: TypeRef,
      rank: z.number().int(),
      nullable: z.boolean(),
    }),
    z.strictObject({
      kind: z.literal('tuple'),
      elements: z.array(
        z.strictObject({ name: z.string().nullable(), type: TypeRef }),
      ),
    }),
    z.strictObject({
      kind: z.literal('function'),
      signature: Signature,
      callingConvention: z.string().nullable(),
    }),
    z.strictObject({
      kind: z.literal('structural'),
      members: z.array(z.strictObject({ name: z.string(), type: TypeRef })),
    }),
    z.strictObject({ kind: z.literal('pointer'), pointee: TypeRef }),
    z.strictObject({ kind: z.literal('union'), members: z.array(TypeRef) }),
    z.strictObject({
      kind: z.literal('intersection'),
      members: z.array(TypeRef),
    }),
    z.strictObject({ kind: z.literal('literal'), text: z.string() }),
    z.strictObject({
      kind: z.literal('primitive'),
      name: z.string(),
      nullable: z.boolean(),
    }),
    z.strictObject({ kind: z.literal('dynamic') }),
    z.strictObject({ kind: z.literal('void') }),
    z.strictObject({ kind: z.literal('unresolved'), text: z.string() }),
    z.strictObject({ kind: z.literal('other'), text: z.string() }),
  ]),
);

export const AnnotationValue: z.ZodType<AnnotationValue> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('literal'), text: z.string() }),
    z.strictObject({ kind: z.literal('type'), type: TypeRef }),
    z.strictObject({
      kind: z.literal('enum'),
      type: TypeRef,
      member: z.string(),
    }),
    z.strictObject({
      kind: z.literal('array'),
      items: z.array(AnnotationValue),
    }),
    z.strictObject({ kind: z.literal('annotation'), annotation: Annotation }),
    z.strictObject({ kind: z.literal('other'), text: z.string() }),
  ]),
);

export const Annotation: z.ZodType<Annotation> = z.lazy(() =>
  z.strictObject({
    type: TypeRef,
    arguments: z.array(
      z.strictObject({
        name: z.string(),
        positional: z.boolean(),
        value: AnnotationValue,
      }),
    ),
  }),
);

export const Parameter: z.ZodType<Parameter> = z.lazy(() =>
  z.strictObject({
    name: z.string(),
    type: TypeRef,
    passing: Passing,
    variadic: z.boolean(),
    optional: z.boolean(),
    defaultValue: z.string().nullable(),
    annotations: z.array(Annotation),
    languageSpecific: LanguageBag,
  }),
);

export const Signature: z.ZodType<Signature> = z.lazy(() =>
  z.strictObject({
    parameters: z.array(Parameter),
    returnType: TypeRef,
    returnPassing: Passing,
    returnAnnotations: z.array(Annotation),
  }),
);

export const TypeParameterConstraint = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('type'), type: TypeRef }),
  z.strictObject({ kind: z.literal('referenceType') }),
  z.strictObject({ kind: z.literal('valueType') }),
  z.strictObject({ kind: z.literal('notNull') }),
  z.strictObject({ kind: z.literal('parameterlessConstructor') }),
  z.strictObject({ kind: z.literal('other'), text: z.string() }),
]);
export type TypeParameterConstraint = z.infer<typeof TypeParameterConstraint>;

export const TypeParameter = z.strictObject({
  name: z.string(),
  ordinal: z.number().int(),
  annotations: z.array(Annotation),
  variance: z.enum(['invariant', 'covariant', 'contravariant']),
  constraints: z.array(TypeParameterConstraint),
  languageSpecific: LanguageBag,
});
export type TypeParameter = z.infer<typeof TypeParameter>;

export const Diagnostic = z.strictObject({
  severity: z.enum(['error', 'warning', 'info']),
  code: z.string(),
  message: z.string(),
  location: SourceSpan.nullable(),
  source: z.enum(['compiler', 'parser']),
});
export type Diagnostic = z.infer<typeof Diagnostic>;

export const ArtifactKind = z.enum(['source', 'library', 'platform']);
export type ArtifactKind = z.infer<typeof ArtifactKind>;

export const ArtifactNode = z.strictObject({
  id: NodeId,
  kind: ArtifactKind,
  name: z.string(),
  version: z.string().nullable(),
  rootDirectory: z.string().nullable(),
  target: z.string(),
  executable: z.boolean(),
  dependencies: z.array(
    z.strictObject({
      id: NodeId,
      kind: ArtifactKind,
      package: z
        .strictObject({ id: z.string(), version: z.string() })
        .nullable(),
    }),
  ),
  annotations: z.array(Annotation),
  languageSpecific: LanguageBag,
});
export type ArtifactNode = z.infer<typeof ArtifactNode>;

const nodeBase = {
  id: NodeId,
  name: z.string(),
  origin: Origin,
  locations: z.array(SourceSpan),
  annotations: z.array(Annotation),
  documentation: z.string().nullable(),
  languageSpecific: LanguageBag,
};

export const NamespaceNode = z.strictObject({
  kind: z.literal('namespace'),
  ...nodeBase,
});
export type NamespaceNode = z.infer<typeof NamespaceNode>;

export const TypeNode = z.strictObject({
  kind: z.literal('type'),
  ...nodeBase,
  typeKind: TypeKind,
  visibility: Visibility,
  modifiers: z.array(Modifier),
  typeParameters: z.array(TypeParameter),
  underlyingType: TypeRef.nullable(),
  delegateSignature: Signature.nullable(),
  aliasOf: TypeRef.nullable(),
});
export type TypeNode = z.infer<typeof TypeNode>;

export const MethodNode = z.strictObject({
  kind: z.literal('method'),
  ...nodeBase,
  methodKind: z.enum([
    'method',
    'constructor',
    'staticInitializer',
    'destructor',
    'operator',
    'function',
  ]),
  visibility: Visibility,
  modifiers: z.array(Modifier),
  typeParameters: z.array(TypeParameter),
  signature: Signature,
  extensionReceiver: TypeRef.nullable(),
  bodiless: z.boolean(),
});
export type MethodNode = z.infer<typeof MethodNode>;

export const PropertyNode = z.strictObject({
  kind: z.literal('property'),
  ...nodeBase,
  visibility: Visibility,
  modifiers: z.array(Modifier),
  type: TypeRef,
  returnPassing: Passing,
  parameters: z.array(Parameter),
  extensionReceiver: TypeRef.nullable(),
  accessors: z.array(z.enum(['get', 'set', 'init', 'add', 'remove'])),
});
export type PropertyNode = z.infer<typeof PropertyNode>;

export const FieldNode = z.strictObject({
  kind: z.literal('field'),
  ...nodeBase,
  fieldKind: z.enum(['field', 'enumMember']),
  visibility: Visibility,
  modifiers: z.array(Modifier),
  type: TypeRef,
  passing: Passing,
  constantValue: z.string().nullable(),
});
export type FieldNode = z.infer<typeof FieldNode>;

export const DeclarationNode = z.discriminatedUnion('kind', [
  NamespaceNode,
  TypeNode,
  MethodNode,
  PropertyNode,
  FieldNode,
]);
export type DeclarationNode = z.infer<typeof DeclarationNode>;

/** One shape for every stubbed symbol; never visibility, modifiers, signatures or members. */
export const StubNode = z.strictObject({
  id: NodeId,
  kind: z.enum(['namespace', 'type', 'method', 'property', 'field']),
  name: z.string(),
  typeKind: TypeKind.nullable(),
  artifact: NodeId.nullable(),
});
export type StubNode = z.infer<typeof StubNode>;

export const UsageSite = z.strictObject({
  location: SourceSpan,
  viaClosure: z.boolean(),
  languageSpecific: LanguageBag,
});
export type UsageSite = z.infer<typeof UsageSite>;

export const ExpressionKind = z.enum([
  'this',
  'base',
  'typeParameter',
  'parameter',
  'local',
  'field',
  'property',
  'returnValue',
  'type',
  'creation',
  'literal',
  'other',
]);
export type ExpressionKind = z.infer<typeof ExpressionKind>;

export const Edge = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('CONTAINS'), from: NodeId, to: NodeId }),
  z.strictObject({ kind: z.literal('EXTENDS'), from: NodeId, to: TypeRef }),
  z.strictObject({
    kind: z.literal('IMPLEMENTS'),
    from: NodeId,
    to: TypeRef,
  }),
  z.strictObject({ kind: z.literal('OVERRIDES'), from: NodeId, to: NodeId }),
  z.strictObject({
    kind: z.literal('IMPLEMENTS_MEMBER'),
    from: NodeId,
    to: NodeId,
    interface: TypeRef,
    declaredOn: NodeId,
  }),
  z.strictObject({
    kind: z.literal('INVOKES'),
    from: NodeId,
    to: NodeId,
    typeArguments: z.array(TypeRef),
    site: UsageSite,
    invocationKind: z.enum(['call', 'extension']),
    receiver: ExpressionKind.nullable(),
  }),
  z.strictObject({
    kind: z.literal('ACCESSES'),
    from: NodeId,
    to: NodeId,
    access: z.enum(['read', 'write', 'readWrite']),
    site: UsageSite,
    receiver: ExpressionKind.nullable(),
  }),
  z.strictObject({
    kind: z.literal('USES_TYPE'),
    from: NodeId,
    to: TypeRef,
    role: z.enum(['creation', 'cast', 'typeTest']),
    site: UsageSite,
  }),
]);
export type Edge = z.infer<typeof Edge>;

const generator = z.strictObject({ name: z.string(), version: z.string() });

export const ParseManifest = z.strictObject({
  schemaVersion: z.literal(1),
  generator,
  language: Language,
  repository: z.strictObject({ name: z.string(), revision: z.string() }),
  root: z.string(),
  artifacts: z.array(z.strictObject({ id: NodeId, file: z.string() })),
  diagnostics: z.array(Diagnostic),
});
export type ParseManifest = z.infer<typeof ParseManifest>;

export const CodeModelFile = z.strictObject({
  schemaVersion: z.literal(1),
  generator,
  artifact: ArtifactNode,
  nodes: z.array(DeclarationNode),
  edges: z.array(Edge),
  stubs: z.array(StubNode),
  diagnostics: z.array(Diagnostic),
});
export type CodeModelFile = z.infer<typeof CodeModelFile>;
