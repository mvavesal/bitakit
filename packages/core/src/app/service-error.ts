/** Structured diagnostics for unavailable public services, without guessing installation state. */
export class BitaKitServiceError extends Error {
  readonly code = 'BITAKIT_SERVICE_UNAVAILABLE';

  constructor(
    readonly service: string,
    readonly reason: 'not-ready' | 'missing' | 'unregistered',
    readonly plugin?: string,
  ) {
    const detail =
      reason === 'not-ready'
        ? 'The BitaKit runtime is not mounted. Read optional services or wait for app.ready.'
        : reason === 'missing'
          ? plugin
            ? `Plugin "${plugin}" does not provide its declared service. Check its service configuration.`
            : // The service tree knows the declaration but not its owner: usually a read during
              // creation, before the declared service exists (creation order follows `requires`).
              `It is declared but has not been created. A service that reads it while it is being created must list it in requires: ["${service}"]; otherwise check that its plugin started without errors.`
          : 'No active plugin exposes this service. Check that the providing plugin is included and enabled.';
    super(`BitaKit service "${service}" is unavailable. ${detail}`);
    this.name = 'BitaKitServiceError';
  }
}
