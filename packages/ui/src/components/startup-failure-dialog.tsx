'use client';
import type { FoundationUI } from '../types/ui.js';

/** A plugin that failed to start during development, as reported to the developer. */
export type StartupFailure = {
  plugin: string;
  /** True when the application module itself failed. */
  app: boolean;
  message: string;
  source?: string;
};

/**
 * Development-only report for startup failures, rendered with the host's standard dialog.
 * Isolated plugins stay off until their files change; the rest of the app keeps running.
 */
export function StartupFailureDialog({
  ui,
  failures,
  dependents,
  onDismiss,
}: {
  ui: FoundationUI;
  failures: readonly StartupFailure[];
  /** Plugins turned off because they depend on a failed plugin. */
  dependents: readonly string[];
  onDismiss(): void;
}) {
  const {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    Button,
  } = ui;
  const fatal = failures.some((failure) => failure.app);
  const title = fatal
    ? 'The app failed to start'
    : failures.length === 1
      ? `Plugin "${failures[0].plugin}" was turned off`
      : `${failures.length} plugins were turned off`;
  return (
    <Dialog open onOpenChange={(open: boolean) => (open ? undefined : onDismiss())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {fatal
              ? 'Fix the error below and save the file. The page updates automatically.'
              : 'It failed to start, so the rest of the app is running without it. Fix the error below and save the file; the page updates automatically.'}
          </DialogDescription>
        </DialogHeader>
        {failures.map((failure) => (
          // Error text often contains long unbroken paths; allow wrapping on narrow screens.
          <div key={failure.plugin} className="wrap-anywhere">
            {failure.message.split('\n').map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        ))}
        {dependents.length ? (
          <p>Also turned off because they depend on it: {dependents.join(', ')}.</p>
        ) : null}
        <DialogFooter>
          <Button onClick={onDismiss}>Dismiss</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
