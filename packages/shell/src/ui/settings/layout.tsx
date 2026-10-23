'use client';
import type { ReactNode } from 'react';
import { Action, useSettingsCatalog, useTranslation, type SettingsCatalogField } from '@bitakit/ui';
import { Button, FieldGroup } from '@bitakit/ui/components';
import { Card, CardContent } from '../../components/ui/card.js';
import { AppearanceField } from './appearance-field.js';

/** Uses the Shell's existing field declarations and confirmed settings values. */
export function LayoutSettings({
  renderField,
}: {
  renderField?: (field: SettingsCatalogField) => ReactNode;
}) {
  const section = useSettingsCatalog().find((entry) => entry.id === 'shell');
  const t = useTranslation();
  const text = (key: string, fallback: string) => t(`shell.ui.themes.${key}`, undefined, fallback);
  return (
    <Card>
      <CardContent>
        <FieldGroup className="gap-6">
          {section?.fields
            .filter((field) => ['layout', 'density', 'toasts'].includes(field.name))
            .map((field) => (
              <div key={field.key} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  {renderField ? renderField(field) : <AppearanceField field={field} />}
                </div>
                {field.name === 'toasts' && (
                  <Action
                    id="shell.testNotification"
                    input={{
                      message: text('testNotificationMessage', 'This is a test notification.'),
                    }}
                  >
                    <Button variant="outline">{text('testNotification', 'Test')}</Button>
                  </Action>
                )}
              </div>
            ))}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
