/** Application error with a message safe to show the user. */
export class AppError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AppError';
  }
}

/** User-facing message for any thrown value; falls back to a generic line. */
export function userMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (error instanceof AppError) return error.message;
  return fallback;
}

/**
 * Log with context for debugging. Never pass tokens, credentials,
 * full backups, or note contents through here.
 */
export function logError(scope: string, error: unknown): void {
  console.error(`[${scope}]`, error);
}
