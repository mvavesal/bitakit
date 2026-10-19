'use client';
import { useContext, useMemo, useSyncExternalStore } from 'react';
import {
  getService,
  translationService,
  type Translator,
  type TranslationCatalog,
} from '@bitakit/core';
import { BitaKitContext } from '../providers/foundation-context.js';

export type Translate = ((
  key: string,
  values?: Parameters<Translator>[1],
  fallback?: string,
) => string) & {
  has(key: string): boolean;
  getCatalog(namespace?: string): TranslationCatalog | undefined;
};
const serverRevision = () => 0;
const notReady = () => false;
const idle = () => () => {};

/** Reactive access to the runtime's replaceable translator, including stable service functions. */
export function useTranslation(): Translate {
  const runtime = useContext(BitaKitContext)?.runtime;
  const ready = useSyncExternalStore(
    runtime?.subscribeReady ?? idle,
    runtime?.isReady ?? notReady,
    () => false,
  );
  const revision = useSyncExternalStore(
    runtime?.subscribeTranslations ?? idle,
    runtime?.getTranslationRevision ?? serverRevision,
    serverRevision,
  );
  return useMemo(() => {
    const translate: Translate = (key, values, fallback = key) =>
      runtime?.text(key, fallback, values) ?? fallback;
    translate.getCatalog = (namespace) =>
      ready && runtime?.hasService('i18n')
        ? getService(runtime.services, translationService).getCatalog?.(namespace)
        : undefined;
    translate.has = (key) => runtime?.translator().has?.(key) ?? false;
    return translate;
  }, [runtime, revision, ready]);
}
