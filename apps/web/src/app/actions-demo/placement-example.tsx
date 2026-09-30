'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAction, useActionList } from '@bitakit/ui/actions';
import SettingsIcon from 'reicon-react/icons/Settings';
import PaletteIcon from 'reicon-react/icons/Palette';
import { useSettings } from '@bitakit/app-preferences';
import { exampleSettings, exampleSection } from '@/settings/examples/contribution';
import { useRegisterActions } from '@bitakit/ui/actions';
import { DrawerNavigation } from '@/components/navigation/drawer-navigation';
import { UserMenu } from '@/components/navigation/user-menu';
import { SettingsNavigation } from '@/components/settings/base/settings-navigation';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

const ID = 'demo.preferences';
/** A real, opt-in registration example. Its component owns cleanup, including on route exit. */
export function PlacementExample() {
  const [registered, setRegistered] = useState(false);
  const definitions = useMemo(() => (registered ? [exampleSettings()] : []), [registered]);
  useRegisterActions(definitions);
  const list = useActionList();
  const action = useAction(ID);
  const settings = useSettings();
  useEffect(() => {
    if (!registered) return;
    const contribution = settings.add(exampleSection());
    const sync = () => {
      const current = list.get(ID);
      if (current)
        settings.updateSection('example', {
          title: current.title,
          description: current.description,
          enabled: current.enabled,
          visible: current.visible,
          icon: current.icon,
          path: current.href?.split('/').pop() ?? 'example',
        });
    };
    sync();
    const unsubscribe = list.subscribe(sync);
    return () => {
      unsubscribe();
      contribution.remove();
    };
  }, [registered, settings, list]);
  return (
    <Card id="placement-example">
      <CardHeader>
        <CardTitle>
          <h2>One registration, multiple places</h2>
        </CardTitle>
        <CardDescription>
          Add a temporary settings contribution. Changes below affect every placement, including the
          actual settings route.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setRegistered((value) => !value)}>
            {registered ? 'Remove example' : 'Register example'}
          </Button>
          <Button
            variant="outline"
            disabled={!action}
            onClick={() => list.update(ID, { enabled: !action?.enabled })}
          >
            {action?.enabled ? 'Disable example' : 'Enable example'}
          </Button>
          <Button
            variant="outline"
            disabled={!action}
            onClick={() => list.update(ID, { visible: !action?.visible })}
          >
            {action?.visible ? 'Hide example' : 'Show example'}
          </Button>
          <Button
            variant="outline"
            disabled={!action}
            onClick={() =>
              list.update(ID, {
                href:
                  action?.href === '/settings/example'
                    ? '/settings/example-updated'
                    : '/settings/example',
              })
            }
          >
            Change example address
          </Button>
          <Button
            variant="outline"
            disabled={!action}
            onClick={() =>
              list.update(ID, { icon: action?.icon === SettingsIcon ? PaletteIcon : SettingsIcon })
            }
          >
            Change example icon
          </Button>
        </div>
        <Field>
          <FieldLabel htmlFor="example-title">Example title</FieldLabel>
          <Input
            id="example-title"
            value={action?.title ?? ''}
            disabled={!action}
            onChange={(event) => list.update(ID, { title: event.target.value })}
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <div aria-label="Navigation example">
            <SidebarProvider className="min-h-0">
              <DrawerNavigation />
            </SidebarProvider>
          </div>
          <div aria-label="Settings example" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Settings and user menu</h3>
              <UserMenu />
            </div>
            <SettingsNavigation />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
