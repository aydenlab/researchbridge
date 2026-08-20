export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You do not have access to this page.") {
    super(message, "forbidden", 403);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "That record could not be found.") {
    super(message, "not_found", 404);
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many attempts. Wait a moment and try again.") {
    super(message, "rate_limited", 429);
    this.name = "RateLimitError";
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function failure(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function success<T>(data?: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}
