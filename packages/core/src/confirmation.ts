export type Confirmation = { title: string; description: string; destructive?: boolean };

/** Owns a single pending decision; creating it has no side effects. */
export class ConfirmationController {
  private resolve?: (accepted: boolean) => void;
  constructor(private display: (request: Confirmation | null) => void) {}
  confirm = (request: Confirmation) =>
    new Promise<boolean>((resolve) => {
      if (this.resolve) {
        resolve(false);
        return;
      }
      this.resolve = resolve;
      this.display(request);
    });
  answer = (accepted: boolean) => {
    const resolve = this.resolve;
    this.resolve = undefined;
    this.display(null);
    resolve?.(accepted);
  };
  dispose = () => {
    this.resolve?.(false);
    this.resolve = undefined;
  };
}
