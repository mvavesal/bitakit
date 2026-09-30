'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { OrganizationForm } from './organization-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
export const organizationDialogParser = parseAsStringLiteral(['', 'new'] as const).withDefault('');
export function OrganizationCreateDialog() {
  const t = useTranslations('Organizations');
  const [selection, setSelection] = useQueryState('organization', organizationDialogParser);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <Dialog
      open={selection === 'new'}
      onOpenChange={(open) => {
        if (!open && !busy) void setSelection(null);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>{t('createTitle')}</DialogTitle>
          <DialogDescription>{t('intro')}</DialogDescription>
        </DialogHeader>
        <OrganizationForm
          onBusyChange={setBusy}
          onSaved={() => {
            void setSelection(null);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
