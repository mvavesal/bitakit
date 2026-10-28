'use client';
import { useServiceState } from '@bitakit/ui';
import { Button } from '@bitakit/ui/components';

/**
 * The dialog of playground.details. The host's dialog frame shows the Action's title and
 * description; this component is only the body and closes itself with `close`.
 */
export default function DetailsDialog({ close }: { close: () => void }) {
  const liked = useServiceState('playground.demo', (state) => state.liked.length, 0);
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        Dialogs read services like any component: you like <strong>{liked}</strong> fruit.
      </p>
      <div className="flex justify-end">
        <Button onClick={close}>Done</Button>
      </div>
    </div>
  );
}
