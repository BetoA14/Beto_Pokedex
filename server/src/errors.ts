// Carry an HTTP status alongside a message for the central error handler.
export class HttpError extends Error {
  // readonly prevents reassignment in TypeScript; it does not freeze the object at runtime.
  readonly status: number;
  // Optional delay for temporary failures, exposed as the Retry-After response header.
  readonly retryAfterSeconds?: number;

  constructor(status: number, message: string, retryAfterSeconds?: number) {
    // Initialize Error's message before assigning our HTTP-specific information.
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
