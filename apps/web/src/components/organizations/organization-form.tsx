'use client';
import { useTranslations } from 'next-intl';

import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { organizationSchema, type OrganizationInput } from '@/lib/organizations/schema';
import { notify } from '@/lib/notifications';
import { useActiveOrganization } from '@/providers/organization-provider';
import { authClient } from '@/lib/auth-client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { OrganizationLogoField } from '@/components/organizations/organization-logo-field';

import type { OrganizationDetails } from '@/lib/organizations/details';
export function OrganizationForm({
  organization,
  onSaved,
  onBusyChange,
  footerStart,
}: {
  organization?: OrganizationDetails;
  footerStart?: ReactNode;
  onSaved: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const t = useTranslations('Organizations');
  const organizations = authClient.useListOrganizations();
  const active = useActiveOrganization();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    setFocus,
    formState: { errors },
  } = useForm<OrganizationInput>({
    resolver: zodResolver(organizationSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      name: organization?.name ?? '',
      slug: organization?.slug ?? '',
      website: organization?.website ?? '',
    },
  });
  async function save(values: OrganizationInput, form: HTMLFormElement) {
    if (busy) return;
    const fields = new FormData(form);
    for (const [key, value] of Object.entries(values)) fields.set(key, value);
    setBusy(true);
    onBusyChange(true);
    setError('');
    const toastId = organization ? `organization:${organization.id}` : 'organization:create';
    try {
      const response = await fetch(
        organization
          ? `/api/organizations?id=${encodeURIComponent(organization.id)}`
          : '/api/organizations',
        {
          method: organization ? 'PATCH' : 'POST',
          body: fields,
        },
      );
      const result = await response.json();
      if (!response.ok) {
        if (result.error === 'validation' && Array.isArray(result.fields)) {
          const invalid = result.fields.filter((field: string) =>
            ['name', 'slug', 'website'].includes(field),
          ) as (keyof OrganizationInput)[];
          invalid.forEach((field) => setFieldError(field, { type: 'server' }));
          if (invalid[0]) setFocus(invalid[0]);
          return;
        }
        const key = ['logoInvalid', 'logoUploadError'].includes(result.error)
          ? result.error
          : organization
            ? 'updateError'
            : 'createError';
        setError(t(key));
        notify.error(organization ? 'saveFailed' : 'organizationFailed', toastId);
        return;
      }
      if (!organization) {
        const selected = await authClient.organization.setActive({ organizationId: result.id });
        if (selected.error) notify.error('createdNotActive', toastId);
        else notify.success('organizationCreated', toastId);
      } else notify.success('organizationUpdated', toastId);
      await Promise.all([organizations.refetch(), active.refetch()]);
      onSaved();
    } catch {
      setError(t('connectionError'));
      notify.error(organization ? 'saveFailed' : 'organizationFailed', toastId);
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <form
      noValidate
      onSubmit={(event) => {
        const form = event.currentTarget;
        void handleSubmit((values) => save(values, form))(event);
      }}
    >
      <FieldGroup>
        <OrganizationLogoField initialLogo={organization?.logo ?? ''} disabled={busy} />
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="organization-name">{t('name')}</FieldLabel>
          <Input
            id="organization-name"
            {...register('name')}
            aria-invalid={!!errors.name}
            aria-describedby="organization-name-error"
            required
            maxLength={100}
            disabled={busy}
          />
          {errors.name && <FieldError id="organization-name-error">{t('nameInvalid')}</FieldError>}
        </Field>
        <Field data-invalid={!!errors.slug}>
          <FieldLabel htmlFor="organization-slug">{t('identifier')}</FieldLabel>
          <Input
            id="organization-slug"
            {...register('slug')}
            aria-invalid={!!errors.slug}
            aria-describedby="organization-slug-hint organization-slug-error"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={80}
            disabled={busy}
          />
          <FieldDescription id="organization-slug-hint">{t('identifierHint')}</FieldDescription>
          {errors.slug && <FieldError id="organization-slug-error">{t('slugInvalid')}</FieldError>}
        </Field>
        <Field data-invalid={!!errors.website}>
          <FieldLabel htmlFor="organization-website">{t('website')}</FieldLabel>
          <Input
            id="organization-website"
            {...register('website')}
            aria-invalid={!!errors.website}
            aria-describedby="organization-website-hint organization-website-error"
            type="url"
            placeholder="https://example.com"
            maxLength={2048}
            disabled={busy}
          />
          <FieldDescription id="organization-website-hint">{t('websiteHint')}</FieldDescription>
          {errors.website && (
            <FieldError id="organization-website-error">{t('websiteInvalid')}</FieldError>
          )}
        </Field>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {footerStart}
          <Button className="ml-auto" type="submit" disabled={busy}>
            {busy ? t('wait') : organization ? t('save') : t('create')}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
