'use client';
import { useState } from 'react';
import EyeIcon from 'reicon-react/icons/Eye';
import ClockIcon from 'reicon-react/icons/ClockCircle';
import HistoryIcon from 'reicon-react/icons/TimeBack';
import TrashIcon from 'reicon-react/icons/Trash2';
import { useService, useSetting, useTranslation } from '@bitakit/ui';
import { SettingField } from '@bitakit/app-preferences';
import {
  Button,
  Card,
  Item,
  ItemMedia,
  ItemContent,
  ItemActions,
  FieldTitle,
  FieldDescription,
  ItemGroup,
  ItemSeparator,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from '@bitakit/ui/components';
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
        <FieldLegend>{t('quickSearch.preferences', undefined, 'Preferences')}</FieldLegend>
        <Card size="sm" className="py-0">
          <ItemGroup className="gap-0 has-data-[size=xs]:gap-0">
            <Item size="xs" role="listitem">
              <ItemMedia variant="icon">
                <EyeIcon aria-hidden="true" />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <SettingField settingKey="quick-search.showSource" />
              </ItemContent>
            </Item>
            <ItemSeparator className="my-0" />
            <Item size="xs" role="listitem">
              <ItemMedia variant="icon">
                <ClockIcon aria-hidden="true" />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <SettingField settingKey="quick-search.showRecentResults" />
              </ItemContent>
            </Item>
            <ItemSeparator className="my-0" />
            <Item size="xs" role="listitem">
              <ItemMedia variant="icon">
                <HistoryIcon aria-hidden="true" />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <SettingField settingKey="quick-search.historyEnabled" />
              </ItemContent>
            </Item>
            <ItemSeparator className="my-0" />
            <Item size="xs" role="listitem" className="flex-nowrap">
              <ItemMedia variant="icon">
                <TrashIcon aria-hidden="true" />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <FieldTitle>{t('quickSearch.clearHistory', undefined, 'Clear history')}</FieldTitle>
                <FieldDescription>
                  {t(
                    'quickSearch.clearHistoryDescription',
                    undefined,
                    'Remove your saved searches and recently opened items.',
                  )}
                </FieldDescription>
              </ItemContent>
              <ItemActions>
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
              </ItemActions>
            </Item>
          </ItemGroup>
        </Card>
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
