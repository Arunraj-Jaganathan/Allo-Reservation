export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class InsufficientStockError extends HttpError {
  constructor(message = "Not enough stock available for this warehouse.") {
    super(409, message, { error: "INSUFFICIENT_STOCK", message });
    this.name = "InsufficientStockError";
  }
}

export class NotFoundError extends HttpError {
  constructor(resource = "Resource") {
    super(404, `${resource} not found.`, { error: "NOT_FOUND", message: `${resource} not found.` });
    this.name = "NotFoundError";
  }
}

export class IdempotencyConflictError extends HttpError {
  constructor() {
    super(
      422,
      "Idempotency-Key was reused with a different request body.",
      { error: "IDEMPOTENCY_CONFLICT", message: "Idempotency-Key was reused with a different request body." },
    );
    this.name = "IdempotencyConflictError";
  }
}
