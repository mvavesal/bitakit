/**
 * The request-error model of server operations, shared by the server kernel, its HTTP handler
 * and the client's `remote`. Startup errors (`BitaKitStartupError`) remain a separate model.
 */
const statuses = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_SUPPORTED: 405,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type OperationErrorCode = keyof typeof statuses;
/** One input problem: the path into the input (`['items', 0, 'title']`) and a safe message. */
export type OperationIssue = {
  readonly path: readonly (string | number)[];
  readonly message: string;
};
/** Why an access check failed, for clients that react differently to each case. */
export type OperationErrorReason =
  | 'NO_ACTIVE_ORGANIZATION'
  | 'NOT_A_MEMBER'
  | 'PERMISSION'
  | 'ORGANIZATION_CHANGED'
  | 'INTERCEPTED';
export type OperationErrorJSON = {
  code: OperationErrorCode;
  message: string;
  issues?: readonly OperationIssue[];
  reason?: OperationErrorReason | (string & {});
  requestId?: string;
};

const brand = Symbol.for('bitakit.operation-error');

/** The HTTP status of a code; unknown codes answer 500. */
export function operationStatus(code: string): number {
  return Object.hasOwn(statuses, code) ? statuses[code as OperationErrorCode] : 500;
}

/** The code of an HTTP error status (`429` → TOO_MANY_REQUESTS); any other status is a 500. */
export function operationCodeOf(status: number): OperationErrorCode {
  for (const [code, value] of Object.entries(statuses))
    if (value === status) return code as OperationErrorCode;
  return 'INTERNAL_SERVER_ERROR';
}

/** True for a code this version knows. */
export const isOperationErrorCode = (code: unknown): code is OperationErrorCode =>
  typeof code === 'string' && Object.hasOwn(statuses, code);

/**
 * An error an operation may show to its caller. Only `safeMessage`, `code`, `issues`, `reason`
 * and `requestId` ever leave the server (`toJSON`); `cause` and `stack` stay in the logs. The
 * kernel passes only branded instances through, so throw this for expected failures (not found,
 * conflict, invalid state) and let everything else become INTERNAL_SERVER_ERROR.
 */
export class OperationError extends Error {
  readonly code: OperationErrorCode;
  /** The text clients may display; never contains internal details. */
  readonly safeMessage: string;
  readonly issues?: readonly OperationIssue[];
  readonly reason?: OperationErrorReason | (string & {});
  /**
   * Correlates the answer with the server log line; set on kernel-made 500 and 503 errors and on
   * an input error whose cause the kernel logged.
   */
  readonly requestId?: string;
  readonly status: number;
  constructor(
    code: OperationErrorCode,
    safeMessage: string,
    options: {
      issues?: readonly OperationIssue[];
      reason?: OperationErrorReason | (string & {});
      requestId?: string;
      cause?: unknown;
    } = {},
  ) {
    if (!Object.hasOwn(statuses, code))
      throw new TypeError(`Unknown operation error code "${String(code)}".`);
    super(safeMessage, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'OperationError';
    this.code = code;
    this.safeMessage = String(safeMessage);
    this.status = statuses[code];
    if (options.issues) this.issues = Object.freeze(options.issues.map(freezeIssue));
    if (options.reason !== undefined) this.reason = options.reason;
    if (options.requestId !== undefined) this.requestId = options.requestId;
    Object.defineProperty(this, brand, { value: true });
  }
  toJSON(): OperationErrorJSON {
    return operationErrorBody(this);
  }
}

function freezeIssue(issue: OperationIssue): OperationIssue {
  return Object.freeze({
    path: Object.freeze([...(issue.path ?? [])]),
    message: String(issue.message),
  });
}

/**
 * True for errors created by any copy of `OperationError` (the brand is `Symbol.for`), so it holds
 * across bundles and package copies. It never looks at `code`: an error-like object from another
 * library with `code: 'NOT_FOUND'` is not an OperationError.
 */
export function isOperationError(value: unknown): value is OperationError {
  return !!value && typeof value === 'object' && (value as Record<symbol, unknown>)[brand] === true;
}

/** The wire form, read field by field so a foreign copy's extra fields never leak. */
export function operationErrorBody(error: OperationError): OperationErrorJSON {
  const code = Object.hasOwn(statuses, error.code) ? error.code : 'INTERNAL_SERVER_ERROR';
  return {
    code,
    message: String(error.safeMessage),
    ...(error.issues?.length
      ? {
          issues: error.issues.map((issue) => ({
            path: [...issue.path],
            message: String(issue.message),
          })),
        }
      : {}),
    ...(typeof error.reason === 'string' ? { reason: error.reason } : {}),
    ...(typeof error.requestId === 'string' ? { requestId: error.requestId } : {}),
  };
}

/** Rebuilds an error from its wire form (the client's `remote`); malformed bodies become a 500. */
export function operationErrorFrom(body: unknown): OperationError {
  const value = (body ?? {}) as Partial<Record<keyof OperationErrorJSON, unknown>>;
  const code =
    typeof value.code === 'string' && Object.hasOwn(statuses, value.code)
      ? (value.code as OperationErrorCode)
      : 'INTERNAL_SERVER_ERROR';
  const issues = Array.isArray(value.issues)
    ? value.issues
        .filter((issue) => issue && typeof issue.message === 'string')
        .map((issue) => ({
          path: Array.isArray(issue.path)
            ? issue.path.filter(
                (part: unknown) => typeof part === 'string' || typeof part === 'number',
              )
            : [],
          message: issue.message as string,
        }))
    : undefined;
  return new OperationError(
    code,
    typeof value.message === 'string' ? value.message : 'Something went wrong.',
    {
      issues,
      reason: typeof value.reason === 'string' ? value.reason : undefined,
      requestId: typeof value.requestId === 'string' ? value.requestId : undefined,
    },
  );
}
