'use client';
import { useMemo, type ReactNode } from 'react';
import { appPreferencesPlugin } from '@bitakit/app-preferences/foundation';
import { useSettings } from '@bitakit/app-preferences';
import './foundation-services';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { FoundationProvider, type Confirmation, type Plugin } from '@bitakit/ui';
import { foundationConfig } from '../../.foundation/plugins';
import { foundationUI } from '@/components/foundation/ui';
export function AppFoundationProvider({
  children,
  confirm,
  plugins,
}: {
  children: ReactNode;
  plugins: readonly Plugin[];
  confirm: (request: Confirmation) => Promise<boolean>;
}) {
  const t = useTranslations();
  const settings = useSettings();
  const selectedPlugins = useMemo(
    () => [
      appPreferencesPlugin({ settings, provideSettings: false }),
      ...foundationConfig.plugins,
      ...plugins,
    ],
    [settings, plugins],
  );
  const services = useMemo(() => ({ settings, confirm }), [settings, confirm]);
  return (
    <FoundationProvider
      config={foundationConfig}
      services={services}
      ui={foundationUI}
      plugins={selectedPlugins}
      notify={(message, kind) =>
        kind === 'failure' ? toast.error(message) : toast.success(message)
      }
      labels={{
        cancel: t('Foundation.cancel'),
        submit: t('Foundation.submit'),
        pending: t('Foundation.pending'),
        invalid: t('Foundation.invalid'),
        unavailable: t('Foundation.unavailable'),
      }}
    >
      {children}
    </FoundationProvider>
  );
}
