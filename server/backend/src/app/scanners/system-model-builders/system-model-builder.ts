import type { Language } from '../code-parsers/code-model';
import type { ParsedCode } from '../code-parsers/code-parser';
import type { FeatureFileSource } from '../feature-files/feature-file';
import { type BuiltSystemModel, buildSystemModel } from './build-system-model';
import { CSHARP_VOCABULARY } from './csharp.vocabulary';
import { JAVA_VOCABULARY } from './java.vocabulary';
import type { LibraryManifest } from './library-manifest';
import type { NamespaceConfig } from './namespace-config';
import type { AnnotationVocabulary } from './vocabulary';

/** The languages the builder has a vocabulary for; chosen by the manifest's `language`. */
const VOCABULARIES: Partial<Record<Language, AnnotationVocabulary>> = {
  csharp: CSHARP_VOCABULARY,
  java: JAVA_VOCABULARY,
};

/**
 * The second stage of a scan: builds the system model of a parsed code model
 * and the repository's feature files, by the vocabulary of the language its
 * manifest names, the repository's namespace settings and the libraries it
 * describes by hand.
 */
export class SystemModelBuilder {
  private readonly namespaces: NamespaceConfig;
  private readonly libraries: readonly LibraryManifest[];

  constructor(
    namespaces: NamespaceConfig,
    libraries: readonly LibraryManifest[] = [],
  ) {
    this.namespaces = namespaces;
    this.libraries = libraries;
  }

  build(
    { manifest, files }: ParsedCode,
    featureFiles: readonly FeatureFileSource[],
  ): BuiltSystemModel {
    return buildSystemModel({
      manifest,
      files,
      featureFiles,
      vocabulary: vocabularyOf(manifest.language),
      config: this.namespaces,
      libraries: this.libraries,
    });
  }
}

function vocabularyOf(language: Language): AnnotationVocabulary {
  const vocabulary = VOCABULARIES[language];
  if (vocabulary === undefined) {
    throw new Error(
      `The system model builder has no annotation vocabulary for ${language} yet; the code model was read but cannot be built into a system model.`,
    );
  }
  return vocabulary;
}
