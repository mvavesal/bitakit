'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { nextIntlPlugin } from '@bitakit/next-intl';
import { BitaKitProvider } from '../bitakit.gen';
import { createContentAuth } from '../auth';
import { language } from '../i18n/preferences';

/** Generated plugins plus the host's language declaration and native authentication composition. */
export function Providers({
  children,
  preview = false,
}: {
  children: ReactNode;
  preview?: boolean;
}) {
  const router = useRouter();
  const [translation] = useState(nextIntlPlugin);
  const [authentication] = useState(() =>
    createContentAuth(
      ({ to, replace }) => (replace ? router.replace(to) : router.push(to)),
      preview,
    ),
  );
  const plugins = useMemo(
    () => [translation, language.plugin, ...authentication.plugins],
    [authentication, translation],
  );
  return <BitaKitProvider additionalPlugins={plugins}>{children}</BitaKitProvider>;
}
