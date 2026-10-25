'use client';
import { Action, useServiceState, useTranslation } from '@bitakit/ui';
import {
  Badge,
  Button,
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
  PageHeader,
} from '@bitakit/ui/components';

export default function TasksPage() {
  const t = useTranslation();
  const tasks = useServiceState('tasks.list', (state) => state, []);
  return (
    <>
      <PageHeader title={t('tasks.page.title')} subtitle={t('tasks.page.subtitle')} />
      {tasks.map((task) => (
        <Item key={task.id} variant="outline">
          <ItemContent>
            <ItemTitle>{task.title}</ItemTitle>
            <Badge variant={task.done ? 'default' : 'secondary'}>
              {t(task.done ? 'tasks.done' : 'tasks.pending')}
            </Badge>
          </ItemContent>
          <ItemActions>
            <Action id="tasks.toggle" input={task.id}>
              <Button size="sm" variant="outline" />
            </Action>
          </ItemActions>
        </Item>
      ))}
    </>
  );
}
