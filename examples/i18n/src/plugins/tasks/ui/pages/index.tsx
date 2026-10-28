'use client';
import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Action, useServiceState, useSetting } from '@bitakit/ui';
import {
  Badge,
  Button,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  PageHeader,
} from '@bitakit/ui/components';

// Served at /tasks. Page text and times come from next-intl, so the server already renders the
// chosen language; button labels come from the Actions' catalog keys.
export default function TasksPage() {
  const t = useTranslations('tasks.page');
  const format = useFormatter();
  const [title, setTitle] = useState('');
  const tasks = useServiceState('tasks.list', (state) => state.tasks, []);
  const showAdded = useSetting('tasks.showAdded').value;
  const open = tasks.filter((task) => !task.done).length;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        subtitle={t('remaining', { count: open })}
        trailing={
          <Action id="tasks.clear">
            <Button variant="outline" />
          </Action>
        }
      />
      <form className="flex gap-2" onSubmit={(event) => event.preventDefault()}>
        <Input
          value={title}
          aria-label={t('newTask')}
          placeholder={t('placeholder')}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Action
          id="tasks.add"
          input={title}
          onExecuted={(result) => result.status === 'completed' && setTitle('')}
        >
          <Button type="submit" />
        </Action>
      </form>
      {tasks.length ? (
        <ItemGroup>
          {tasks.map((task) => (
            <Item key={task.id} variant="outline">
              <ItemContent>
                {/* The task's title is the user's own text and stays as typed. */}
                <ItemTitle>
                  {task.title}
                  {task.done && <Badge variant="secondary">{t('done')}</Badge>}
                </ItemTitle>
                {showAdded && (
                  <ItemDescription>
                    {t('added', {
                      time: format.dateTime(new Date(task.added), { timeStyle: 'short' }),
                    })}
                  </ItemDescription>
                )}
              </ItemContent>
              <ItemActions>
                <Action id="tasks.complete" input={task.id}>
                  <Button variant="outline" size="sm" />
                </Action>
                <Action id="tasks.reopen" input={task.id}>
                  <Button variant="outline" size="sm" />
                </Action>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      )}
    </div>
  );
}
