'use client';
import { useTranslations } from 'next-intl';
import type { Confirmation } from '@bitakit/core';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
export function ActionConfirmation({
  request,
  onAnswer,
}: {
  request: Confirmation | null;
  onAnswer: (accepted: boolean) => void;
}) {
  const t = useTranslations('Organizations');
  return (
    <AlertDialog
      open={!!request}
      onOpenChange={(open) => {
        if (!open) onAnswer(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription>{request?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel variant="ghost" onClick={() => onAnswer(false)}>
            {t('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={request?.destructive ? 'destructive' : 'default'}
            onClick={() => onAnswer(true)}
          >
            {request?.destructive ? request.title : t('save')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
