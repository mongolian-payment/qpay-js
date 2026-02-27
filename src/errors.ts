/**
 * Custom error class for QPay API errors.
 *
 * Includes the HTTP status code and raw response body when available.
 */
export class QPayError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown,
  ) {
    super(message);
    this.name = "QPayError";
  }
}
