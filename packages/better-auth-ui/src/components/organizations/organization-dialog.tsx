'use client';
import { useTranslation } from '@bitakit/ui';
import { Fragment, useState, useSyncExternalStore, type ReactNode } from 'react';
import { organizationWebsiteSchema } from '@bitakit/organizations';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { OrganizationLogoField } from './logo-field.js';
import { Button } from '../ui/index.js';
import { Card, CardContent } from '../ui/index.js';
import { Input } from '../ui/index.js';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldSet,
  FieldLegend,
  FieldContent,
  FieldError,
} from '../ui/index.js';
import type { OrganizationService } from '@bitakit/organizations';
const organizationFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name.')
    .max(100, 'The name must be at most 100 characters.'),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens.')
    .max(80, 'The identifier must be at most 80 characters.'),
  website: organizationWebsiteSchema,
});

export function OrganizationDialog({
  service,
  organizationId,
  close,
  embedded = false,
  secondaryActions,
}: {
  service: OrganizationService;
  organizationId?: string | null;
  close(): void;
  embedded?: boolean;
  secondaryActions?: ReactNode;
}) {
  const translateUI = useTranslation();
  const state = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const initial = state.organizations.find((item) => item.id === organizationId);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof organizationFormSchema>>({
    resolver: zodResolver(organizationFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      name: initial?.name ?? '',
      slug: initial?.slug ?? '',
      website: initial?.website ?? '',
    },
  });
  const [error, setError] = useState(false);
  const Surface = embedded ? Card : Fragment;
  const Content = embedded ? CardContent : Fragment;
  const changed = !!organizationId && state.activeId !== organizationId;
  return (
    <form
      noValidate
      onSubmit={(event) => {
        const form = event.currentTarget;
        void handleSubmit(async (values) => {
          if (busy || changed) return;
          const data = new FormData(form);
          const logo = data.get('logo');
          setBusy(true);
          setError(false);
          setSaved(false);
          try {
            const input = {
              ...values,
              logo: logo instanceof File && logo.size ? logo : undefined,
              removeLogo: data.get('removeLogo') === 'true',
            };
            if (
              input.logo &&
              (input.logo.size > 2 * 1024 * 1024 ||
                !['image/png', 'image/jpeg', 'image/webp'].includes(input.logo.type))
            )
              throw new Error('Invalid logo');
            if (organizationId) await service.update(input);
            else await service.create(input);
            setSaved(true);
            if (!embedded) close();
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        })(event);
      }}
    >
      <FieldGroup>
        <FieldSet>
          {embedded && (
            <FieldLegend>
              {translateUI('foundationUI.organization_dialog.appearance', undefined, 'Appearance')}
            </FieldLegend>
          )}
          <Surface>
            <Content>
              <OrganizationLogoField disabled={busy} initialLogo={initial?.logo ?? ''} />
            </Content>
          </Surface>
        </FieldSet>
        <FieldSet>
          {embedded && (
            <FieldLegend>
              {translateUI('foundationUI.organization_dialog.general', undefined, 'General')}
            </FieldLegend>
          )}
          <Surface>
            <Content>
              <FieldGroup
                className={
                  embedded
                    ? "gap-0 [&>div+div]:border-t-(length:--border-width) [&>div+div]:pt-(--card-spacing) [&>div:not(:last-child)]:pb-(--card-spacing)"
                    : undefined
                }
              >
                <Field
                  className={
                    embedded ? 'md:grid md:grid-cols-2 md:items-center md:gap-6' : undefined
                  }
                >
                  <FieldContent>
                    <FieldLabel htmlFor="org-name">
                      {translateUI('foundationUI.organization_dialog.name', undefined, 'Name')}
                    </FieldLabel>
                    {embedded && (
                      <FieldDescription>
                        {translateUI(
                          'foundationUI.organization_dialog.howYourOrganizationAppearsInTheWorkspace',
                          undefined,
                          'How your organization appears in the workspace.',
                        )}
                      </FieldDescription>
                    )}
                  </FieldContent>
                  <FieldContent>
                    <Input
                      id="org-name"
                      {...register('name')}
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? 'org-name-error' : undefined}
                      required
                      maxLength={100}
                      disabled={busy}
                    />
                    {errors.name && (
                      <FieldError id="org-name-error">{errors.name.message}</FieldError>
                    )}
                  </FieldContent>
                </Field>
                <Field
                  className={
                    embedded ? 'md:grid md:grid-cols-2 md:items-center md:gap-6' : undefined
                  }
                >
                  <FieldContent>
                    <FieldLabel htmlFor="org-slug">
                      {translateUI(
                        'foundationUI.organization_dialog.identifier',
                        undefined,
                        'Identifier',
                      )}
                    </FieldLabel>
                    {embedded && (
                      <FieldDescription>
                        {translateUI(
                          'foundationUI.organization_dialog.uniqueShortNameUsingLowercaseLettersNumbersAndHyphens',
                          undefined,
                          'Unique short name using lowercase letters, numbers and hyphens.',
                        )}
                      </FieldDescription>
                    )}
                  </FieldContent>
                  <FieldContent>
                    <Input
                      id="org-slug"
                      {...register('slug')}
                      aria-invalid={!!errors.slug}
                      aria-describedby={errors.slug ? 'org-slug-error' : undefined}
                      required
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      maxLength={80}
                      disabled={busy}
                    />
                    {errors.slug && (
                      <FieldError id="org-slug-error">{errors.slug.message}</FieldError>
                    )}
                  </FieldContent>
                </Field>
                <Field
                  className={
                    embedded ? 'md:grid md:grid-cols-2 md:items-center md:gap-6' : undefined
                  }
                >
                  <FieldContent>
                    <FieldLabel htmlFor="org-website">
                      {translateUI(
                        'foundationUI.organization_dialog.website',
                        undefined,
                        'Website',
                      )}
                    </FieldLabel>
                    {embedded && (
                      <FieldDescription>
                        {translateUI(
                          'foundationUI.organization_dialog.thePublicWebsiteOfYourOrganizationOptional',
                          undefined,
                          'The public website of your organization. Optional.',
                        )}
                      </FieldDescription>
                    )}
                  </FieldContent>
                  <FieldContent>
                    <Input
                      id="org-website"
                      {...register('website')}
                      aria-invalid={!!errors.website}
                      aria-describedby={errors.website ? 'org-website-error' : undefined}
                      type="url"
                      maxLength={2048}
                      disabled={busy}
                    />
                    {errors.website && (
                      <FieldError id="org-website-error">{errors.website.message}</FieldError>
                    )}
                  </FieldContent>
                </Field>
              </FieldGroup>
            </Content>
          </Surface>
        </FieldSet>
        {saved && (
          <p role="status">
            {translateUI(
              'foundationUI.organization_dialog.changesSaved',
              undefined,
              'Changes saved.',
            )}
          </p>
        )}
        {changed && (
          <p role="alert">
            {translateUI(
              'foundationUI.organization_dialog.theWorkspaceChangedOpenItAgain',
              undefined,
              'The workspace changed. Open it again.',
            )}
          </p>
        )}
        {error && (
          <p role="alert">
            {translateUI(
              'foundationUI.organization_dialog.savingFailedCheckYourInputAndPermissions',
              undefined,
              'Saving failed. Check your input and permissions.',
            )}
          </p>
        )}
        <div
          data-slot="organization-form-actions"
          className="flex flex-wrap items-center justify-end gap-2"
        >
          {secondaryActions && <div className="mr-auto">{secondaryActions}</div>}
          {!embedded && (
            <Button variant="outline" type="button" disabled={busy} onClick={close}>
              {translateUI('foundationUI.organization_dialog.cancel', undefined, 'Cancel')}
            </Button>
          )}
          <Button disabled={busy || changed || state.pending} type="submit">
            {busy
              ? translateUI('foundationUI.organization_dialog.saving', undefined, 'Saving…')
              : state.pending
                ? translateUI(
                    'foundationUI.organization_dialog.loadingOrganizationDetails',
                    undefined,
                    'Loading organization details…',
                  )
                : organizationId
                  ? translateUI(
                      'foundationUI.organization_dialog.saveChanges',
                      undefined,
                      'Save changes',
                    )
                  : translateUI(
                      'foundationUI.organization_dialog.createOrganization',
                      undefined,
                      'Create organization',
                    )}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
export function ConfirmOrganizationAction({
  service,
  organizationId,
  memberId,
  targetRole,
  close,
}: {
  service: OrganizationService;
  organizationId: string | null;
  memberId?: string;
  targetRole?: 'member' | 'admin';
  close(): void;
}) {
  const translateUI = useTranslation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [member] = useState(() =>
    service.getSnapshot().members.find((item) => item.id === memberId),
  );
  return (
    <div className="flex flex-col gap-4">
      <p>
        {targetRole
          ? translateUI(
              `foundationUI.organization_dialog.${targetRole === 'admin' ? 'promoteConfirm' : 'demoteConfirm'}`,
              {
                name:
                  member?.name ||
                  member?.email ||
                  translateUI(
                    'foundationUI.organization_dialog.thisMember',
                    undefined,
                    'This member',
                  ),
              },
              targetRole === 'admin'
                ? 'Make this member an administrator? Administrators can manage the organization and its members.'
                : 'Make this person a member? They will lose their administrative permissions.',
            )
          : memberId
            ? translateUI(
                'foundationUI.organization_dialog.removeThisMemberFromTheOrganization',
                undefined,
                'Remove this member from the organization?',
              )
            : translateUI(
                'foundationUI.organization_dialog.permanentlyDeleteThisOrganizationAndItsMemberships',
                undefined,
                'Permanently delete this organization and its memberships?',
              )}
      </p>
      {error && (
        <p role="alert">
          {translateUI(
            'foundationUI.organization_dialog.theChangeCouldNotBeCompleted',
            undefined,
            'The change could not be completed.',
          )}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={close} disabled={pending}>
          {translateUI('foundationUI.organization_dialog.cancel', undefined, 'Cancel')}
        </Button>
        <Button
          variant={targetRole ? 'default' : 'destructive'}
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setError(false);
            try {
              if (service.getSnapshot().activeId !== organizationId) throw new Error('Changed');
              if (targetRole) {
                const current = service.getSnapshot().members.find((item) => item.id === memberId);
                if (
                  !current ||
                  current.role !== member?.role ||
                  current.role !== (targetRole === 'admin' ? 'member' : 'admin')
                )
                  throw new Error('Changed');
                await service.updateRole(current.id, targetRole);
              } else if (memberId) await service.remove(memberId);
              else await service.delete();
              close();
            } catch {
              setError(true);
            } finally {
              setPending(false);
            }
          }}
        >
          {targetRole
            ? translateUI(
                'foundationUI.organization_dialog.confirmRoleChange',
                undefined,
                'Confirm role change',
              )
            : memberId
              ? translateUI(
                  'foundationUI.organization_dialog.confirmRemoval',
                  undefined,
                  'Confirm removal',
                )
              : translateUI(
                  'foundationUI.organization_dialog.deleteOrganization',
                  undefined,
                  'Delete organization',
                )}
        </Button>
      </div>
    </div>
  );
}
