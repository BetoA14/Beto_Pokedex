// Carry an HTTP status alongside a message for the central error handler.
export class HttpError extends Error {
  // readonly prevents reassignment in TypeScript; it does not freeze the object at runtime.
  readonly status: number

  constructor(status: number, message: string) {
    // Initialize Error's message before assigning our HTTP-specific information.
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}
