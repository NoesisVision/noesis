import type { Language } from '../code-model';
import type { ParsedCode } from '../code-parser';
import { type BuiltSystemModel, buildSystemModel } from './build-system-model';
import { CSHARP_VOCABULARY } from './csharp.vocabulary';
import { JAVA_VOCABULARY } from './java.vocabulary';
import type { NamespaceConfig } from './namespace-config';
import type { AnnotationVocabulary } from './vocabulary';

/** The languages the builder has a vocabulary for; chosen by the manifest's `language`. */
const VOCABULARIES: Partial<Record<Language, AnnotationVocabulary>> = {
  csharp: CSHARP_VOCABULARY,
  java: JAVA_VOCABULARY,
};

/**
 * The second stage of a scan: builds the system model of a parsed code model,
 * by the vocabulary of the language its manifest names and the repository's
 * namespace settings.
 */
export class SystemModelBuilder {
  private readonly namespaces: NamespaceConfig;

  constructor(namespaces: NamespaceConfig) {
    this.namespaces = namespaces;
  }

  build({ manifest, files }: ParsedCode): BuiltSystemModel {
    return buildSystemModel({
      manifest,
      files,
      vocabulary: vocabularyOf(manifest.language),
      config: this.namespaces,
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
