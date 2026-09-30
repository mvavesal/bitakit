import type { Translator } from './definitions.js';
export type AuthSnapshot = {
  user: { id: string; name?: string; email?: string } | null;
  pending: boolean;
  error: unknown;
};
export interface AuthService {
  getSnapshot(): AuthSnapshot;
  subscribe(listener: () => void): () => void;
  signOut(): Promise<void>;
}
/** Nested, read-only message data supplied by the translation provider. */
export type TranslationCatalog = { readonly [key: string]: string | TranslationCatalog };
export interface TranslationService {
  translate: Translator;
  /** Current raw message group; undefined when unavailable. No vendor-specific types. */
  getCatalog?(namespace?: string): TranslationCatalog | undefined;
  subscribe(listener: () => void): () => void;
}

import { serviceKey } from './service-key.js';
export const authService = serviceKey<AuthService>('auth');
export const translationService = serviceKey<TranslationService>('i18n');
