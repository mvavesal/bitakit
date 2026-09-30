/** Structured diagnostics for unavailable public services, without guessing installation state. */
export class FoundationServiceError extends Error {
  readonly code = 'FOUNDATION_SERVICE_UNAVAILABLE';

  constructor(
    readonly service: string,
    readonly reason: 'not-ready' | 'missing' | 'unregistered',
    readonly plugin?: string,
  ) {
    const detail =
      reason === 'not-ready'
        ? 'The Foundation runtime is not mounted. Read optional services or wait for app.ready.'
        : reason === 'missing'
          ? `Plugin "${plugin}" does not provide its declared service. Check its service configuration.`
          : 'No active plugin exposes this service. Check that the providing plugin is included and enabled.';
    super(`Foundation service "${service}" is unavailable. ${detail}`);
    this.name = 'FoundationServiceError';
  }
}
