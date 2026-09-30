'use client';
import { useTranslation } from '@bitakit/ui';

import { useEffect, useRef, useState } from 'react';
import BuildingIcon from 'reicon-react/icons/Building';
import {  Avatar, AvatarImage, AvatarFallback  } from '../ui/index.js';
import {  Button  } from '../ui/index.js';
import {  Field, FieldLabel, FieldDescription, FieldError  } from '../ui/index.js';

export function OrganizationLogoField({
  disabled,
  initialLogo = '',
}: {
  disabled: boolean;
  initialLogo?: string;
}) {
  const translateUI = useTranslation();
  const labels = {
    logo: translateUI("foundationUI.logo_field.logo", undefined, "Logo"),
    logoPreview: translateUI("foundationUI.logo_field.organizationLogo", undefined, "Organisationslogo"),
    changeLogo: translateUI("foundationUI.logo_field.changeLogo", undefined, "Logo ändern"),
    chooseLogo: translateUI("foundationUI.logo_field.chooseLogo", undefined, "Logo auswählen"),
    removeLogo: translateUI("foundationUI.logo_field.removeLogo", undefined, "Logo entfernen"),
    logoHint: translateUI("foundationUI.logo_field.pngJPEGOrWebPUpTo2MB", undefined, "PNG, JPEG oder WebP, höchstens 2 MB."),
    logoInvalid: translateUI("foundationUI.logo_field.chooseAValidImageUpTo2MB", undefined, "Bitte ein gültiges Bild mit höchstens 2 MB auswählen."),
  };
  const t = (key: keyof typeof labels) => labels[key];
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(initialLogo);
  const [removed, setRemoved] = useState(false);
  const [invalid, setInvalid] = useState(false);
  useEffect(
    () => () => {
      if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor="organization-logo" className="sr-only">
        {t('logo')}
      </FieldLabel>
      <div className="flex items-center gap-4">
        <Avatar className="size-20">
          {preview && <AvatarImage src={preview} alt={t('logoPreview')} />}
          <AvatarFallback>
            <BuildingIcon className="size-8" aria-hidden="true" />
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => input.current?.click()}
            >
              {preview ? t('changeLogo') : t('chooseLogo')}
            </Button>
            {preview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  if (input.current) input.current.value = '';
                  setPreview('');
                  setRemoved(true);
                  setInvalid(false);
                }}
              >
                {t('removeLogo')}
              </Button>
            )}
          </div>
          <FieldDescription id="organization-logo-hint">{t('logoHint')}</FieldDescription>
        </div>
      </div>
      <input type="hidden" name="removeLogo" value={String(removed)} />
      <input
        ref={input}
        id="organization-logo"
        name="logo"
        type="file"
        className="hidden"
        tabIndex={-1}
        accept="image/png,image/jpeg,image/webp"
        disabled={disabled}
        aria-describedby="organization-logo-hint"
        aria-invalid={invalid}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (
            file.size > 2 * 1024 * 1024 ||
            !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
          ) {
            event.target.value = '';
            setPreview(removed ? '' : initialLogo);
            setInvalid(true);
            return;
          }
          setInvalid(false);
          setRemoved(false);
          setPreview(URL.createObjectURL(file));
        }}
      />
      {invalid && <FieldError>{t('logoInvalid')}</FieldError>}
    </Field>
  );
}
