'use client';
import { useState } from 'react';
import { useService, useSetting, useTranslation } from '@bitakit/ui';
import { SettingField } from '@bitakit/app-preferences';
import { Button, FieldError, FieldGroup, FieldLegend, FieldSet } from '@bitakit/ui/components';
import { SourcePreferences } from '../source-preferences.js';
import '../../service.js';

/** Custom content within the standard App Preferences page shell. */
export function SearchSettingsPage() {
  const t = useTranslation();
  const service = useService('quick-search.search');
  const history = useSetting('quick-search.history');
  const [failed, setFailed] = useState(false);
  return (
    <FieldGroup className="quick-search-settings">
      <FieldSet>
        <FieldLegend>{t('quickSearch.sourceSettings', undefined, 'Search sources')}</FieldLegend>
        <SourcePreferences />
      </FieldSet>
      <FieldSet>
        <FieldLegend>{t('quickSearch.history', undefined, 'History')}</FieldLegend>
        <SettingField settingKey="quick-search.historyEnabled" />
        <Button
          variant="outline"
          disabled={
            !service ||
            history.disabled ||
            (!history.value.queries.length && !history.value.results.length)
          }
          onClick={() => {
            setFailed(false);
            void service?.clearHistory().catch(() => setFailed(true));
          }}
        >
          {t('quickSearch.clearHistory', undefined, 'Clear history')}
        </Button>
        {(failed || history.error) && (
          <FieldError>
            {t(
              'quickSearch.historyError',
              undefined,
              'Could not update search history. Try again.',
            )}
          </FieldError>
        )}
      </FieldSet>
    </FieldGroup>
  );
}
