'use client';
import type { Confirmation } from '@bitakit/core';
import { useFoundation } from '../providers/foundation-context.js';
import { useTranslation } from '../hooks/use-translation.js';

/** The host confirmation for actions with `confirm`, rendered with the host's dialog primitives. */
export function ConfirmDialog({
  request,
  onAnswer,
}: {
  request: Confirmation | null;
  onAnswer(accepted: boolean): void;
}) {
  const { ui, labels } = useFoundation();
  const t = useTranslation();
  if (!request) return null;
  return (
    <ui.Dialog open onOpenChange={(open) => (open ? undefined : onAnswer(false))}>
      <ui.DialogContent
        aria-describedby={request.description ? 'bitakit-confirm-description' : undefined}
      >
        <ui.DialogHeader>
          <ui.DialogTitle>{request.title}</ui.DialogTitle>
          {request.description && (
            <ui.DialogDescription id="bitakit-confirm-description">
              {request.description}
            </ui.DialogDescription>
          )}
        </ui.DialogHeader>
        <ui.DialogFooter>
          <ui.Button type="button" variant="outline" onClick={() => onAnswer(false)}>
            {t('Foundation.cancel', undefined, labels.cancel)}
          </ui.Button>
          <ui.Button
            type="button"
            variant={request.destructive ? 'destructive' : 'default'}
            autoFocus
            onClick={() => onAnswer(true)}
          >
            {t('Foundation.confirm', undefined, labels.confirm)}
          </ui.Button>
        </ui.DialogFooter>
      </ui.DialogContent>
    </ui.Dialog>
  );
}
