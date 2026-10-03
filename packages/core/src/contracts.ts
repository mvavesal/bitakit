import type { AuthPaths, AuthSignInOptions } from './auth-navigation.js';
import type { Translator } from './definitions.js';
export type AuthSnapshot = {
  user: { id: string; name?: string; email?: string } | null;
  /** The active organization, when the provider tracks one; scopes organization settings. */
  organizationId?: string | null;
  pending: boolean;
  error: unknown;
};
export interface AuthService {
  /** Optional application-owned navigation configuration. */
  readonly paths?: AuthPaths;
  /** Optional SDK-native login flow; UI otherwise navigates to paths.signIn. */
  signIn?(options?: AuthSignInOptions): Promise<void>;
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
