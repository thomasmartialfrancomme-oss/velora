/**
 * Domain errors. Kept free of framework imports so the data layer can throw
 * them without pulling Next.js into its dependency graph; the HTTP layer maps
 * them onto status codes (src/lib/http/responses.ts).
 */

export class ConstraintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConstraintError';
  }
}

export class AlreadyExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AlreadyExistsError';
  }
}

/** A state-changing request that did not come from the site holding the session. */
export class OriginError extends Error {
  readonly status = 403;
  constructor(message = 'This request did not originate from your session.') {
    super(message);
    this.name = 'OriginError';
  }
}

/** Raised when an action exists but a human, or an external system, must complete it. */
export class ConfirmationRequiredError extends Error {
  constructor(message = 'Action requires confirmation.') {
    super(message);
    this.name = 'ConfirmationRequiredError';
  }
}
