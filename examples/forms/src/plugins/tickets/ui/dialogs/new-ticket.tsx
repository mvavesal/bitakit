'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useAction } from '@bitakit/ui';
import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  RadioGroup,
  RadioGroupItem,
} from '@bitakit/ui/components';
import { Textarea } from '@/components/ui/textarea';
import { ticketSchema, type NewTicket } from '../../schema';

const priorities = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
] as const;

/**
 * The form of the tickets.new Action, shown in the host's dialog. react-hook-form keeps the
 * field state and checks it with the shared schema; saving runs the tickets.create Action, so
 * its pending state and success message come from the Action.
 */
export default function NewTicketDialog({ close }: { close: () => void }) {
  const create = useAction('tickets.create');
  const form = useForm<NewTicket>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { title: '', email: '', priority: 'normal', description: '' },
    mode: 'onTouched',
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      const outcome = await create?.execute(values);
      if (outcome?.status === 'completed') close();
    } catch (error) {
      // The server checks again; its message shows above the buttons and the form stays open.
      form.setError('root', {
        message: error instanceof Error ? error.message : 'Could not create the ticket.',
      });
    }
  });
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <Controller
          control={form.control}
          name="title"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="ticket-title">Title</FieldLabel>
              <Input id="ticket-title" {...field} aria-invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="ticket-email">Your email</FieldLabel>
              <Input id="ticket-email" type="email" {...field} aria-invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="priority"
          render={({ field }) => (
            <Field>
              <FieldLabel>Priority</FieldLabel>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                aria-label="Priority"
                className="flex gap-4"
              >
                {priorities.map((priority) => (
                  <Field key={priority.value} orientation="horizontal" className="w-auto">
                    <RadioGroupItem value={priority.value} id={`priority-${priority.value}`} />
                    <FieldLabel htmlFor={`priority-${priority.value}`} className="font-normal">
                      {priority.label}
                    </FieldLabel>
                  </Field>
                ))}
              </RadioGroup>
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="description"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="ticket-description">What happened?</FieldLabel>
              <Textarea
                id="ticket-description"
                rows={4}
                {...field}
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      {form.formState.errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {form.formState.errors.root.message}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Creating…' : 'Create ticket'}
        </Button>
      </div>
    </form>
  );
}
