'use client';
import { ActionButton } from '@bitakit/ui';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
} from '@bitakit/ui/components';

// Shell's own Action selects a theme; `app:<id>` is a file in src/themes/.
const themes = [
  { key: 'app:ocean', label: 'Use Ocean' },
  { key: 'app:sunset', label: 'Use Sunset' },
];

export default function GalleryPage() {
  return (
    <>
      <PageHeader title="Theme gallery" subtitle="Every component reads the same theme tokens." />
      <div className="flex flex-wrap gap-2">
        {themes.map((theme) => (
          <ActionButton
            key={theme.key}
            action="shell.selectTheme"
            input={{ key: theme.key }}
            as={Button}
            variant="outline"
          >
            {theme.label}
          </ActionButton>
        ))}
        <Button asChild variant="ghost">
          <a href="/settings/theme">Customize in Settings</a>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Badge>Badge</Badge>
          </div>
          <Input aria-label="Sample input" placeholder="Inputs use the theme too" />
        </CardContent>
      </Card>
    </>
  );
}
