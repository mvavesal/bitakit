/** A cleanup may finish immediately or return work that its owner must await. */
export type Cleanup = () => void | Promise<void>;

/** Runs in order, including after failures; synchronous cleanups still finish synchronously. */
export function cleanupSequence(
  tasks: readonly Cleanup[],
  finish: (errors: unknown[]) => void,
): Promise<void> {
  const errors: unknown[] = [];
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const completion = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  let index = 0;
  const next = () => {
    while (index < tasks.length) {
      try {
        const result = tasks[index++]();
        if (result && typeof result.then === 'function') {
          void Promise.resolve(result).then(next, (error) => {
            errors.push(error);
            next();
          });
          return;
        }
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      finish(errors);
      resolve();
    } catch (error) {
      reject(error);
    }
  };
  next();
  return completion;
}

export function cleanupFailure(errors: unknown[], message: string): void {
  if (errors.length) throw new AggregateError(errors, message);
}
