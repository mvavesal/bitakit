import { defineAction } from '@bitakit/core';
import CheckIcon from 'reicon-react/icons/Check';

export default defineAction<number>({
  title: ({ input, services }) =>
    services.i18n.translate(
      services.tasks.list.state.get().find((task) => task.id === input)?.done
        ? 'tasks.toggle.reopen'
        : 'tasks.toggle.complete',
    ),
  icon: CheckIcon,
  enabled: ({ input }) => input !== undefined,
  execute: ({ services, input }) => services.tasks.list.toggle(input),
});
