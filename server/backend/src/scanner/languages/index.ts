import type { LanguageScanner } from '../language-scanner.js';
import { javaScanner } from './java/java-scanner.js';
import { typescriptScanner } from './typescript/typescript-scanner.js';

/**
 * Every language the service scans. Order is the order units are reported
 * in; it does not affect what is written, since each scanner owns its files.
 */
export const languageScanners: readonly LanguageScanner[] = [
  typescriptScanner,
  javaScanner,
];
