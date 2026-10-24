'use client';
import { Action, useSetting } from '@bitakit/ui';
import { Button, PageHeader } from '@bitakit/ui/components';
import { SettingField } from '@bitakit/app-preferences';

const words = {
  en: { informal: 'Hello', formal: 'Good day' },
  de: { informal: 'Hallo', formal: 'Guten Tag' },
  es: { informal: 'Hola', formal: 'Buenos días' },
} as const;
const sizes = { small: 'text-base', medium: 'text-2xl', large: 'text-4xl' } as const;

export default function GreetingPage() {
  const name = useSetting('greeting.name').value;
  const formal = useSetting('greeting.formal').value;
  const language = useSetting('greeting.language').value;
  const size = useSetting('greeting.size').value;
  const company = useSetting('companyName').value;
  return (
    <>
      <PageHeader
        title="Greeting"
        subtitle={`Settings decide every word. Brought to you by ${company}.`}
      />
      <p className={sizes[size]}>
        {words[language][formal ? 'formal' : 'informal']}, {name}!
      </p>
      {/* The standard labelled field, outside /settings: same value, same saving. */}
      <SettingField settingKey="greeting.formal" />
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <a href="/settings/greeting">All greeting settings</a>
        </Button>
        <Action id="greeting.reset">
          <Button variant="ghost" />
        </Action>
      </div>
    </>
  );
}
